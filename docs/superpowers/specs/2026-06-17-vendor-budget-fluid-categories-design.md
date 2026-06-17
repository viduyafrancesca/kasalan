# Fluid vendor & budget categories

## Problem

`vendors.category` is a single fixed enum value per vendor. Real vendors often
sell bundled packages (e.g. one venue quote that includes reception styling
and catering), which today forces picking one category and losing the rest.

`budget_items.category` is a separate free-text list that has already drifted
from the vendor category list (different labels, different members), and
`budget_items.vendor_id` exists in the schema but is unused — expenses can't
be tied to a vendor at all.

## Data model changes

**Shared category list** (new canonical source, used by both vendors and
budget): `venue, catering, photography, videography, flowers, hair_makeup,
styling, attire, sounds_lights, cake, invitations, transportation, other`.

This adds `attire` and `invitations` to the existing vendor category enum and
replaces budget's local, drifted `CATEGORIES` string array.

**`vendors` table**: `category` (single enum) → `categories` (non-empty enum
array). A vendor can now be tagged with multiple categories. Price stays a
single min/max range for the whole package — no change to those columns.

**`budget_items` table**: `vendor_id` becomes a real FK to `vendors.id`
(`ON DELETE SET NULL`). `category` becomes nullable — required when
`vendor_id` is null, ignored when an expense is linked to a vendor.

## Vendor page (`app/more/vendors/page.tsx`)

- Add/Edit dialog: replace the single category `<select>` with a multi-select
  chip grid (same pill pattern as Status). At least one category must be
  selected to save.
- Grouped list: a vendor renders under **every** category section it's tagged
  with — same card, same status/price/notes, repeated per section. This is
  how a package vendor becomes visible under Venue, Styling, and Catering at
  once.
- Per-section "Add" button still pre-fills that one category in the new
  vendor's chip selection; the user can add more before saving.

## Budget page (`app/budget/page.tsx`)

- Add/Edit expense dialog gains a two-way toggle:
  - **Manual category** (today's behavior) — dropdown from the shared
    category list.
  - **Link to vendor** — picker listing this wedding's vendors (name + their
    category chips). Selecting one sets `vendor_id` and clears `category`.
- Grouping logic: the group key is always the category **label** text (as
  today). For a linked expense, its effective labels are its vendor's
  `categories` mapped through the shared slug→label table (the line appears
  once per category section, mirroring vendor display). For an unlinked
  expense, its effective label is its own `category` field, unchanged from
  today.
- Existing unlinked expenses keep working, with one exception: stored value
  `"Beauty"` is renamed to `"Hair & Makeup"` (see migration) so it keeps
  matching the renamed shared category and doesn't silently disappear from
  the grouped view.

## Migration (run by hand in Supabase SQL editor)

```sql
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'attire';
ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'invitations';

ALTER TABLE vendors ADD COLUMN categories vendor_category[] NOT NULL DEFAULT '{}';
UPDATE vendors SET categories = ARRAY[category];
ALTER TABLE vendors ALTER COLUMN categories DROP DEFAULT;
ALTER TABLE vendors DROP COLUMN category;

ALTER TABLE budget_items ALTER COLUMN category DROP NOT NULL;
ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

UPDATE budget_items SET category = 'Hair & Makeup' WHERE category = 'Beauty';
```

## Out of scope

- Per-category price breakdown within a package (single package price range
  only, per existing decision).
- Migrating existing budget items' free-text categories beyond the single
  `Beauty` → `Hair & Makeup` rename above; all other stored values already
  match the new shared list's labels exactly.
