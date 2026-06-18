export type BudgetItemLike = {
  estimated_amount: string;
  paid_amount: string;
  vendor_id: string | null;
};

export type VendorStatusLike = {
  id: string;
  status: string;
};

export type BudgetTotals = {
  paid: number;
  committed: number;
  outstanding: number;
  remaining: number;
};

export function isFinalCommitment(item: BudgetItemLike, vendors: VendorStatusLike[]): boolean {
  if (!item.vendor_id) return true;
  return vendors.find((v) => v.id === item.vendor_id)?.status === "booked";
}

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
