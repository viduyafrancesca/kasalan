# Guest/entourage filter result count

## Problem

The Guests page (`app/guests/page.tsx`) lets the couple narrow the
guest/entourage list by search text, side, role, and RSVP/confirmation
status, but nothing tells them how many people matched once they've
narrowed it down — they have to scroll and count.

## Decision

Reuse the page's existing `visible` array, which already recomputes live
as `search`, `filter` (tab), `sideFilters`, `roleFilters`, and
`statusFilters` change. No new state or filtering logic — just two small
pieces of UI text that read `visible.length`.

1. **Filter dialog Done button:** relabel from `"Done"` to
   `"Show N results"` (or `"Show 1 result"` for N=1). Since
   `sideFilters`/`roleFilters`/`statusFilters` are live state (the dialog
   has no separate "draft" vs "applied" state — toggling a filter already
   updates `visible` immediately), this button always reflects the count
   for whatever's currently toggled, live, with no extra wiring.

2. **Above the list:** a `"N results"` line (same singular/plural rule)
   appears between the search/filter bar and the list container —
   **only** when narrowing is active (`search.trim() !== "" ||
   activeFilterCount > 0`) and the list isn't empty. When the list is
   empty, the existing "No one matches your search." / entourage-empty /
   guests-empty message already communicates that, so the count line is
   skipped to avoid a redundant "0 results" sitting next to it.

## Out of scope

- No change to the existing top-of-page summary stats (attending/pending/
  declined/entourage counts) — those already show unconditionally and
  aren't part of this request.
- No persistence of filter state — unrelated to this feature.
