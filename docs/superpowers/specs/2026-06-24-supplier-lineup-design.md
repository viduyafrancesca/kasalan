# Supplier Lineup — Design Spec

## Purpose

A couple shortlists multiple vendors per category, but has no way to assemble a hypothetical *whole-wedding* lineup — one vendor per category — see the combined estimated cost and what's included, save that combination, and print it (or save it as a PDF) for reference or sharing.

## Scope

- Build a **lineup**: at most one vendor picked per category, picks optional per category (a category can be left blank).
- Multiple **named lineups** can be saved per wedding (e.g. "Budget option", "Dream option") and switched between.
- Picks are drawn only from vendors with `status !== "declined"`.
- Export is via the browser's native print dialog (which offers "Save as PDF" on every platform) — no PDF-generation library, no new dependency.
- Picking a vendor into a lineup does **not** change that vendor's `status` on the Vendors page — a lineup is a planning/combination tool, separate from the vendor's own booking status.
- A vendor tagged with multiple categories (e.g. Vendor A does both photography and styling) can be picked into **more than one category slot** in the same lineup — once for Photography, once for Styling — since the uniqueness constraint is per category slot, not per vendor. Picking it for one slot does **not** automatically fill its other eligible slots; each slot's pick is a separate, independent action (the "auto-fill other categories" behavior is what's out of scope below, not multi-slot picking itself).
- Out of scope: auto-filling other categories a multi-category vendor belongs to just because it was picked for one of them (picking it into Photography does not automatically also place it into Styling — that still requires picking it there explicitly); editing vendor details from this feature (still done on the Vendors page); merging/diffing two lineups against each other.

## Data Model

Two new tables, RLS-protected the same way every other wedding-scoped table is (per the 2026-06-19 RLS rollout — both get policies using `is_wedding_member()`):

```sql
CREATE TABLE supplier_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_lineup_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id uuid NOT NULL REFERENCES supplier_lineups(id) ON DELETE CASCADE,
  category text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE (lineup_id, category)
);

ALTER TABLE supplier_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_lineup_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_lineups_select ON supplier_lineups
  FOR SELECT USING (is_wedding_member(wedding_id));
CREATE POLICY supplier_lineups_insert ON supplier_lineups
  FOR INSERT WITH CHECK (is_wedding_member(wedding_id));
CREATE POLICY supplier_lineups_update ON supplier_lineups
  FOR UPDATE USING (is_wedding_member(wedding_id)) WITH CHECK (is_wedding_member(wedding_id));
CREATE POLICY supplier_lineups_delete ON supplier_lineups
  FOR DELETE USING (is_wedding_member(wedding_id));

CREATE POLICY supplier_lineup_picks_select ON supplier_lineup_picks
  FOR SELECT USING (
    is_wedding_member((SELECT wedding_id FROM supplier_lineups WHERE id = lineup_id))
  );
CREATE POLICY supplier_lineup_picks_insert ON supplier_lineup_picks
  FOR INSERT WITH CHECK (
    is_wedding_member((SELECT wedding_id FROM supplier_lineups WHERE id = lineup_id))
  );
CREATE POLICY supplier_lineup_picks_update ON supplier_lineup_picks
  FOR UPDATE USING (
    is_wedding_member((SELECT wedding_id FROM supplier_lineups WHERE id = lineup_id))
  ) WITH CHECK (
    is_wedding_member((SELECT wedding_id FROM supplier_lineups WHERE id = lineup_id))
  );
CREATE POLICY supplier_lineup_picks_delete ON supplier_lineup_picks
  FOR DELETE USING (
    is_wedding_member((SELECT wedding_id FROM supplier_lineups WHERE id = lineup_id))
  );
```

