# Budget expense: vendor-link autofill, required paid amount, payment date

## Problem

The "Link to vendor" feature on budget expenses (added in the fluid-categories
work) lets a user pick a vendor but doesn't use any of that vendor's pricing
data, doesn't require recording what was actually paid, and has no way to
record *when* a payment was made (the existing `due_date` column means
something different — when a payment is owed, not when it happened).

## Changes

**Estimated autofill.** When a vendor is selected in the expense dialog
(switching into "Link to vendor" mode, or changing the vendor dropdown while
already linked), the Estimated field is set to that vendor's
`price_range_max`. If the vendor has no max price, Estimated is left
untouched. The field remains a normal editable input afterward — autofill
only sets an initial value, it doesn't lock the field.

**Required paid amount.** The Save button is disabled until Paid has a value
(including an explicit `0`) — applies to every expense, manual or
vendor-linked.

**Payment date.** New `paid_date` column on `budget_items` (date, nullable in
the DB). A new "Payment date" field in the expense dialog, required (Save
disabled without it), defaulting to today's date when adding a new expense.
Existing rows have `paid_date = null` and are grandfathered — the required
rule only kicks in the next time that row is edited and saved through the
form; no backfill is performed.

## UI changes (`app/budget/page.tsx`)

- Form state gains `paid_date: string` (YYYY-MM-DD).
- `openAdd()` defaults `paid_date` to today.
- `openEdit()` defaults `paid_date` to the item's stored value, or today if
  null.
- Vendor `<select>`'s `onChange` also sets Estimated from the newly selected
  vendor's `price_range_max` (only if it has one).
- New date `<Input type="date">` field, labeled "Payment date", placed next
  to Paid in the existing two-column grid.
- Save button's `disabled` condition gains `|| !form.paid || !form.paid_date`
  (paid amount and payment date both required; `form.paid` empty string is
  falsy, `"0"` is truthy as a string so an explicit zero still passes).
- `saveExpense()` payload includes `paid_date: form.paid_date || null`.

This requires the vendor list fetched in `load()` to include `price_range_max`
(currently only `id, name, categories` are selected).

## Data model

`lib/db/schema.ts` — `budgetItems` gains:

```ts
paidDate: date("paid_date"),
```

## Migration (run by hand in Supabase SQL editor)

```sql
ALTER TABLE budget_items ADD COLUMN paid_date date;
```

## Out of scope

- Backfilling `paid_date` for existing rows.
- Making `paid_date` `NOT NULL` at the DB level (enforced only in the UI, to
  avoid breaking existing rows).
