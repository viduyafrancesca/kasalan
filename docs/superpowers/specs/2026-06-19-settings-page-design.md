# Settings page (wedding profile, setup answers, sign out)

## Problem

The data captured during the one-time `/setup` wizard — partner names,
wedding date, ceremony type, coordinator/cotillion/civil-registration/
secondary-sponsors flags — can never be revisited or corrected afterward.
`ceremony_venue` and `reception_venue` exist on the `weddings` table and
are already displayed (the dashboard countdown banner shows
`ceremony_venue`), but there is no UI anywhere that lets the couple set
them. There is also no Sign Out button anywhere in the app.

## Decision

A new full page at `/more/settings` — not a dialog, since it has too many
fields for a popup and the More page already links to full sibling pages
(Entourage, Vendor Shortlist, Share) rather than dialogs.

## Scope

**Editable fields, grouped into sections:**

- **Couple & Date** (`weddings`): `couple_name_1`, `couple_name_2`,
  `wedding_date`.
- **Venues** (`weddings`): `ceremony_venue`, `reception_venue` — this page
  is their first-ever editor.
- **Ceremony details** (`wedding_setup`): `ceremony_type` (same 5-option
  button picker as the setup wizard: Catholic/Civil/Christian/Garden/
  Beach), and the four boolean toggles already collected at setup —
  `has_coordinator`, `has_cotillion`, `has_civil_registration`,
  `has_secondary_sponsors`.
- **Account:** a Sign Out button — calls `supabase.auth.signOut()`, then
  redirects to `/login`.

**Explicitly excluded:**

- `budget_total` — stays exclusively editable on the Budget page; this
  page does not duplicate that editor.
- `entourage_size` — exists on `wedding_setup` but is never read or set
  anywhere in the app today, including the original setup wizard. Left
  out as dead data; no UI is built for a field nothing consumes.

**Behavioral note (shown in the page copy):** editing the ceremony-type or
the four toggles here only updates the stored `wedding_setup` values. It
does **not** regenerate the checklist — `checklist_items` rows were
created once at setup time as independent data with no live link back to
these answers. The page must say this explicitly so changing a toggle
doesn't read as a no-op bug.

## Data flow

- On load: one `weddings` row (already fetched via the existing
  `getWeddingForUser` helper, which does `select("*")`) plus one
  `wedding_setup` row fetched by `wedding_id` (a new query — no existing
  page reads this table; only `/setup` ever wrote to it).
- Single local form state covering both tables' editable fields.
- One "Save changes" button at the bottom updates both `weddings` and
  `wedding_setup` rows in one save action — there's no list of
  independent items here the way Guests/Vendors/Budget have, so a
  single combined save is simpler than per-field or per-section saves.

## Navigation

`app/more/page.tsx`'s `SECTIONS` array gains a 4th entry: "Settings" /
"Wedding details, ceremony preferences & account", linking to
`/more/settings`.

## Out of scope

- No password change / email change flow — Sign Out is the only account
  action being added.
- No checklist regeneration when ceremony-type or the toggles change.
- No way to delete the wedding or transfer ownership.
