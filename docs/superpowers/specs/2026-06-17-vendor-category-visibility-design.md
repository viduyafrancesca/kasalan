# Vendor category visibility (always-shown sections + hide/restore)

## Problem

The vendors page only renders a category section when at least one vendor
is tagged with it (`grouped.filter((g) => g.items.length > 0)`), so there's
no way to see which categories you haven't shopped for yet. The Sponsors
page solves this for entourage roles by always rendering every role
section, with an empty-state placeholder when nobody's been added.
Categories are also subjective per couple — not everyone needs
"Invitations" or "Attire" as a vendor category — so once they're always
visible, there needs to be a way to hide ones that don't apply.

## Data model

`weddings` gains a new column:

```ts
hiddenVendorCategories: vendorCategoryEnum("hidden_vendor_categories").array().notNull().default([]),
```

`lib/categories.ts` gains a shared helper, the single source of truth for
"which categories does this wedding actually use":

```ts
export function getActiveCategories(hidden: VendorCategory[]): VendorCategory[] {
  return CATEGORY_ORDER.filter((c) => !hidden.includes(c));
}
```

## Vendors page (`app/more/vendors/page.tsx`)

- Fetches `wedding.hidden_vendor_categories` and computes
  `activeCategories = getActiveCategories(hidden)`.
- Renders a section for **every** active category, in `CATEGORY_ORDER`,
  regardless of vendor count. A category with zero vendors shows the same
  empty-state placeholder pattern Sponsors uses: a dashed-border card with
  "No vendor added yet."
- Each section header gets a small hide button (trash/eye-off icon) next to
  the existing "Add" link. Clicking it:
  - If any vendor currently has that category in its `categories` array,
    the action is blocked — the button is disabled and a hint explains why
    ("Retag or remove vendors in this category first").
  - Otherwise, it appends the category to `hidden_vendor_categories` and
    re-renders without that section.
- A "Hidden categories" strip renders at the bottom of the page, only when
  `hidden_vendor_categories` is non-empty: each hidden category appears as
  a small chip with a "+ restore" action that removes it from
  `hidden_vendor_categories`, bringing its section back.
- The Add/Edit vendor dialog's category chip picker only offers
  `activeCategories` (a hidden category can't be tagged onto a vendor
  without restoring it first).

## Budget page (`app/budget/page.tsx`)

- Fetches the wedding's `hidden_vendor_categories` alongside its existing
  queries.
- The manual-category `<select>` (used when an expense isn't linked to a
  vendor) lists `getActiveCategories(hidden)` instead of the full
  `CATEGORY_ORDER`.

## Dashboard (`app/dashboard/page.tsx`, `lib/dashboardReminders.ts`)

- `buildVendorGapReminder` changes signature to accept the active
  categories list explicitly, rather than reading the full `CATEGORY_ORDER`
  internally:

  ```ts
  export function buildVendorGapReminder(vendors: VendorRow[], activeCategories: VendorCategory[]): Reminder | null
  ```

- The dashboard page computes `activeCategories` from the wedding's
  `hidden_vendor_categories` (fetched alongside the existing wedding row)
  and passes it in, so a hidden category is never reported as a gap.

## Migration (run by hand in Supabase SQL editor)

```sql
ALTER TABLE weddings ADD COLUMN hidden_vendor_categories vendor_category[] NOT NULL DEFAULT '{}';
```

## Out of scope

- Custom/freeform categories beyond the 13 canonical ones (hiding only
  removes from view; it doesn't let you invent new categories).
- Reordering categories — display order stays `CATEGORY_ORDER`'s fixed
  sequence regardless of what's hidden.
