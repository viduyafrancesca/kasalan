# Remove dashboard Sponsors stat card

## Change

Remove the "Sponsors" `StatCard` from `app/dashboard/page.tsx`'s stat grid.
The grid goes back to 4 cards (Tasks Done, Budget Left, RSVPs, Total
Guests), `className` changes from `grid-cols-2 lg:grid-cols-5` to
`grid-cols-2 lg:grid-cols-4`. The now-unused `confirmedSponsors` count
query is deleted from the `Promise.all`. The `totalSponsors` query stays —
it's still needed for the "Total Guests" combined count.

## Explicitly out of scope

This only touches the dashboard stat grid. The Sponsors management page
(`app/more/sponsors/page.tsx`), the unified Guests+Entourage list
(`app/guests/page.tsx`), and all sponsor data and functionality are
untouched.
