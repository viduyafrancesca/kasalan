# Dashboard total guests stat card

## Problem

The dashboard's "RSVPs" stat card only counts guests with `rsvp_status =
'attending'`, and "Sponsors" only counts confirmed entourage members.
Neither answers "how many people total am I planning for," which spans
both tables regardless of status.

## Design

Add a 5th stat card, "Total Guests," to `app/dashboard/page.tsx`'s stat
grid, positioned between "RSVPs" and "Sponsors":

`Tasks Done | Budget Left | RSVPs | Total Guests | Sponsors`

Value = `(count of all guests rows) + (count of all sponsors rows)` for the
wedding, regardless of `rsvp_status` or `confirmed`. Two new `count`-only
Supabase queries are added to the existing `Promise.all` (no new round
trips beyond the two extra queries):

```ts
supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
```

The stat grid's className changes from `grid-cols-2 lg:grid-cols-4` to
`grid-cols-2 lg:grid-cols-5` so all 5 cards sit in one row on desktop.
Mobile keeps the existing 2-per-row wrap (now ending in a lone 5th card on
its own line, same wrap behavior the grid already has for any odd count).

## Out of scope

- Breaking the total down by guest vs. entourage in the card itself (it's
  a single combined number, per the approved design).
- Changing what "RSVPs" or "Sponsors" cards count — those stay as-is.
