# Supplier Lineup Compare — UX Pass — Design Spec

## Purpose

Three improvements to the Supplier Lineup comparison page (`app/more/supplier-lineup/compare/page.tsx`, shipped earlier this session): make each lineup's total stand out instead of blending in as a plain table row, let the table use the full available width on screens big enough to fit it without forced horizontal scrolling, and drop per-category prices from the table now that totals are prominently shown elsewhere.

## Scope

Applies only to `app/more/supplier-lineup/compare/page.tsx`. No other page is affected.

### 1. Total summary cards (replacing the in-table Total row)

- Adds a horizontally-scrollable strip of cards above the table — one card per lineup — each showing the lineup's name (bold, linking to `/more/supplier-lineup/[id]`) and its total (large, bold), styled with the same `bg-terra-100 rounded-xl px-4 py-3` treatment already used for the "Estimated total" banner on `app/more/supplier-lineup/[id]/page.tsx`.
- Each card is `min-w-40` wide, matching the table's existing lineup-column minimum width, so the cards visually line up with their corresponding columns below even though the two scroll independently (no literal scroll-sync needed).
- The table drops two things it currently has: its lineup-name header row, and its in-table Total row — both are now redundant since the cards above cover that information. The table starts directly with category rows (sticky label column unchanged).
- Out of scope: any change to the per-lineup builder page's own total banner (it already has this treatment), and any change to the Supplier Lineup list page.

### 2. Responsive width — no forced scroll when the screen fits

- This page's outer container currently caps at `max-w-2xl` (672px) and centers, the same fixed cap every other page in the app uses regardless of screen size — including on desktop, where the sidebar already leaves much more room. This is a deliberate one-off widening of just this page, not a change to the app-wide layout convention.
- On screens wide enough (desktop, `lg` breakpoint and up), this page's container widens beyond `max-w-2xl` to a generous fixed cap, giving the comparison table room to lay out every lineup column without triggering horizontal scroll for typical lineup counts.
- Mobile width is unchanged.
- Horizontal scroll (`overflow-x-auto`) remains on both the card strip and the table as a fallback — if there are enough lineups that even the widened desktop container can't fit them all, scrolling still works exactly as it does today.

### 3. Remove prices from category cells

- `cellLabel(lineupId, category)` currently returns `"Vendor Name — price"`. It now returns just the vendor's name (or "—" if unfilled) — no price.
- The `priceLabel` helper function on this page becomes unused once this change lands (it was only called from `cellLabel`) and is deleted rather than left as dead code.
- Out of scope: `priceLabel` usage elsewhere in the app (e.g. `app/more/compare/page.tsx`, the builder page) is untouched — each page already defines its own local copy of this helper, per this codebase's established per-page duplication convention.

## Design

**Card row** (new, above the table): a horizontally-scrollable flex container, one card per lineup in the same order as the table's columns. Each card:
- Lineup name, bold, as a `Link` to `/more/supplier-lineup/[id]` (this replaces the table header row's link).
- `totalLabel(lineup.id)` rendered large/bold beneath the name (same value already computed for the old in-table Total row — no change to `totalLabel`'s logic, only where its output is rendered).
- Card container: `min-w-40 flex-shrink-0 bg-terra-100 rounded-xl px-4 py-3`.

**Table** (modified): the existing `<table>` loses its first `<tr>` (lineup-name header) and its second `<tr>` (Total row). It now starts with the `activeCategories.map(...)` row block directly inside `<tbody>`, with the same sticky label column behavior as before. Each category cell's content changes from `cellLabel` returning a name+price string to returning just the name (or "—").

**Layout/width:** the card strip sits in its own `overflow-x-auto` flex container directly above the table's existing `overflow-x-auto` wrapper, both inside the same page padding. The page's outermost container class changes from `max-w-2xl mx-auto w-full` to `max-w-2xl lg:max-w-5xl mx-auto w-full` — unchanged on mobile, wider on desktop.
