# Guest headcount: include confirmed +1s in Total Guests

## Problem

"Total Guests" (Dashboard stat card, Share page stat card) counts named
guest rows only. A guest's `plus_one` flag — an extra unnamed attendee
they're bringing — isn't reflected anywhere except the Guests page's own
"X heads" figure, which already adds one head per *attending* guest with
`plus_one` set. Anyone using "Total Guests" for capacity or catering
planning is undercounting by however many +1s are confirmed attending.

## Decision: what "Total Guests" means after the fix

"Total Guests" keeps representing the full invite list (every named guest
row, regardless of RSVP status) and adds one extra head for each
*attending* guest whose `plus_one` is true — a pending guest's hypothetical
+1 isn't counted until that guest confirms. This exactly mirrors the
Guests page's existing "heads" logic (`app/guests/page.tsx:235`), just
applied to the two stats that don't already include it.

- **Dashboard:** `Total Guests = all guest rows + attending guests' confirmed +1s + sponsors`
- **Share page:** `Total Guests = all guest rows + attending guests' confirmed +1s` (no sponsors — matches today's behavior, this page never counted sponsors)
- **Guests page "X heads":** unchanged in meaning, refactored to share the same formula (see below) instead of duplicating it.

## Shared logic — `lib/guests.ts` (new file)

Following the project's existing pattern for shared calculations
(`lib/budget.ts`, `lib/categories.ts`, `lib/dashboardReminders.ts`):

```ts
export type GuestRsvpLike = {
  rsvp_status: string;
  plus_one: boolean;
};

export function countAttendingPlusOnes(guests: GuestRsvpLike[]): number {
  return guests.filter((g) => g.rsvp_status === "attending" && g.plus_one).length;
}
```

One function, one rule, three consumers. No need for a combined
"computeHeadcount" wrapper — each caller already has its own base count
(row count, or row count + sponsors) and just adds this number to it.

## Dashboard (`app/dashboard/page.tsx`)

- The `totalGuests` query currently uses `{ count: "exact", head: true }`
  (count-only, no row data) — switch it to a row query selecting
  `rsvp_status, plus_one` so `countAttendingPlusOnes` has data to work
  with.
- `attendingGuests` (used by the "RSVPs" stat) and `pendingGuests` (used by
  the payment/RSVP reminder) queries are unaffected — they stay as
  `head: true` counts, since neither needs +1 data.
- New calculation: `totalGuests = guestRows.length + countAttendingPlusOnes(guestRows) + (totalSponsors ?? 0)`.
- The "Total Guests" `StatCard` uses this new value in place of the old
  `(totalGuests ?? 0) + (totalSponsors ?? 0)`.

## Share page (`app/share/[token]/page.tsx`)

- The guests query gains `plus_one` in its `select` (currently
  `rsvp_status` only).
- New calculation: `totalGuests = guests.length + countAttendingPlusOnes(guests)`.
- The "Total Guests" stat card (added in the prior budget-hiding change)
  uses this value instead of the plain `guests.length`.

## Guests page (`app/guests/page.tsx`)

- Replace the inline `totalHeads` calculation:
  ```tsx
  const totalHeads = attending + guests.filter((g) => g.rsvp_status === "attending" && g.plus_one).length;
  ```
  with:
  ```tsx
  const totalHeads = attending + countAttendingPlusOnes(guests);
  ```
  Behavior is identical — this is a pure DRY refactor to eliminate the
  third copy of the same formula, not a logic change.

## Out of scope

- The Dashboard's "RSVPs" stat and the Guests page's "X attending" /
  "X pending" / "X declined" figures stay as plain row counts — they
  answer "how many people said yes/no," not "how many heads total,"
  and the user did not ask to change that meaning.
- No schema or migration changes — `plus_one` and `rsvp_status` already
  exist on the `guests` table and are already used elsewhere.
