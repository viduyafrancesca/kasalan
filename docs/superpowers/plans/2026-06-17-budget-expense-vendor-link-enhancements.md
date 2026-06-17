# Budget Expense Vendor-Link Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a budget expense is linked to a vendor, autofill the Estimated amount from that vendor's max price; make Paid amount required for every expense; add a required Payment date field.

**Architecture:** `app/budget/page.tsx`'s existing vendor-link toggle (added in the fluid-categories work) gets a `price_range_max` fetched alongside each vendor, used to set Estimated whenever the vendor selection changes. A new `paid_date` column is added to `budget_items` (nullable in the DB; required only at the UI form level, so existing rows aren't broken).

**Tech Stack:** Next.js 16 (App Router, client components), Supabase JS client, TypeScript. No test runner exists in this project — verification is `npx tsc --noEmit` per task and `npm run build` at the end, same as the fluid-categories plan.

## Global Constraints

- DB schema changes are applied by hand in Supabase's SQL editor by the user — never run migrations automatically.
- No comments in code unless explaining a non-obvious constraint.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.
- `paid_date` stays nullable in the DB (no backfill); required-ness is enforced only by disabling Save in the UI.

---

### Task 1: Schema update + manual migration SQL

**Files:**
- Modify: `lib/db/schema.ts` (`budgetItems` table)

**Interfaces:**
- Produces: `budget_items.paid_date` (date, nullable) — consumed by Task 2's Supabase queries (plain `.from("budget_items")` calls, not Drizzle).

- [ ] **Step 1: Add `paidDate` to the `budgetItems` table**

In `lib/db/schema.ts`, replace:

