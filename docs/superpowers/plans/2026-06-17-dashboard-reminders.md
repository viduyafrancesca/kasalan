# Dashboard Reminders Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Reminders" section to the dashboard summarizing upcoming vendor payments, pending RSVPs, unconfirmed entourage members, and vendor categories with no booked vendor — each as one line, only shown when relevant.

**Architecture:** A new pure module `lib/dashboardReminders.ts` holds one builder function per reminder type, each taking already-fetched rows and returning a `Reminder | null`. `app/dashboard/page.tsx` (a server component) fetches the extra rows these builders need inside its existing `Promise.all`, calls the builders, filters out nulls, and renders the result as a list of link rows.

**Tech Stack:** Next.js 16 (App Router, server components), Supabase JS client, TypeScript. No test runner exists in this project — verification is `npx tsc --noEmit` per task and `npm run build` at the end, same as prior plans this session.

## Global Constraints

- DB schema changes: none required — this feature only reads existing columns (`budget_items.due_date`, `budget_items.vendor_id`, `sponsors.confirmed`, `vendors.categories`, `vendors.status`).
- No comments in code unless explaining a non-obvious constraint.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.
- The existing `budgetItems` query in `app/dashboard/page.tsx` (used for the "Budget Left" stat card's `totalSpent` calculation) must keep fetching **all** budget items, unfiltered by `due_date` — the new due-date-filtered query is a separate, additional query, not a replacement.

---

### Task 1: Reminder builder functions

**Files:**
- Create: `lib/dashboardReminders.ts`

**Interfaces:**
- Produces: `Reminder` type, `DueBudgetRow` type, `VendorRow` type, `buildPaymentReminder()`, `buildRsvpReminder()`, `buildEntourageReminder()`, `buildVendorGapReminder()` — all consumed by Task 2.

- [ ] **Step 1: Create `lib/dashboardReminders.ts`**

```ts
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
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

export function buildVendorGapReminder(vendors: VendorRow[]): Reminder | null {
  const gaps = CATEGORY_ORDER.filter(
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboardReminders.ts
git -c commit.gpgsign=false commit -m "Add dashboard reminder builder functions"
```

---

### Task 2: Wire reminders into the dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `Reminder`, `DueBudgetRow`, `VendorRow`, `buildPaymentReminder`, `buildRsvpReminder`, `buildEntourageReminder`, `buildVendorGapReminder` from `@/lib/dashboardReminders` (Task 1).

- [ ] **Step 1: Extend the `Promise.all` with the new queries**

Replace:

```tsx
  const [
    { count: totalTasks },
    { count: doneTasks },
    { data: budgetItems },
    { count: attendingGuests },
    { count: confirmedSponsors },
    { data: upNext },
  ] = await Promise.all([
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("completed", true),
    supabase.from("budget_items").select("estimated_amount, paid_amount").eq("wedding_id", wedding.id),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "attending"),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("confirmed", true),
    supabase.from("checklist_items")
      .select("id, title, category, months_before")
      .eq("wedding_id", wedding.id)
      .eq("completed", false)
      .order("months_before", { ascending: true })
      .limit(4),
  ]);
```

with:

```tsx
  const [
    { count: totalTasks },
    { count: doneTasks },
    { data: budgetItems },
    { data: dueBudgetItems },
    { count: attendingGuests },
    { count: pendingGuests },
    { count: confirmedSponsors },
    { data: unconfirmedSponsors },
    { data: vendors },
    { data: upNext },
  ] = await Promise.all([
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("completed", true),
    supabase.from("budget_items").select("estimated_amount, paid_amount").eq("wedding_id", wedding.id),
    supabase.from("budget_items").select("label, due_date, estimated_amount, paid_amount, vendor_id").eq("wedding_id", wedding.id).not("due_date", "is", null),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "attending"),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "pending"),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("confirmed", true),
    supabase.from("sponsors").select("name").eq("wedding_id", wedding.id).eq("confirmed", false),
    supabase.from("vendors").select("id, name, categories, status").eq("wedding_id", wedding.id),
    supabase.from("checklist_items")
      .select("id, title, category, months_before")
      .eq("wedding_id", wedding.id)
      .eq("completed", false)
      .order("months_before", { ascending: true })
      .limit(4),
  ]);
```

- [ ] **Step 2: Import the reminder builders and build the list**

Replace:

```tsx
import { CountdownBanner } from "@/components/shared/CountdownBanner";
import { StatCard } from "@/components/shared/StatCard";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";
```

with:

```tsx
import { CountdownBanner } from "@/components/shared/CountdownBanner";
import { StatCard } from "@/components/shared/StatCard";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";
import {
  type Reminder, type DueBudgetRow, type VendorRow,
  buildPaymentReminder, buildRsvpReminder, buildEntourageReminder, buildVendorGapReminder,
} from "@/lib/dashboardReminders";
```

Replace:

```tsx
  const totalBudget = Number(wedding.budget_total ?? 0);
  const totalSpent  = (budgetItems ?? []).reduce((s, b) => s + Number(b.paid_amount ?? 0), 0);
  const remaining   = totalBudget - totalSpent;
```

with:

```tsx
  const totalBudget = Number(wedding.budget_total ?? 0);
  const totalSpent  = (budgetItems ?? []).reduce((s, b) => s + Number(b.paid_amount ?? 0), 0);
  const remaining   = totalBudget - totalSpent;

  const reminders = [
    buildPaymentReminder((dueBudgetItems ?? []) as DueBudgetRow[], (vendors ?? []) as VendorRow[]),
    buildRsvpReminder(pendingGuests ?? 0),
    buildEntourageReminder((unconfirmedSponsors ?? []).map((s) => s.name)),
    buildVendorGapReminder((vendors ?? []) as VendorRow[]),
  ].filter((r): r is Reminder => r !== null);
```

- [ ] **Step 3: Render the Reminders section**

Replace:

```tsx
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={confirmedSponsors ?? 0} label="Sponsors" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Up Next</h2>
```

with:

```tsx
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={confirmedSponsors ?? 0} label="Sponsors" />
        </div>

        {reminders.length > 0 && (
          <div>
            <h2 className="font-display text-lg mb-3">Reminders</h2>
            <div className="space-y-2">
              {reminders.map((r) => (
                <Link
                  key={r.key}
                  href={r.href}
                  className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <p className="text-sm font-medium">{r.text}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Up Next</h2>
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git -c commit.gpgsign=false commit -m "Add Reminders panel to dashboard"
```

---

### Task 3: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Manually verify in the browser**

Tell the user to check: a wedding with an overdue or soon-due unpaid budget item, a pending RSVP, an unconfirmed sponsor, and a vendor category with no booked vendor should show all four reminder lines; clearing all four conditions should make the Reminders section disappear entirely. No manual SQL migration is needed for this feature — push to GitHub and redeploy to Vercel once verified.
