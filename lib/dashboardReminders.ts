import { type VendorCategory, CATEGORY_LABELS } from "@/lib/categories";
import { formatPHP } from "@/lib/utils";

export type Reminder = { key: string; text: string; href: string };

export type DueBudgetRow = {
  label: string;
  due_date: string | null;
  estimated_amount: string;
  paid_amount: string;
  vendor_id: string | null;
};

export type VendorRow = {
  id: string;
  name: string;
  categories: VendorCategory[];
  status: string;
};

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dueDatePhrase(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "due today";
  return `in ${days} days`;
}

export function buildPaymentReminder(budgetItems: DueBudgetRow[], vendors: VendorRow[]): Reminder | null {
  const due = budgetItems
    .filter((b) => b.due_date && Number(b.paid_amount) < Number(b.estimated_amount))
    .map((b) => ({ ...b, days: daysUntil(b.due_date as string) }))
    .filter((b) => b.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (due.length === 0) return null;

  const first = due[0];
  const subject = first.vendor_id
    ? vendors.find((v) => v.id === first.vendor_id)?.name ?? first.label
    : first.label;
  const amount = formatPHP(Number(first.estimated_amount) - Number(first.paid_amount));
  const more = due.length > 1 ? ` +${due.length - 1} more` : "";

  return {
    key: "payment",
    text: `${amount} due to ${subject} ${dueDatePhrase(first.days)}${more}`,
    href: "/budget",
  };
}

export function buildRsvpReminder(pendingCount: number): Reminder | null {
  if (pendingCount === 0) return null;
  return {
    key: "rsvp",
    text: `${pendingCount} RSVP${pendingCount === 1 ? "" : "s"} still pending`,
    href: "/guests",
  };
}

export function buildEntourageReminder(names: string[]): Reminder | null {
  if (names.length === 0) return null;
  const shown = names.slice(0, 2).join(", ");
  const more = names.length > 2 ? ` +${names.length - 2} more` : "";
  const verb = names.length === 1 ? "hasn't" : "haven't";
  return {
    key: "entourage",
    text: `${shown}${more} ${verb} confirmed yet`,
    href: "/more/sponsors",
  };
}

export function buildVendorGapReminder(vendors: VendorRow[], activeCategories: VendorCategory[]): Reminder | null {
  const gaps = activeCategories.filter(
    (cat) => !vendors.some((v) => v.categories.includes(cat) && v.status === "booked")
  );
  if (gaps.length === 0) return null;
  const labels = gaps.map((c) => CATEGORY_LABELS[c]);
  const shown = labels.slice(0, 2).join(", ");
  const more = labels.length > 2 ? ` +${labels.length - 2} more` : "";
  return {
    key: "vendor-gap",
    text: `No vendor booked yet for ${shown}${more}`,
    href: "/more/vendors",
  };
}
