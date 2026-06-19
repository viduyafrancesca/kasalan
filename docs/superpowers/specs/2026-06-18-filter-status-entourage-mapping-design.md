# Filter: map entourage `confirmed` into the Status filter

## Problem

The guest/entourage list's Status filter (Pending/Attending/Declined) only
matches guests — entourage members have no `rsvp_status` field, so
selecting any Status value excludes every entourage member outright. In
practice, "Attending" should also surface entourage members who are
`confirmed`, since that's the entourage equivalent of attending.

## Decision

Reuse the same `confirmed ↔ rsvp_status` mapping already established
elsewhere in this codebase (`moveGuestToSponsor`/`moveSponsorToGuest` in
`app/guests/page.tsx`: `confirmed = rsvp_status === "attending"`, and the
reverse `rsvp_status = confirmed ? "attending" : "pending"`):

- Status filter includes **Attending** → also matches entourage members
  where `confirmed === true`.
- Status filter includes **Pending** → also matches entourage members
  where `confirmed === false`.
- Status filter includes **Declined** → matches no entourage members
  (there's no "declined" concept for entourage — `confirmed` is binary).

## Implementation

In `app/guests/page.tsx`, the `statusOk` predicate inside the `visible`
filter pipeline changes from excluding all entourage members to mapping
their `confirmed` value onto the same `pending`/`attending` vocabulary
before checking against `statusFilters`:

```ts
const statusOk = statusFilters.length === 0 || (
  p.kind === "guest"
    ? statusFilters.includes(p.rsvp_status)
    : statusFilters.includes(p.confirmed ? "attending" : "pending")
);
```

No other filter (`sideOk`, `roleOk`) changes — only `statusOk`. This is a
pure logic correction; no new state, no UI changes, no schema changes.

## Out of scope

- No change to the Role filter's behavior (guests still don't have a
  role, so they still don't match when a Role filter is active) — the
  user only asked about Status.
- No change to how `rsvp_status` or `confirmed` are stored or edited
  anywhere else in the app.
