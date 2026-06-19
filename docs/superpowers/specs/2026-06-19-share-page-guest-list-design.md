# Guest/entourage list on the family share page

## Problem

The read-only family/friends share page (`app/share/[token]/page.tsx`,
linked via the "Family view-only link" on `/more/share`) currently shows
a countdown, 3 summary stat cards (Tasks, Total Guests, RSVPs), and the
checklist's planning progress — but no actual names. Family and friends
who open the link can't see who's invited, what role anyone has in the
entourage, or who's confirmed.

This is distinct from the partner invite flow (`/invite/[token]`), which
grants full edit access — out of scope here.

## Decision

Add a new "Guests & Entourage" section to the share page, between the
existing stat cards and "Planning Progress." It lists every `guests` and
`sponsors` row for the wedding, combined and sorted alphabetically by
name (matching the sort order already used on the Guests page), as one
row per person:

- **Name**
- **Role** — the sponsor's role label (e.g. "Ninong", "Veil") for
  entourage members; the literal text `"Guest"` for everyone on the
  guest list, since guests have no role field.
- **Status** — a badge using the same Attending/Pending/Declined styling
  already used elsewhere in the app. Guests use their real
  `rsvp_status`. Sponsors only have a `confirmed` boolean, not a 3-state
  RSVP — `confirmed = true` maps to "Attending", `confirmed = false`
  maps to "Pending" (no "Declined" state exists for sponsors).

## Privacy

This link requires no login — anyone with the URL can view it. The list
shows **only** name, role, and status. Phone, email, notes, table
number, meal choice, and side are not fetched or rendered here, even
though they exist on both tables — this section adds no new way to leak
contact details beyond what the page already reveals (none, today).

## Data flow

The page is a server component (`app/supabase/server` client, already
the pattern in this file). Add a third parallel query alongside the
existing `weddings`/`checklist_items`/`guests` queries:

- Broaden the existing `guests` query's `select` from
  `"rsvp_status, plus_one"` to `"name, rsvp_status, plus_one"` (the existing
  `countAttendingPlusOnes`/`attending` calculations still work unchanged
  off the same rows).
- Add a new `sponsors` query: `select("name, role, confirmed")`.
- Merge both into one array of `{ name, roleLabel, status }` shaped
  rows, sort by `name`, and render.

## Out of scope

- No search/filter UI on the share page — it's a static, read-only
  summary, not an interactive tool like the Guests page.
- No plus-one indicator, side tag, table number, or meal choice in this
  list — not requested, and adding them would mean deciding fresh privacy
  tradeoffs for each.
- No changes to `/invite/[token]` (the partner invite flow) or to the
  Guests page itself.
