# Vendor Category Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every vendor category as an always-visible section (like Sponsors does for roles), and let a couple hide categories that don't apply to them — with hiding blocked while a vendor still uses that category, and a restore path for hidden ones.

**Architecture:** A new `hidden_vendor_categories` array column on `weddings` stores per-wedding hidden categories. A new `getActiveCategories(hidden)` helper in `lib/categories.ts` is the single source of truth for "categories this wedding actually uses," consumed by the vendors page (main UI), the budget page (manual-category dropdown), and the dashboard (vendor-gap reminder).

**Tech Stack:** Next.js 16 (App Router), Supabase JS client, TypeScript. No test runner exists in this project — verification is `npx tsc --noEmit` per task and `npm run build` at the end, same as every prior plan this session.

## Global Constraints

- DB schema changes are applied by hand in Supabase's SQL editor by the user — never run migrations automatically.
- No comments in code unless explaining a non-obvious constraint.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.
- Hiding a category is blocked (not destroyed-with-confirmation) while any vendor still carries that category tag — per the approved design, this is enforced by disabling the hide button, not a confirmation dialog.
- Hidden categories are restorable — never permanently deleted from the canonical `CATEGORY_ORDER` list.
- Delete unused imports when a change removes the last usage in a file (e.g. `CATEGORY_ORDER` in files that switch fully to `getActiveCategories`).

---

### Task 1: Schema column + shared active-categories helper

**Files:**
- Modify: `lib/db/schema.ts` (`weddings` table)
- Modify: `lib/categories.ts`

**Interfaces:**
- Produces: `weddings.hidden_vendor_categories` (DB column), `getActiveCategories(hidden: VendorCategory[]): VendorCategory[]` — consumed by Tasks 2, 3, and 4.

- [ ] **Step 1: Add `hiddenVendorCategories` to the `weddings` table**

In `lib/db/schema.ts`, replace:

```ts
export const weddings = pgTable("weddings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  ownerId:          uuid("owner_id").notNull(),
  coupleName1:      text("couple_name_1").notNull(),
  coupleName2:      text("couple_name_2").notNull(),
  weddingDate:      date("wedding_date"),
  ceremonyVenue:    text("ceremony_venue"),
  receptionVenue:   text("reception_venue"),
  budgetTotal:      numeric("budget_total", { precision: 12, scale: 2 }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

with:

```ts
export const weddings = pgTable("weddings", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  ownerId:                uuid("owner_id").notNull(),
  coupleName1:            text("couple_name_1").notNull(),
  coupleName2:            text("couple_name_2").notNull(),
  weddingDate:            date("wedding_date"),
  ceremonyVenue:          text("ceremony_venue"),
  receptionVenue:         text("reception_venue"),
  budgetTotal:            numeric("budget_total", { precision: 12, scale: 2 }),
  hiddenVendorCategories: vendorCategoryEnum("hidden_vendor_categories").array().notNull().default([]),
  createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Add `getActiveCategories` to `lib/categories.ts`**

Append to the end of `lib/categories.ts`:

```ts

export function getActiveCategories(hidden: VendorCategory[]): VendorCategory[] {
  return CATEGORY_ORDER.filter((c) => !hidden.includes(c));
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts lib/categories.ts
git -c commit.gpgsign=false commit -m "Add hidden_vendor_categories column and getActiveCategories helper"
```

- [ ] **Step 5: Record the manual SQL migration for the user**

Surface this at the end of this plan's execution — do not run it automatically:

```sql
ALTER TABLE weddings ADD COLUMN hidden_vendor_categories vendor_category[] NOT NULL DEFAULT '{}';
```

---

### Task 2: Vendors page — always-visible sections, hide/restore

**Files:**
- Modify: `app/more/vendors/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories` (Task 1).

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
```

with:

```tsx
import { type VendorCategory, CATEGORY_LABELS, getActiveCategories } from "@/lib/categories";
import { EyeOff } from "lucide-react";
```

(The existing `import { Plus } from "lucide-react";` line stays as-is; this adds a second lucide-react import line for `EyeOff`.)

- [ ] **Step 2: Add `hiddenCategories` state and fetch it in `load()`**

Replace:

```tsx
export default function VendorsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
```

with:

```tsx
export default function VendorsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);
```

Replace:

```tsx
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);
    const { data } = await supabase.from("vendors").select("*").eq("wedding_id", w.id).order("created_at", { ascending: true });
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }, []);
```

with:

```tsx
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);
    setHiddenCategories((w.hidden_vendor_categories ?? []) as VendorCategory[]);
    const { data } = await supabase.from("vendors").select("*").eq("wedding_id", w.id).order("created_at", { ascending: true });
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }, []);
```

- [ ] **Step 3: Add `hideCategory` and `restoreCategory` functions**

Add immediately after the `load` function's closing `}, []);` (right before `useEffect(() => { load(); }, [load]);`):

```tsx
  async function hideCategory(cat: VendorCategory) {
    if (!weddingId) return;
    const inUse = vendors.some((v) => v.categories.includes(cat));
    if (inUse) return;
    const next = [...hiddenCategories, cat];
    setHiddenCategories(next);
    await supabase.from("weddings").update({ hidden_vendor_categories: next }).eq("id", weddingId);
  }

  async function restoreCategory(cat: VendorCategory) {
    if (!weddingId) return;
    const next = hiddenCategories.filter((c) => c !== cat);
    setHiddenCategories(next);
    await supabase.from("weddings").update({ hidden_vendor_categories: next }).eq("id", weddingId);
  }
