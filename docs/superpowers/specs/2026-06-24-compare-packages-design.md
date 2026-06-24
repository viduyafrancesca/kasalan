# Compare Packages — Design Spec

## Purpose

Couples shortlist multiple vendors per category (e.g. 3 caterers) but currently have no way to see them side-by-side. This feature adds a read-only comparison view so a couple can weigh price, status, contact, notes, and what's included across vendors in the same category before deciding who to book.

## Scope

- Compare **vendors within the same category** against each other (not a single vendor's own package tiers — out of scope).
- Read-only view. All editing continues to happen on the existing Vendors page (`app/more/vendors/page.tsx`).
- Declined vendors are excluded from comparison — they're no longer live options.

## Data Model Change

Add one column to the existing `vendors` table:

```sql
ALTER TABLE vendors ADD COLUMN inclusions text[] NOT NULL DEFAULT '{}';
```

`inclusions` is a flat list of short free-text tags entered per vendor (e.g. "Free parking", "Includes tables and chairs"). No new table — this is an additional attribute on a vendor, alongside the existing `price_range_min`, `price_range_max`, `status`, `contact`, and `notes`.

As with every schema change in this project: the SQL is written to a dated file under `supabase/migrations/` (gitignored, never committed) for the user to run manually in the Supabase SQL editor. No code that depends on the new column ships until the user confirms the migration has been run.

`lib/db/schema.ts`'s `vendors` table mirror gets the matching field added as housekeeping (reference-only, not imported by runtime code).

## Vendor Form Change

In the existing Add/Edit Vendor dialog (`app/more/vendors/page.tsx`), add an "Inclusions" field below Notes:

- A text input + "Add" button (or Enter key) appends the typed value as a tag.
- Tags render as removable badges underneath the input (× to remove).
- Stored as `string[]` in form state, sent as `inclusions` in the insert/update payload.
- Empty list is valid (existing vendors default to `[]` via the column default; no backfill needed since `NOT NULL DEFAULT '{}'` covers them).

## Compare Packages Page

**New route:** `app/more/compare/page.tsx`

**Navigation:** New entry in the More hub (`app/more/page.tsx`), positioned between "Vendor Shortlist" and "Share".

**Behavior:**

1. On load, fetch the wedding's vendors and hidden categories (same pattern as the Vendors page).
2. Build the active category list via the existing `getActiveCategories()` helper.
3. For each active category, compute its **comparable vendor set** = vendors in that category with `status !== "declined"`.
4. Category picker: horizontally-scrollable pill tabs, one per active category. Default selection = the first category (in `CATEGORY_ORDER`) whose comparable vendor set has 2+ vendors. If none qualify, default to the first active category and show the empty state (see below).
5. For the selected category:
   - If comparable vendor set has fewer than 2 vendors: show an empty state — "Add at least 2 vendors in this category to compare" with a link back to `/more/vendors`.
   - Otherwise render the comparison table.

**Comparison table layout** (mobile-first, matches the approved ASCII mockup):

- Two-axis grid: a sticky left label column, and one column per comparable vendor that scrolls horizontally (the label column stays fixed via CSS `position: sticky; left: 0` while vendor columns scroll in a horizontally-scrollable container).
- Row order, top to bottom:
  1. Vendor name (header row)
  2. Price range (formatted via existing `formatPHP`, same min–max format as the Vendors page)
  3. Status (badge, reusing `STATUS_VARIANT`/`STATUS_OPTIONS` styling conventions from the Vendors page)
  4. Contact
  5. Notes
  6. A visual divider, then an "INCLUSIONS" section header row
  7. One row per inclusion tag — the **union** of every inclusion tag across all comparable vendors in this category, alphabetized. Each vendor's column shows ✓ if that vendor has the tag, — otherwise.
- If no comparable vendor in the category has any inclusions at all, the Inclusions section is omitted entirely (no empty divider/header with zero rows).
- Entirely read-only: no tap targets, no edit affordances. Vendor names are plain text, not links.

## Out of Scope

- Comparing a single vendor's own multiple package tiers (e.g. Silver/Gold/Platinum from one supplier) — vendors remain a single price range + single inclusions list per row.
- Cross-category comparison (e.g. comparing a caterer against a photographer).
- Editing vendors from this page.
- Exporting or sharing the comparison view.
