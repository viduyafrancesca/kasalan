# Supplier Lineup Comparison — Design Spec

## Purpose

A couple can save multiple Supplier Lineups (e.g. "Budget option," "Dream option") but currently has no way to see them side-by-side. This adds a comparison view across all saved lineups, surfacing total cost and per-category vendor differences at a glance.

## Scope

- Compares **all saved lineups for the wedding** simultaneously, side-by-side — not a subset picker, matching the existing Compare Packages page's "show everything in scope" pattern.
- Each lineup's column shows: its name (as a clickable link back to its builder page), its estimated total (deduplicated by vendor, same logic as the builder page's total banner), and — for **every** active vendor category, regardless of whether any lineup has filled it — the picked vendor's name and price for that lineup, or "—" if that lineup has no pick in that category.
- Inclusions are not shown in this table at all (matches the builder page's recent move of inclusions out of per-category display into a separate section — this comparison view doesn't need that level of detail).
- Entirely read-only except for the lineup-name links, which navigate to that lineup's builder page (`/more/supplier-lineup/[id]`) for editing — the table itself has no inline edit affordances.
- If fewer than 2 lineups exist, shows an empty state directing the user to create more, instead of a single- or zero-column table.

## Design

**New route:** `app/more/supplier-lineup/compare/page.tsx`

**Navigation:** A "Compare Lineups" link added to the existing list page (`app/more/supplier-lineup/page.tsx`), near the page header.

**Data needed:**
- All `supplier_lineups` for the wedding (`id`, `name`).
- All `supplier_lineup_picks` for those lineup ids (`lineup_id`, `category`, `vendor_id`).
- All `vendors` for the wedding (`id`, `name`, `price_range_min`, `price_range_max`) for price/name lookup.
- Active categories via the existing `getActiveCategories(hidden)` helper, in `CATEGORY_ORDER`.

**Behavior:**
1. If `lineups.length < 2`: render an empty state — "Create at least 2 lineups to compare" — with a link back to `/more/supplier-lineup`.
2. Otherwise render a table matching the layout already established by `app/more/compare/page.tsx`: a sticky left label column, one horizontally-scrollable column per lineup.
3. **Header row:** each lineup's name, rendered as a link to `/more/supplier-lineup/[id]`.
4. **Total row:** "Total" label, then per lineup, the estimated price range computed by summing `price_range_min`/`price_range_max` once per **unique vendor** picked anywhere in that lineup (the same dedup-by-vendor logic already used on the builder page, reimplemented here scoped per-lineup instead of for a single lineup) — or "—" if that lineup has no picks with any price set.
5. **Category rows:** one row per category in `CATEGORY_ORDER` (every active category, not just ones with picks). Each lineup's cell shows that category's picked vendor's name and price (e.g. "Vendor Name — ₱X–₱Y") if that lineup has a pick for that category, or "—" if it doesn't.

## Out of Scope

- Selecting a subset of lineups to compare (always shows all of them).
- Showing inclusions in the comparison table.
- Any editing from this page — all edits still happen on the per-lineup builder page.
- Cross-lineup actions like merging or copying picks between lineups.