```ts
export const budgetItems = pgTable("budget_items", {
  id:              uuid("id").primaryKey().defaultRandom(),
  weddingId:       uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:        text("category"),
  label:           text("label").notNull(),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount:      numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vendorId:        uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  dueDate:         date("due_date"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

with:

```ts
export const budgetItems = pgTable("budget_items", {
  id:              uuid("id").primaryKey().defaultRandom(),
  weddingId:       uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:        text("category"),
  label:           text("label").notNull(),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount:      numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidDate:        date("paid_date"),
  vendorId:        uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  dueDate:         date("due_date"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git -c commit.gpgsign=false commit -m "Add paid_date column to budget_items schema"
```

- [ ] **Step 4: Record the manual SQL migration for the user**

Surface this to the user at the end of this plan's execution — do not run it automatically:

```sql
ALTER TABLE budget_items ADD COLUMN paid_date date;
```

---

### Task 2: Budget page — autofill, required fields, payment date

**Files:**
- Modify: `app/budget/page.tsx`

**Interfaces:**
- Consumes: `budget_items.paid_date` (Task 1).
- Produces: nothing consumed elsewhere — this is the final UI change for this feature.

- [ ] **Step 1: Add a `todayStr()` helper and extend `VendorRef`/`BudgetItem` types**

Replace:

```tsx
type BudgetItem = {
  id: string;
  category: string | null;
  vendor_id: string | null;
  label: string;
  estimated_amount: string;
  paid_amount: string;
  notes: string | null;
};

type VendorRef = { id: string; name: string; categories: VendorCategory[] };
```

with:

```tsx
type BudgetItem = {
  id: string;
  category: string | null;
  vendor_id: string | null;
  label: string;
  estimated_amount: string;
  paid_amount: string;
  paid_date: string | null;
  notes: string | null;
};

type VendorRef = { id: string; name: string; categories: VendorCategory[]; price_range_max: string | null };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Fetch `price_range_max` alongside each vendor**

Replace:

```tsx
    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, name, categories")
      .eq("wedding_id", w.id)
      .order("name");
```

with:

```tsx
    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, name, categories, price_range_max")
      .eq("wedding_id", w.id)
      .order("name");
```

- [ ] **Step 3: Add `paid_date` to form state, `openAdd`, `openEdit`**

Replace:

```tsx
  const [form, setForm] = useState({ label: "", category: "Venue", vendor_id: null as string | null, estimated: "", paid: "", notes: "" });
```

with:

```tsx
  const [form, setForm] = useState({ label: "", category: "Venue", vendor_id: null as string | null, estimated: "", paid: "", paid_date: todayStr(), notes: "" });
```

Replace:

```tsx
  function openAdd() {
    setEditing(null);
    setForm({ label: "", category: "Venue", vendor_id: null, estimated: "", paid: "", notes: "" });
    setExpenseOpen(true);
  }

  function openEdit(item: BudgetItem) {
    setEditing(item);
    setForm({
      label: item.label,
      category: item.category ?? "Venue",
      vendor_id: item.vendor_id,
      estimated: item.estimated_amount,
      paid: item.paid_amount,
      notes: item.notes ?? "",
    });
    setExpenseOpen(true);
  }
```

with:

```tsx
  function openAdd() {
    setEditing(null);
    setForm({ label: "", category: "Venue", vendor_id: null, estimated: "", paid: "", paid_date: todayStr(), notes: "" });
    setExpenseOpen(true);
  }

  function openEdit(item: BudgetItem) {
    setEditing(item);
    setForm({
      label: item.label,
      category: item.category ?? "Venue",
      vendor_id: item.vendor_id,
      estimated: item.estimated_amount,
      paid: item.paid_amount,
      paid_date: item.paid_date ?? todayStr(),
      notes: item.notes ?? "",
    });
    setExpenseOpen(true);
  }
```

- [ ] **Step 4: Include `paid_date` in `saveExpense()` payload**

Replace:

```tsx
    const payload = {
      wedding_id: wedding.id,
      label: form.label,
      category: form.vendor_id ? null : form.category,
      vendor_id: form.vendor_id,
      estimated_amount: Number(form.estimated) || 0,
      paid_amount: Number(form.paid) || 0,
      notes: form.notes || null,
    };
```

with:

```tsx
    const payload = {
      wedding_id: wedding.id,
      label: form.label,
      category: form.vendor_id ? null : form.category,
      vendor_id: form.vendor_id,
      estimated_amount: Number(form.estimated) || 0,
      paid_amount: Number(form.paid) || 0,
      paid_date: form.paid_date || null,
      notes: form.notes || null,
    };
```

- [ ] **Step 5: Autofill Estimated when switching into vendor-link mode**

Replace:

```tsx
                <button
                  onClick={() => setForm((f) => ({ ...f, vendor_id: vendors[0]?.id ?? null }))}
                  disabled={vendors.length === 0}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-40",
                    form.vendor_id ? "border-accent bg-terra-100 text-accent" : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  Link to vendor
                </button>
```

with:

```tsx
                <button
                  onClick={() => {
                    const v = vendors[0];
                    setForm((f) => ({
                      ...f,
                      vendor_id: v?.id ?? null,
                      estimated: v?.price_range_max ? v.price_range_max : f.estimated,
                    }));
                  }}
                  disabled={vendors.length === 0}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-40",
                    form.vendor_id ? "border-accent bg-terra-100 text-accent" : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  Link to vendor
                </button>
```

- [ ] **Step 6: Autofill Estimated when switching the vendor dropdown**

Replace:

```tsx
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.vendor_id}
                  onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value }))}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.categories.map((c) => CATEGORY_LABELS[c]).join(", ")})
                    </option>
                  ))}
                </select>
```

with:

```tsx
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.vendor_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const v = vendors.find((vv) => vv.id === id);
                    setForm((f) => ({
                      ...f,
                      vendor_id: id,
                      estimated: v?.price_range_max ? v.price_range_max : f.estimated,
                    }));
                  }}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.categories.map((c) => CATEGORY_LABELS[c]).join(", ")})
                    </option>
                  ))}
                </select>
```

- [ ] **Step 7: Add the Payment date field**

Replace:

```tsx
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estimated (₱)</Label>
                <Input type="number" placeholder="0" value={form.estimated} onChange={(e) => setForm((f) => ({ ...f, estimated: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Paid (₱)</Label>
                <Input type="number" placeholder="0" value={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
```

with:

```tsx
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estimated (₱)</Label>
                <Input type="number" placeholder="0" value={form.estimated} onChange={(e) => setForm((f) => ({ ...f, estimated: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Paid (₱) *</Label>
                <Input type="number" placeholder="0" value={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment date *</Label>
              <Input type="date" value={form.paid_date} onChange={(e) => setForm((f) => ({ ...f, paid_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
```

- [ ] **Step 8: Require Paid and Payment date before saving**

Replace:

```tsx
            <Button className="w-full" disabled={!form.label || savingExpense} onClick={saveExpense}>
              {savingExpense ? "Saving..." : editing ? "Save changes" : "Add expense"}
            </Button>
```

with:

```tsx
            <Button className="w-full" disabled={!form.label || !form.paid || !form.paid_date || savingExpense} onClick={saveExpense}>
              {savingExpense ? "Saving..." : editing ? "Save changes" : "Add expense"}
            </Button>
```

- [ ] **Step 9: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add app/budget/page.tsx
git -c commit.gpgsign=false commit -m "Autofill estimate from linked vendor, require paid amount and payment date"
```

---

### Task 3: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Report manual steps to the user**

Tell the user:
1. Run the Task 1 Step 4 SQL migration in the Supabase SQL editor before this UI will persist payment dates.
2. Push to GitHub and redeploy to Vercel.
3. Manually verify in the browser: open an expense, switch to "Link to vendor," confirm Estimated fills from the vendor's max price; confirm Save is disabled until Paid and Payment date are both filled.
