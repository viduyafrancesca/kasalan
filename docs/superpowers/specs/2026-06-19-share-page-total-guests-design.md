# Total Guests count on the family share page

## Problem

The "Total Guests" stat card on the family share page
(`app/share/[token]/page.tsx`) currently counts only `guests` table
rows, including pending and declined ones, plus an extra for each
attending guest's plus-one. It excludes entourage/sponsors entirely,
and doesn't exclude declined guests from the base count.

## Decision

```ts
const totalGuests =
  (guests ?? []).filter((g) => g.rsvp_status !== "declined").length +
  countAttendingPlusOnes(guests as GuestRsvpLike[]) +
  (sponsors ?? []).length;
```

- **Guests:** counted unless `rsvp_status === "declined"` (pending and
  attending both count toward the total).
- **Plus-ones:** unchanged — still only added for guests who are both
  `rsvp_status === "attending"` and `plus_one === true`, via the
  existing `countAttendingPlusOnes` helper.
- **Entourage:** every `sponsors` row counts, regardless of `confirmed`
  status. Sponsors have no "declined" equivalent (only a `confirmed`
  boolean), so there's nothing to exclude on that table — the chosen
  behavior mirrors guests by only excluding an explicit decline, and
  entourage members have no such state.
- `sponsors` is already fetched on this page (added for the "Guests &
  Entourage" list feature), so this is a formula change only — no new
  query.
- The card's label stays "Total Guests."

## Out of scope

- No change to the "RSVPs" stat card or the "Guests & Entourage" list
  section added previously.
- No relabeling of the stat card.
