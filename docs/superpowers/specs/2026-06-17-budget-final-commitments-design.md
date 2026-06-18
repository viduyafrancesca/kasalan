# Budget: commitments vs. cash paid

## Problem

"Budget Left" (dashboard) and "Remaining" (Budget page) only subtract
`paid_amount` from the total budget. A ₱200k venue with a ₱50k downpayment
still shows ₱150k as "available," even though that money is already
committed to the venue and isn't really free to spend elsewhere. The fix
must also not over-count: a vendor that's merely "interested" or
"shortlisted" isn't a real commitment yet, and shouldn't reduce the
available budget until it's actually booked. Manual expenses (no linked
vendor) are always treated as final — there's no vendor status to gate on,
and typing in a budget line is itself a decision.

## Shared logic — `lib/budget.ts` (new file)

A single function both the dashboard and the Budget page call, so the
"what counts as committed" rule lives in exactly one place:

```ts
type BudgetItemLike = { estimated_amount: string; paid_amount: string; vendor_id: string | null };
type VendorStatusLike = { id: string; status: string };

export function isFinalCommitment(item: BudgetItemLike, vendors: VendorStatusLike[]): boolean {
  if (!item.vendor_id) return true;
  return vendors.find((v) => v.id === item.vendor_id)?.status === "booked";
}

export type BudgetTotals = { paid: number; committed: number; outstanding: number; remaining: number };

export function computeBudgetTotals(
  items: BudgetItemLike[],
  vendors: VendorStatusLike[],
  totalBudget: number
): BudgetTotals {
  const paid = items.reduce((s, i) => s + Number(i.paid_amount), 0);
  const finalItems = items.filter((i) => isFinalCommitment(i, vendors));
  const committed = finalItems.reduce((s, i) => s + Number(i.estimated_amount), 0);
  const paidOnFinal = finalItems.reduce((s, i) => s + Number(i.paid_amount), 0);
  const outstanding = committed - paidOnFinal;
  const remaining = totalBudget - committed;
  return { paid, committed, outstanding, remaining };
}
```

- `paid` is cash actually spent, across every expense regardless of vendor
  status — money already spent is a fact, not a projection.
- `committed` only sums `estimated_amount` for "final" items (no vendor, or
  vendor status `booked`). Tentative vendor options never count.
- `outstanding` is what's still owed on those same final items — the gap
  between what you've committed to and what you've actually paid them.
- `remaining` is the total budget minus committed — the honest "safe to
  allocate elsewhere" number.

## Dashboard (`app/dashboard/page.tsx`)

- The main `budgetItems` query gains `vendor_id` in its `select` (currently
  `estimated_amount, paid_amount` only).
- The existing `vendors` query already selects `status` (used today by the
  vendor-gap reminder) — reused here, no new query.
- `totalSpent`/`remaining` calculation is replaced by a call to
  `computeBudgetTotals(budgetItems, vendors, totalBudget)`; the "Budget
  Left" `StatCard` uses `.remaining` from the result.

## Budget page (`app/budget/page.tsx`)

- The `vendors` query gains `status` in its `select` (currently
  `id, name, categories, price_range_max`).
- The header's Total/Paid/Remaining row becomes four figures, in this
  order: **Total, Paid, Outstanding, Remaining** — computed via the same
  `computeBudgetTotals` call.
- Layout changes from `grid-cols-3` to `grid-cols-2` (2×2) on mobile, with
  a 4-across row at the `sm` breakpoint and up — avoiding the cramped-card
  overflow problem already fixed once this session for a 3-column row.
- If no total budget is set (`totalBudget <= 0`), Remaining displays "—"
  (same convention the Total figure already uses in that case) — there's
  no ceiling to subtract `committed` from.
- "Paid" keeps its existing unfiltered meaning (sum of `paid_amount` across
  every expense); "Outstanding" and "Remaining" both apply the
  final-commitment filter.

## Out of scope

- Any change to how an individual expense row displays in the per-category
  list further down the Budget page — this only touches the header
  summary figures and the dashboard stat card.
- A way to mark a *manual* (unlinked) expense as "tentative" — per the
  approved design, manual expenses are always final.
