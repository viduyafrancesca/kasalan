# Share page: hide budget from view-only link

## Problem

The view-only family/friend share link (`/share/[token]`) currently shows
the wedding's remaining budget as one of its three stat cards. Budget is
private — the couple doesn't want it visible to anyone holding the
view-only link.

## Design

`app/share/[token]/page.tsx`:

- Remove the `budget_items` Supabase query from the `Promise.all` entirely
  — no budget data is fetched for this view at all.
- Remove the `totalBudget`/`totalPaid` calculations and the `formatPHP`
  import (both become unused once the budget card is gone).
- Replace the "Remaining" stat card with a "Total Guests" stat card. Value
  is `(guests ?? []).length` — the guest rows are already fetched on this
  page (currently only `rsvp_status` is selected to compute the `attending`
  count; the array length gives the total for free, no new query).
- Stat row stays a 3-column grid, just with a different middle card:
  **Tasks | Total Guests | RSVPs**.

No other files change. `app/more/share/page.tsx` (the link-generation UI)
never displayed budget data. The partner-invite flow is unaffected —
partners still get full edit access including budget, by design; this
change is scoped to the read-only share token view only.

## Out of scope

- Sponsors are not added to the "Total Guests" count on this page (unlike
  the dashboard's "Total Guests" stat, which sums guests + sponsors) —
  this page's guest query doesn't currently fetch sponsors, and adding that
  is unrelated to the budget-hiding goal.
- No change to RLS policies — the share-token route already does its own
  manual token lookup and field selection in the page component; budget
  data simply won't be queried or rendered for this route anymore.