The `UNIQUE (lineup_id, category)` constraint on `supplier_lineup_picks` enforces "at most one vendor per category per lineup" at the database level. Picking a new vendor for a category that already has a pick is an upsert on that constraint (delete the existing row for that `lineup_id` + `category`, then insert the new one — simplest given the Supabase client's `upsert` requires the conflict target match the actual unique constraint, which this satisfies).

As with every schema change in this project: this SQL is written to a dated file under `supabase/migrations/` (gitignored, never committed) for the user to run manually. No application code that reads/writes these tables ships until the user confirms the migration has run. `lib/db/schema.ts` gets both tables mirrored as housekeeping.

## Supplier Lineup List Page

**New route:** `app/more/supplier-lineup/page.tsx`

**Navigation:** New entry in the More hub (`app/more/page.tsx`), positioned between "Compare Packages" and "Share".

**Behavior:**

- On load, fetch all `supplier_lineups` for the wedding, plus their picks joined with `vendors` (for price totals).
- Render each lineup as a card: name, a combined estimated total (sum of `price_range_min` / sum of `price_range_max` across every **unique vendor** currently picked anywhere in the lineup — a vendor occupying multiple category slots is counted once, since its price range represents one payment regardless of how many slots it fills; categories with no pick aren't counted; if no picks have any price set, show "—"), the lineup's `created_at` date, and a delete (trash icon) button with a confirm step.
- Tapping a card's body (not the delete button) navigates to `app/more/supplier-lineup/[id]`.
- A "+ New Lineup" button opens a small dialog with a single text input ("Lineup name", e.g. "Budget option"); on confirm, inserts a new `supplier_lineups` row and navigates straight into its builder page.
- Empty state ("No lineups yet — create one to start comparing a full wedding combination") when there are none.

## Supplier Lineup Builder Page

**New route:** `app/more/supplier-lineup/[id]/page.tsx`

**Behavior:**

1. Load the lineup by `id` (404/redirect back to the list if not found or not owned by this wedding — RLS will simply return no row).
2. Load the wedding's active categories (`getActiveCategories`, same as Vendors/Compare pages) and all its non-declined vendors.
3. Load this lineup's existing picks (`supplier_lineup_picks` joined with `vendors`), keyed by category.
4. **Header:** back link to the list, an editable name field (plain text input, pre-filled with the lineup's current name, saves via an update on blur — no separate "Save" button for the name).
5. **Total banner:** "Estimated total: ₱X – ₱Y" computed by summing `price_range_min` and `price_range_max` once per **unique vendor** picked anywhere in the lineup (not once per category slot — a vendor filling two slots, e.g. a venue+catering package, is still one payment). If zero picks have any price, show "Add vendors to see an estimated total" instead.
6. **Category rows**, one per active category, in `CATEGORY_ORDER`:
   - **Picked:** vendor name, price range (same formatting as the Vendors/Compare pages), contact, inclusion tags (same chip style as the Vendors dialog), a "Change" button (reopens the picker) and a "✕" button (deletes that category's pick row).
   - **Unpicked, vendors available:** a "Choose vendor" button opens a picker dialog listing every vendor in that category with `status !== "declined"` (name, price range, status badge); tapping one upserts the pick for that category (delete any existing pick row for this `lineup_id` + `category`, insert the new one) and closes the dialog.
   - **Unpicked, no eligible vendors:** static text "No vendors added in this category yet" (no button) — matches the empty-state tone used elsewhere (e.g. Compare page).
7. **Print / Save as PDF button** at the bottom: calls `window.print()`. A print-only stylesheet (Tailwind `print:hidden` on the header/nav/buttons, `print:block` on a dedicated printable summary block) renders just the lineup name, the per-category picks (name, price, contact, inclusions), and the total — suitable for the browser's native print-to-PDF.

## Out of Scope

- PDF-generation library / direct downloadable `.pdf` file — browser print only.
- Auto-syncing a lineup pick back to the vendor's own `status` field.
- Cross-lineup comparison or diffing.
- Sharing a lineup via a public link (the existing share-token flow is unrelated and untouched).
