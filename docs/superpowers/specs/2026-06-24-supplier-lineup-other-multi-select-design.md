# Supplier Lineup — Multiple Vendors for "Other" — Design Spec

## Purpose

Every Supplier Lineup category currently allows exactly one vendor pick. The "Other" category is a catch-all for miscellaneous suppliers (e.g. photo booth, balloon artist, lights rental) that doesn't fit the model of "exactly one supplier wins this category" — a lineup may reasonably want several distinct "Other" vendors at once. This change makes "Other" allow multiple vendor picks while every other category keeps its existing single-pick behavior unchanged.

## Scope

Touches three files:
- `app/more/supplier-lineup/[id]/page.tsx` (builder page — main change)
- `app/more/supplier-lineup/compare/page.tsx` (comparison page — render multiple names in the Other row)
- `supabase/migrations/<date>-supplier-lineup-other-multi.sql` (new migration, relaxes the uniqueness constraint)

`app/more/supplier-lineup/page.tsx` (the list page) needs **no change** — its total computation already iterates over all `supplier_lineup_picks` rows and dedupes by `vendor_id` per lineup, regardless of category, so multiple "Other" rows are summed correctly with zero code changes.

## Data model

Current: `UNIQUE (lineup_id, category)` on `supplier_lineup_picks` — at most one row per category per lineup.

New: `UNIQUE (lineup_id, category, vendor_id)` — a category can now have multiple rows, but the same vendor can't be added twice to the same category in the same lineup. This is a pure relaxation: every other category continues to behave as single-pick because the app's existing `pickVendor()` function deletes any existing pick for that category before inserting the new one — the DB no longer needs to enforce that, the app already does.

Migration (drops the old constraint, adds the new one):
```sql
ALTER TABLE supplier_lineup_picks DROP CONSTRAINT supplier_lineup_picks_lineup_id_category_key;
ALTER TABLE supplier_lineup_picks ADD CONSTRAINT supplier_lineup_picks_lineup_category_vendor_key UNIQUE (lineup_id, category, vendor_id);
```

`lib/db/schema.ts`'s Drizzle mirror does not currently model this unique constraint at all (reference-only, no `.unique()` call on the table), so no mirror change is needed.

## Builder page (`app/more/supplier-lineup/[id]/page.tsx`)

**Distinct vendors only:** a vendor already added to "Other" in this lineup is excluded from the picker dialog's eligible list for further "Other" additions — matches the new DB constraint.

**Adding a vendor to "Other":** clicking "+ Add vendor" (or "+ Add another vendor" once at least one exists) opens the same picker dialog used by every other category. Selecting a vendor inserts a new `supplier_lineup_picks` row (no delete-first — that's the single-pick category behavior, not this one) and closes the dialog, exactly like today's single-select flow. To add a second vendor, the user clicks the add link again; the dialog reopens with the just-added vendor no longer in the eligible list.

**Removing a vendor from "Other":** each added vendor gets its own row with its own × remove button — removes only that one pick, the others stay.

**Category list rendering:** every category keeps its current single-pick template (label, picked vendor block with Change/×, or "Choose vendor" / "No vendors added yet"), except "Other", which renders:
- Category label, no "Change" link (there's nothing to "change" — only add/remove).
- Zero or more stacked vendor rows (name, price, contact — same fields as today's single-pick block), each with its own × remove button.
- Below the list (or in place of it, if empty and there are eligible vendors): "+ Add vendor" / "+ Add another vendor" link, same style as today's "Choose vendor" link.
- If there are no eligible "Other" vendors left (none added in Vendor Shortlist, or all already added), show "No vendors added in this category yet" same as today — this message already correctly reflects "no more to add" once all eligible vendors are added.

**State/derived data changes:**
- `picksByCategory` (the existing `Map<category, {pickId, vendor}>`) is built excluding `"other"` rows — it remains the single-pick lookup used by every other category's render branch.
- New `otherPicks: {pickId, vendor}[]` — every pick row where `category === "other"`, vendor-resolved, in insertion order.
- `eligibleByCategory` for `"other"` additionally excludes vendors already present in `otherPicks` (distinct-only). Other categories' eligibility logic is unchanged.
- `totalMin`/`totalMax`/`hasPrice`: restructured to dedupe across single-pick categories (via `picksByCategory`, excluding "other") **plus** every vendor in `otherPicks`, by `vendor.id`, using the same one-Set-of-counted-ids approach already used today — this is the same dedup-by-vendor invariant established for the original multi-category-pick bug fix, just extended to also walk `otherPicks`.
- `uniqueInclusionVendors`: same restructuring — walks `activeCategories` (skipping "other") via `picksByCategory`, then appends any not-yet-seen vendor from `otherPicks` that has inclusions. Order: regular categories in `CATEGORY_ORDER`, then Other vendors in the order they were added.
- The print-only summary block mirrors the interactive view: the "Other" section in print output lists each added vendor as its own line (name, price, contact), instead of the current single line per category.

**New functions:**
- `addOtherVendor(vendor: Vendor)`: inserts `{ lineup_id, category: "other", vendor_id: vendor.id }` (no delete), appends to `picks` state, closes the picker dialog (`setPickerCategory(null)`).
- `removeOtherPick(pickId: string)`: deletes that one row, filters it out of `picks` state.
- The picker dialog's vendor-click handler branches on `pickerCategory === "other"` → call `addOtherVendor`, else → call the existing `pickVendor` (unchanged for every other category).

## Comparison page (`app/more/supplier-lineup/compare/page.tsx`)

`pickMap` is currently `Map<lineup_id, Map<category, vendor_id>>` — one vendor id per category, last-write-wins. This needs to hold a list for "Other": change the inner value type to `string[]` (vendor ids) uniformly — every category naturally has a 1-element array except "Other", which can have N. `cellLabel` joins the resolved vendor names with `", "` (falls back to "—" if the array is empty). `totalLabel`'s dedup-by-vendor loop already iterates `categoryMap.values()`; with values now being arrays, it flattens and continues deduping by vendor id exactly as before — no behavior change to the dedup logic itself, just the value shape it reads.

## Out of scope

- No change to the list page (`app/more/supplier-lineup/page.tsx`) — confirmed above, its totals already work correctly as-is.
- No change to any other category's single-pick behavior or UI.
- No limit on how many "Other" vendors can be added (bounded naturally by how many vendors are tagged "Other" in the Vendor Shortlist).
