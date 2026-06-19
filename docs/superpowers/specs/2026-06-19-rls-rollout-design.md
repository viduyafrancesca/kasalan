# Database-wide Row Level Security rollout

## Problem

A security audit of the app found that no table in the database has any
Row Level Security (RLS) policy. The app uses the public Supabase anon
key everywhere (by design — it's embedded in the client JS bundle), and
the only thing preventing one wedding's data from being readable/
writable by anyone is that the app's own JS *chooses* to add
`.eq("wedding_id", ...)` to each query. Anyone who extracts the anon key
from the page source (trivial) and calls Supabase's REST API directly
can read or modify any wedding's guests, budget, checklist, or sponsors
— not just their own.

A second, related finding: the partner-invite "Join" flow
(`app/invite/[token]/page.tsx`) has no single-use enforcement — any
number of different accounts can accept the same invite link,
indefinitely, becoming permanent full-edit collaborators. RLS forces a
decision on this flow anyway (a brand-new collaborator isn't a member
yet when they try to insert themselves), so this rollout fixes both
issues together.

## Decision: membership model

One reusable Postgres function backs every policy:

```sql
create or replace function is_wedding_member(target_wedding_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from weddings w where w.id = target_wedding_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from collaborators c where c.wedding_id = target_wedding_id and c.user_id = auth.uid()
  );
$$;
```

`security definer` lets it read `weddings`/`collaborators` internally
without being blocked by the very RLS it helps enforce (Postgres lets a
security-definer function's queries run as the function's owner, who
isn't subject to RLS on tables they own). `collaborators.role` is never
set to anything but `"partner"` today — `"viewer"` is dead enum data, so
membership is one tier: any collaborator gets the same access as the
owner. No separate read-only tier exists or is being added.

Every wedding-scoped table (`wedding_setup`, `wedding_sides`, `guests`,
`sponsors`, `vendors`, `budget_items`, `checklist_items`) gets:

```sql
alter table <table> enable row level security;
create policy "members select"  on <table> for select using (is_wedding_member(wedding_id));
create policy "members insert"  on <table> for insert with check (is_wedding_member(wedding_id));
create policy "members update"  on <table> for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete"  on <table> for delete using (is_wedding_member(wedding_id));
```

`weddings` is special-cased: its own `id` is what `is_wedding_member`
checks for every other table, and at `INSERT` time (creating a brand
new wedding in the setup wizard) no row exists yet for
`is_wedding_member` to find — so its `INSERT` check uses `owner_id =
auth.uid()` instead. No `DELETE` policy is added (deleting a wedding
isn't a feature today, matches the Settings page spec's explicit
out-of-scope note):

```sql
alter table weddings enable row level security;
create policy "members select" on weddings for select using (is_wedding_member(id));
create policy "owner insert"   on weddings for insert with check (owner_id = auth.uid());
create policy "members update" on weddings for update using (is_wedding_member(id)) with check (is_wedding_member(id));
```

`collaborators` gets **only** a `SELECT` policy — there is deliberately
no client-facing `INSERT` policy, because the only legitimate way to
become a collaborator is the `accept_invite` function below (which runs
as security definer and bypasses this table's RLS):

```sql
alter table collaborators enable row level security;
create policy "members select" on collaborators for select using (is_wedding_member(wedding_id));
```

`share_tokens` and `partner_invites` get member-scoped `SELECT`/`INSERT`
(the authenticated `/more/share` page's "generate a link" actions) but
no `UPDATE`/`DELETE` (no revoke-link feature exists):

```sql
alter table share_tokens enable row level security;
create policy "members select" on share_tokens for select using (is_wedding_member(wedding_id));
create policy "members insert" on share_tokens for insert with check (is_wedding_member(wedding_id));

alter table partner_invites enable row level security;
create policy "members select" on partner_invites for select using (is_wedding_member(wedding_id));
create policy "members insert" on partner_invites for insert with check (is_wedding_member(wedding_id));
```

`checklist_templates` is **not** given RLS — it's global, non-sensitive
seed data with no `wedding_id` column at all (the setup wizard reads it
before a wedding even exists), so there's nothing wedding-specific to
protect.

## Decision: the two public, pre-membership flows

Two flows run before the caller is a wedding member (or isn't
authenticated at all), so they can't go through the policies above.

**Family share link** (`app/share/[token]/page.tsx`, a Server
Component, no login): switches from the cookie-based anon-key client to
a new server-only Supabase client built with the **service-role key**
(`lib/supabase/serviceRole.ts`, new file — uses `@supabase/supabase-js`'s
plain `createClient`, no cookies). The page already validates the token
and expiry itself before querying; that validation becomes the access
boundary for this one route, exactly as it conceptually is today. The
service-role key is a new server-only env var
(`SUPABASE_SERVICE_ROLE_KEY`, **not** `NEXT_PUBLIC_*`) — never sent to
the browser, only read in this one server file.

**Partner invite** (`app/invite/[token]/page.tsx`, a `"use client"`
page with no server component, so it can't use the service-role
pattern above): both its steps move to security-definer RPC functions
the client calls via `supabase.rpc(...)`, callable by `anon`/
`authenticated` without needing wedding membership:

```sql
create or replace function get_invite_preview(invite_token uuid)
returns table (wedding_id uuid, couple_name_1 text, couple_name_2 text, wedding_date date)
language sql security definer stable as $$
  select w.id, w.couple_name_1, w.couple_name_2, w.wedding_date
  from partner_invites pi join weddings w on w.id = pi.wedding_id
  where pi.token = invite_token and pi.accepted_at is null;
$$;

create or replace function accept_invite(invite_token uuid)
returns void
language plpgsql security definer as $$
declare
  v_wedding_id uuid;
  v_accepted_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select wedding_id, accepted_at into v_wedding_id, v_accepted_at
  from partner_invites where token = invite_token;

  if v_wedding_id is null then
    raise exception 'Invalid invite';
  end if;
  if v_accepted_at is not null then
    raise exception 'Invite already used';
  end if;

  insert into collaborators (wedding_id, user_id, role) values (v_wedding_id, auth.uid(), 'partner');
  update partner_invites set accepted_at = now(), accepted_by = auth.uid() where token = invite_token;
end;
$$;

revoke all on function get_invite_preview(uuid) from public;
grant execute on function get_invite_preview(uuid) to anon, authenticated;
revoke all on function accept_invite(uuid) from public;
grant execute on function accept_invite(uuid) to authenticated;
```

`get_invite_preview` returns nothing for an invalid **or already-used**
token, so the page's existing "Invalid invite link" message also now
covers the reuse case for free. `accept_invite` is the single atomic
operation that closes the reuse bug: the second caller's `accepted_at
is not null` check fails and the function raises, instead of silently
inserting a second collaborator.

## Code changes

- `app/invite/[token]/page.tsx`: replace the `partner_invites` table
  select in `init()` with `supabase.rpc("get_invite_preview", { invite_token: token })`,
  and replace the two writes in `handleJoin()` with
  `supabase.rpc("accept_invite", { invite_token: invite.token })`,
  showing its error message (e.g. "Invite already used") if it throws.
- `app/share/[token]/page.tsx`: swap `createClient` (from
  `@/lib/supabase/server`) for a new `createServiceRoleClient` (from
  `@/lib/supabase/serviceRole`, new file).
- `lib/db/schema.ts`: add the missing `partnerInvites` table mirror
  (it exists in the live DB and is used by the app, but was never added
  to this reference file — pure housekeeping, no behavior change).

## Verification

After the migration runs, confirm: the wedding owner can still read/
write everything on their own wedding; a partner who already accepted
an invite can too; a second, unrelated test account querying another
wedding's tables directly gets empty results (re-running the earlier
`pg_policies` check, now expecting policies to exist); the share link
still loads correctly for a logged-out browser; the invite flow works
end-to-end for the first acceptor and is rejected with "Invite already
used" for a second acceptor on the same link.

## Out of scope

- No read-only ("viewer") collaborator tier — `"viewer"` stays unused
  dead enum data, not built out as part of this project.
- No "revoke share link / invite" feature — `UPDATE`/`DELETE` policies
  on `share_tokens`/`partner_invites` aren't added since nothing in the
  app does this today.
- No wedding deletion — no `DELETE` policy on `weddings`.
- No changes to `checklist_templates` — it stays unrestricted, global
  seed data.
