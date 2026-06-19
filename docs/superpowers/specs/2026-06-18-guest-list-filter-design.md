# Multi-parameter filter for the Guest/Entourage list

## Problem

The Guests page already has a search box and a top-level All/Guests/Entourage
tab switch, but no way to narrow the list by the data already captured per
person: side (whose family/friend), entourage role, or RSVP status. The
couple wants to filter by any combination of these, with multiple values
selectable per category (e.g. "Pending or Attending" guests on "Maria's
side").

## Decision

- The existing All/Guests/Entourage tabs stay as-is; the new filter is an
  additional, separate control that narrows whichever tab is active.
- Three filterable categories: **Side** (the 5 tag values + "Unspecified"),
  **Role** (the 12 entourage roles), **Status** (pending/attending/declined).
  Role only matches entourage members; Status only matches guests — both
  filters stay visible at all times, and rows that don't have the relevant
  field simply don't match (no conditional hide/show of filter sections).
- Within one category, multiple selected values combine with OR (e.g.
  "Pending" or "Attending"). Across categories, the result combines with
  AND (e.g. matches Side AND matches Status). This is standard
  faceted-filter behavior, and the only sensible interpretation for
  mutually-exclusive fields like Status.
- The controls live behind a "Filter" button next to the search input,
  opening the app's existing `Dialog` component (bottom-sheet on mobile,
  centered on desktop — the same pattern every other dialog on this page
  already uses).

## Implementation

All in `app/guests/page.tsx` — no new files; this page already owns all
guest+entourage list logic.

**New state:**
```ts
const [filterOpen, setFilterOpen] = useState(false);
const [sideFilters, setSideFilters] = useState<(GuestSide | null)[]>([]);
const [roleFilters, setRoleFilters] = useState<SponsorRole[]>([]);
const [statusFilters, setStatusFilters] = useState<RsvpStatus[]>([]);
```

**Filtering logic** — one more `.filter()` step added to the existing
`visible` pipeline (after the kind/search filters already there):
```ts
.filter((p) => {
  const sideOk = sideFilters.length === 0 || sideFilters.includes(p.side);
  const roleOk = roleFilters.length === 0 || (p.kind === "sponsor" && roleFilters.includes(p.role));
  const statusOk = statusFilters.length === 0 || (p.kind === "guest" && statusFilters.includes(p.rsvp_status));
  return sideOk && roleOk && statusOk;
})
```
An empty array for a category means that category doesn't filter anything
— this is what makes "no filters active" behave exactly like today.

**UI:**
- A small icon button sits next to the search `Input`. When any of the
  three arrays is non-empty, the button shows a numeric badge with the
  total count of active filter values across all three categories.
- Clicking it opens a `Dialog` with three sections, each a grid of toggle
  buttons styled like the existing single-select pickers (RSVP status,
  Role, Side) elsewhere on this page — but these multi-toggle: clicking a
  button adds it to the relevant array if absent, removes it if present,
  rather than replacing the whole selection.
  - **Side** section reuses `SIDE_ORDER` and `getSideLabel()` (already
    defined on this page) — including the "Unspecified" (`null`) option.
  - **Role** section reuses `ROLE_ORDER` and `ROLE_LABELS` (imported from
    `lib/sponsorRoles.ts`).
  - **Status** section reuses `RSVP_OPTIONS` (already defined on this
    page).
- The dialog has a "Clear filters" button (resets all three arrays to
  `[]`) and a "Done" button that just closes the dialog — filters apply
  live as each button is toggled, consistent with every other picker on
  this page applying immediately rather than needing a separate "Apply"
  step.

## Out of scope

- No persistence of filter selections across page reloads or sessions —
  resets to empty on navigation, same as `search` and `filter` (the tab
  state) already do today.
- No filter on guest-only fields like meal choice or table number, or on
  entourage-only fields like confirmed/phone — only Side, Role, and Status
  per the request.
