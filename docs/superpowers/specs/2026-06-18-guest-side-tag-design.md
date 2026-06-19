# Guest/entourage side & relationship tag

## Problem

The couple wants to know, at a glance, whose side a guest or entourage
member is on — one partner's family, one partner's friend, or a mutual
friend of both — without having to remember or ask. Today neither the
`guests` nor `sponsors` table captures this.

## Data model

Following this project's existing convention of Postgres enums for
categorical fields (`sponsor_role`, `vendor_category`, `rsvp_status`,
etc.), add a new enum and a nullable column on both tables:

```sql
CREATE TYPE guest_side AS ENUM ('partner1_family', 'partner1_friend', 'partner2_family', 'partner2_friend', 'mutual_friend');
ALTER TABLE guests ADD COLUMN side guest_side;
ALTER TABLE sponsors ADD COLUMN side guest_side;
```

The column is nullable (no default) so every existing row stays valid —
tagging is optional and the couple can fill it in gradually. As with every
schema change in this project, the user runs this SQL by hand in the
Supabase SQL editor; it is never run automatically. `lib/db/schema.ts` is
updated afterward to mirror the new enum and columns for reference (no
runtime queries go through Drizzle in this app).

## Labels

The five enum values map to user-facing labels built from the wedding's
actual partner names (`weddings.couple_name_1` / `couple_name_2`, already
fetched via `getWeddingForUser` and already used elsewhere, e.g. the
countdown banner) — not generic "Partner 1/2" text:

| Enum value | Label (example: Maria & Jericho) |
|---|---|
| `partner1_family` | Maria's Family |
| `partner1_friend` | Maria's Friend |
| `partner2_family` | Jericho's Family |
| `partner2_friend` | Jericho's Friend |
| `mutual_friend` | Mutual Friend |

`null` renders as "Unspecified" wherever a label is needed, and is the
default for new guests/entourage members.

## UI (`app/guests/page.tsx`)

- `load()` already calls `getWeddingForUser`, which returns `couple_name_1`
  and `couple_name_2` via its `select("*")` — these get stored in new
  state alongside `weddingId` so labels can be built without an extra
  query.
- Both the Guest dialog and the Sponsor/Entourage dialog gain a new
  6-button picker (the 5 tags above, plus "Unspecified") styled like the
  existing RSVP-status and role pickers — a row of toggle buttons, one
  always selected. "Unspecified" is both the default state for new
  entries and the only way to clear a tag on an existing one.
- Each list row shows the tag as a small muted text line under the
  person's name — guests already show meal choice and table number this
  way; the side tag joins that same stack. The line is omitted entirely
  when the tag is `null`/unspecified, so untagged rows look exactly as
  they do today.
- The existing Move-to-Entourage / Move-to-Guest actions (shipped
  separately) carry the `side` value over in both directions, the same
  way they already carry over `name`, `phone`, `email`, and `notes` — it's
  a field that exists identically on both tables, so there's no mapping
  decision to make.

## Out of scope

- No new filter tabs (the existing All/Guests/Entourage filter is
  untouched) — the tag is visible per-row only, per the approved design.
- No bulk-tagging UI; one person at a time, via the same edit dialogs as
  every other field.
- No reporting/grouping view (e.g. "guests by side" summary) — just the
  tag itself, visible on each row and editable in each dialog.