```

- [ ] **Step 4: Compute `activeCategories` and change `grouped` to include empty categories**

Replace:

```tsx
  const booked = vendors.filter((v) => v.status === "booked").length;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.categories.includes(cat)),
  })).filter((g) => g.items.length > 0);
```

with:

```tsx
  const booked = vendors.filter((v) => v.status === "booked").length;
  const activeCategories = getActiveCategories(hiddenCategories);

  const grouped = activeCategories.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.categories.includes(cat)),
  }));
```

- [ ] **Step 5: Update the empty/all-hidden state and render an empty-state card per category**

Replace:

```tsx
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : grouped.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              No vendors yet.{" "}
              <button onClick={() => openAdd()} className="text-accent underline">Add your first vendor.</button>
            </p>
          ) : (
            grouped.map(({ cat, label, items }) => (
              <div key={cat} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                  <button onClick={() => openAdd(cat)} className="text-xs text-accent flex items-center gap-0.5 hover:underline">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {items.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => openEdit(vendor)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{vendor.name}</p>
                        {vendor.contact && <p className="text-xs text-muted-fg">{vendor.contact}</p>}
                        {(vendor.price_range_min || vendor.price_range_max) && (
                          <p className="text-xs text-muted-fg">
                            {vendor.price_range_min ? formatPHP(Number(vendor.price_range_min)) : ""}
                            {vendor.price_range_min && vendor.price_range_max ? " – " : ""}
                            {vendor.price_range_max ? formatPHP(Number(vendor.price_range_max)) : ""}
                          </p>
                        )}
                        {vendor.notes && <p className="text-xs text-muted-fg italic truncate">{vendor.notes}</p>}
                      </div>
                      <Badge variant={STATUS_VARIANT[vendor.status]}>
                        {STATUS_OPTIONS.find((s) => s.value === vendor.status)?.label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
```

with:

```tsx
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : activeCategories.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              All categories are hidden. Restore one below to add a vendor.
            </p>
          ) : (
            grouped.map(({ cat, label, items }) => (
              <div key={cat} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openAdd(cat)} className="text-xs text-accent flex items-center gap-0.5 hover:underline">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                    <button
                      onClick={() => hideCategory(cat)}
                      disabled={items.length > 0}
                      title={items.length > 0 ? "Retag or remove vendors in this category first" : "Hide this category"}
                      className="text-muted-fg hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-4 text-center">
                    <p className="text-xs text-muted-fg">No vendor added yet</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {items.map((vendor) => (
                      <button
                        key={vendor.id}
                        onClick={() => openEdit(vendor)}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{vendor.name}</p>
                          {vendor.contact && <p className="text-xs text-muted-fg">{vendor.contact}</p>}
                          {(vendor.price_range_min || vendor.price_range_max) && (
                            <p className="text-xs text-muted-fg">
                              {vendor.price_range_min ? formatPHP(Number(vendor.price_range_min)) : ""}
                              {vendor.price_range_min && vendor.price_range_max ? " – " : ""}
                              {vendor.price_range_max ? formatPHP(Number(vendor.price_range_max)) : ""}
                            </p>
                          )}
                          {vendor.notes && <p className="text-xs text-muted-fg italic truncate">{vendor.notes}</p>}
                        </div>
                        <Badge variant={STATUS_VARIANT[vendor.status]}>
                          {STATUS_OPTIONS.find((s) => s.value === vendor.status)?.label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {!loading && hiddenCategories.length > 0 && (
            <div className="mt-2">
              <h2 className="text-xs uppercase tracking-widest text-muted-fg font-semibold mb-2">Hidden categories</h2>
              <div className="flex flex-wrap gap-2">
                {hiddenCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => restoreCategory(cat)}
                    className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-fg hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" /> {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 6: Update the Add/Edit dialog's category picker to use `activeCategories`**

Replace:

```tsx
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((c) => {
```

with:

```tsx
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="grid grid-cols-3 gap-2">
                {activeCategories.map((c) => {
```

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/more/vendors/page.tsx
git -c commit.gpgsign=false commit -m "Show all vendor categories always, with hide/restore"
```

---

### Task 3: Budget page — active categories in the manual dropdown

**Files:**
- Modify: `app/budget/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories` (Task 1).

- [ ] **Step 1: Update imports and the `Wedding` type**

Replace:

```tsx
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
```

with:

```tsx
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER, getActiveCategories } from "@/lib/categories";
```

Replace:

```tsx
type Wedding = { id: string; budget_total: string | null };
```

with:

```tsx
type Wedding = { id: string; budget_total: string | null; hidden_vendor_categories: VendorCategory[] | null };
```

- [ ] **Step 2: Compute `activeCategories`**

Replace:

```tsx
  const totalBudget = Number(wedding?.budget_total ?? 0);
  const totalPaid = items.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalEstimated = items.reduce((s, i) => s + Number(i.estimated_amount), 0);
  const remaining = totalBudget > 0 ? totalBudget - totalPaid : totalEstimated - totalPaid;
```

with:

```tsx
  const totalBudget = Number(wedding?.budget_total ?? 0);
  const totalPaid = items.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalEstimated = items.reduce((s, i) => s + Number(i.estimated_amount), 0);
  const remaining = totalBudget > 0 ? totalBudget - totalPaid : totalEstimated - totalPaid;
  const activeCategories = getActiveCategories(wedding?.hidden_vendor_categories ?? []);
```

- [ ] **Step 3: Use `activeCategories` in the manual-category dropdown**

Replace:

```tsx
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_ORDER.map((c) => <option key={c} value={CATEGORY_LABELS[c]}>{CATEGORY_LABELS[c]}</option>)}
                </select>
```

with:

```tsx
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {activeCategories.map((c) => <option key={c} value={CATEGORY_LABELS[c]}>{CATEGORY_LABELS[c]}</option>)}
                </select>
```

(`CATEGORY_ORDER` stays imported and used by the unrelated `grouped` expense-list computation further down in this file — do not remove it.)

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/budget/page.tsx
git -c commit.gpgsign=false commit -m "Exclude hidden vendor categories from the budget category dropdown"
```

---

### Task 4: Dashboard — active categories in the vendor-gap reminder

**Files:**
- Modify: `lib/dashboardReminders.ts`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories` (Task 1).
- Produces: `buildVendorGapReminder(vendors: VendorRow[], activeCategories: VendorCategory[]): Reminder | null` (signature change) — this is the same exported name Task 4 of the original dashboard-reminders plan introduced; callers must be updated in the same task.

- [ ] **Step 1: Change `buildVendorGapReminder`'s signature in `lib/dashboardReminders.ts`**

Replace:

```ts
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
```

with:

```ts
import { type VendorCategory, CATEGORY_LABELS } from "@/lib/categories";
```

Replace:

```ts
export function buildVendorGapReminder(vendors: VendorRow[]): Reminder | null {
  const gaps = CATEGORY_ORDER.filter(
    (cat) => !vendors.some((v) => v.categories.includes(cat) && v.status === "booked")
  );
```

with:

```ts
export function buildVendorGapReminder(vendors: VendorRow[], activeCategories: VendorCategory[]): Reminder | null {
  const gaps = activeCategories.filter(
    (cat) => !vendors.some((v) => v.categories.includes(cat) && v.status === "booked")
  );
```

- [ ] **Step 2: Pass `activeCategories` from `app/dashboard/page.tsx`**

Replace:

```tsx
import {
  type Reminder, type DueBudgetRow, type VendorRow,
  buildPaymentReminder, buildRsvpReminder, buildEntourageReminder, buildVendorGapReminder,
} from "@/lib/dashboardReminders";
```

with:

```tsx
import {
  type Reminder, type DueBudgetRow, type VendorRow,
  buildPaymentReminder, buildRsvpReminder, buildEntourageReminder, buildVendorGapReminder,
} from "@/lib/dashboardReminders";
import { type VendorCategory, getActiveCategories } from "@/lib/categories";
```

Replace:

```tsx
  const reminders = [
    buildPaymentReminder((dueBudgetItems ?? []) as DueBudgetRow[], (vendors ?? []) as VendorRow[]),
    buildRsvpReminder(pendingGuests ?? 0),
    buildEntourageReminder((unconfirmedSponsors ?? []).map((s) => s.name)),
    buildVendorGapReminder((vendors ?? []) as VendorRow[]),
  ].filter((r): r is Reminder => r !== null);
```

with:

```tsx
  const activeCategories = getActiveCategories((wedding.hidden_vendor_categories ?? []) as VendorCategory[]);

  const reminders = [
    buildPaymentReminder((dueBudgetItems ?? []) as DueBudgetRow[], (vendors ?? []) as VendorRow[]),
    buildRsvpReminder(pendingGuests ?? 0),
    buildEntourageReminder((unconfirmedSponsors ?? []).map((s) => s.name)),
    buildVendorGapReminder((vendors ?? []) as VendorRow[], activeCategories),
  ].filter((r): r is Reminder => r !== null);
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboardReminders.ts app/dashboard/page.tsx
git -c commit.gpgsign=false commit -m "Exclude hidden vendor categories from the dashboard vendor-gap reminder"
```

---

### Task 5: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

If `.next/` exists from a prior run, remove it first to avoid the stale-artifact `ENOTEMPTY` error seen earlier this session:

Run: `rm -rf .next && npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Report manual steps to the user**

Tell the user:
1. Run the Task 1 Step 5 SQL migration in the Supabase SQL editor before this feature will work against real data.
2. Push to GitHub and redeploy to Vercel.
3. Manually verify in the browser: every category shows a section on the vendors page (even empty ones); hiding a category with no vendors tagged removes its section and adds it to the "Hidden categories" strip; hiding is blocked (button disabled) for a category with at least one vendor; restoring a hidden category brings its section back; the budget page's manual-category dropdown and the dashboard's "no vendor booked" reminder both stop listing/flagging a hidden category.
