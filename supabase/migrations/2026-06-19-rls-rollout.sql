-- Database-wide Row Level Security rollout + partner-invite single-use fix.
-- Run once in the Supabase SQL editor. See docs/superpowers/specs/2026-06-19-rls-rollout-design.md
-- for the design rationale behind each decision below.

-- Membership helper
create or replace function is_wedding_member(target_wedding_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from weddings w where w.id = target_wedding_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from collaborators c where c.wedding_id = target_wedding_id and c.user_id = auth.uid()
  );
$$;
revoke all on function is_wedding_member(uuid) from public;
grant execute on function is_wedding_member(uuid) to authenticated;

-- weddings
alter table weddings enable row level security;
create policy "members select" on weddings for select using (is_wedding_member(id));
create policy "owner insert"   on weddings for insert with check (owner_id = auth.uid());
create policy "members update" on weddings for update using (is_wedding_member(id)) with check (is_wedding_member(id));

-- wedding_setup
alter table wedding_setup enable row level security;
create policy "members select" on wedding_setup for select using (is_wedding_member(wedding_id));
create policy "members insert" on wedding_setup for insert with check (is_wedding_member(wedding_id));
create policy "members update" on wedding_setup for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on wedding_setup for delete using (is_wedding_member(wedding_id));

-- wedding_sides
alter table wedding_sides enable row level security;
create policy "members select" on wedding_sides for select using (is_wedding_member(wedding_id));
create policy "members insert" on wedding_sides for insert with check (is_wedding_member(wedding_id));
create policy "members update" on wedding_sides for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on wedding_sides for delete using (is_wedding_member(wedding_id));

-- guests
alter table guests enable row level security;
create policy "members select" on guests for select using (is_wedding_member(wedding_id));
create policy "members insert" on guests for insert with check (is_wedding_member(wedding_id));
create policy "members update" on guests for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on guests for delete using (is_wedding_member(wedding_id));

-- sponsors
alter table sponsors enable row level security;
create policy "members select" on sponsors for select using (is_wedding_member(wedding_id));
create policy "members insert" on sponsors for insert with check (is_wedding_member(wedding_id));
create policy "members update" on sponsors for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on sponsors for delete using (is_wedding_member(wedding_id));

-- vendors
alter table vendors enable row level security;
create policy "members select" on vendors for select using (is_wedding_member(wedding_id));
create policy "members insert" on vendors for insert with check (is_wedding_member(wedding_id));
create policy "members update" on vendors for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on vendors for delete using (is_wedding_member(wedding_id));

-- budget_items
alter table budget_items enable row level security;
create policy "members select" on budget_items for select using (is_wedding_member(wedding_id));
create policy "members insert" on budget_items for insert with check (is_wedding_member(wedding_id));
create policy "members update" on budget_items for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on budget_items for delete using (is_wedding_member(wedding_id));

-- checklist_items
alter table checklist_items enable row level security;
create policy "members select" on checklist_items for select using (is_wedding_member(wedding_id));
create policy "members insert" on checklist_items for insert with check (is_wedding_member(wedding_id));
create policy "members update" on checklist_items for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy "members delete" on checklist_items for delete using (is_wedding_member(wedding_id));

-- collaborators (select-only; inserts only via accept_invite below)
alter table collaborators enable row level security;
create policy "members select" on collaborators for select using (is_wedding_member(wedding_id));

-- share_tokens
alter table share_tokens enable row level security;
create policy "members select" on share_tokens for select using (is_wedding_member(wedding_id));
create policy "members insert" on share_tokens for insert with check (is_wedding_member(wedding_id));

-- partner_invites
alter table partner_invites enable row level security;
create policy "members select" on partner_invites for select using (is_wedding_member(wedding_id));
create policy "members insert" on partner_invites for insert with check (is_wedding_member(wedding_id));

-- Public invite-preview RPC
create or replace function get_invite_preview(invite_token uuid)
returns table (wedding_id uuid, couple_name_1 text, couple_name_2 text, wedding_date date)
language sql security definer stable as $$
  select w.id, w.couple_name_1, w.couple_name_2, w.wedding_date
  from partner_invites pi join weddings w on w.id = pi.wedding_id
  where pi.token = invite_token and pi.accepted_at is null;
$$;
revoke all on function get_invite_preview(uuid) from public;
grant execute on function get_invite_preview(uuid) to anon, authenticated;

-- Atomic, single-use invite acceptance RPC
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
revoke all on function accept_invite(uuid) from public;
grant execute on function accept_invite(uuid) to authenticated;
