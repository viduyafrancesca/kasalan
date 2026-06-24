# Supplier Lineup Compare — Total Summary Cards — Design Spec

## Purpose

On the Supplier Lineup comparison page (`app/more/supplier-lineup/compare/page.tsx`, shipped earlier this session), each lineup's estimated total currently renders as a plain table row right under the header — it reads like just another row of data and doesn't stand out as the headline number it actually is. This replaces that row with a prominent, highlighted summary card per lineup, matching the visual treatment the "Estimated total" banner already gets on the per-lineup builder page.

## Scope

- Applies only to `app/more/supplier-lineup/compare/page.tsx`.
- Adds a horizontally-scrollable strip of cards above the table — one card per lineup — each showing the lineup's name (bold, linking to `/more/supplier-lineup/[id]`) and its total (large, bold), styled with the same `bg-terra-100 rounded-xl px-4 py-3` treatment already used for the "Estimated total" banner on `app/more/supplier-lineup/[id]/page.tsx`.
- Each card is `min-w-40` wide, matching the table's existing lineup-column minimum width, so the cards visually line up with their corresponding columns below even though the two scroll independently (no literal scroll-sync needed).
- The table drops two things it currently has: its lineup-name header row, and its in-table Total row — both are now redundant since the cards above cover that information. The table starts directly with category rows (sticky label column unchanged).
- The `<2`-lineups empty state is unchanged — when it's showing, neither the cards nor the table render.
- Out of scope: any change to the per-lineup builder page's own total banner (it already has this treatment), any change to the Supplier Lineup list page, and any change to category-row content/logic (`cellLabel` is untouched).

## Design

**Card row** (new, above the table): a horizontally-scrollable flex container, one card per lineup in the same order as the table's columns. Each card:
- Lineup name, bold, as a `Link` to `/more/supplier-lineup/[id]` (this replaces the table header row's link).
- `totalLabel(lineup.id)` rendered large/bold beneath the name (same value already computed for the old in-table Total row — no change to `totalLabel`'s logic, only where its output is rendered).
- Card container: `min-w-40 flex-shrink-0 bg-terra-100 rounded-xl px-4 py-3`.

**Table** (modified): the existing `<table>` loses its first `<tr>` (lineup-name header) and its second `<tr>` (Total row). It now starts with the `activeCategories.map(...)` row block directly inside `<tbody>`, with the same sticky label column behavior as before.

**Layout:** the card strip sits in its own `overflow-x-auto` flex container directly above the table's existing `overflow-x-auto` wrapper, both inside the same page padding.
