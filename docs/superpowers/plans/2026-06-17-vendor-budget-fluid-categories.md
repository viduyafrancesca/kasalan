# Fluid Vendor & Budget Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vendor be tagged with multiple categories (for bundled packages) and let a budget expense link to a vendor instead of picking one fixed category.

**Architecture:** A new shared `lib/categories.ts` module becomes the single source of truth for category slugs/labels, replacing the two drifted lists currently duplicated in `app/more/vendors/page.tsx` and `app/budget/page.tsx`. `vendors.category` (single enum) becomes `vendors.categories` (enum array). `budget_items.vendor_id` (already in the schema, unused) becomes a real FK wired into the UI; linked expenses inherit their vendor's categories for grouping instead of using their own `category` field.

**Tech Stack:** Next.js 16 (App Router, client components), Supabase JS client (no Drizzle queries at runtime — `lib/db/schema.ts` exists only for `drizzle-kit push`/type reference), TypeScript, Tailwind v4.

## Global Constraints

- No test runner exists in this project (`package.json` has no test script, no jest/vitest). Verification per task is `npx tsc --noEmit` (type check) plus a final `npm run build`. This matches how every prior feature in this codebase (checklist, vendors CRUD, sponsors, guests) was verified — there is no existing test suite to extend.
- DB schema changes are applied by hand in Supabase's SQL editor by the user — never run migrations automatically. `lib/db/schema.ts` is updated to match for documentation/type-reference purposes, consistent with how the `bridesmaid`/`groomsman` enum change was handled.
- No comments in code unless explaining a non-obvious constraint.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.

---

### Task 1: Shared categories module

**Files:**
- Create: `lib/categories.ts`

**Interfaces:**
- Produces: `VendorCategory` type, `CATEGORY_LABELS: Record<VendorCategory, string>`, `CATEGORY_ORDER: VendorCategory[]` — consumed by Tasks 3 and 4.

- [ ] **Step 1: Create `lib/categories.ts`**

```ts
export type VendorCategory =
  | "venue" | "catering" | "photography" | "videography" | "flowers"
  | "hair_makeup" | "styling" | "attire" | "sounds_lights" | "cake"
  | "invitations" | "transportation" | "other";

export const CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue:          "Venue",
  catering:       "Catering",
  photography:    "Photography",
  videography:    "Videography",
  flowers:        "Flowers",
  hair_makeup:    "Hair & Makeup",
  styling:        "Styling",
  attire:         "Attire",
  sounds_lights:  "Sounds & Lights",
  cake:           "Cake",
  invitations:    "Invitations",
  transportation: "Transportation",
  other:          "Other",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as VendorCategory[];
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors (this file has no consumers yet, so it's a no-op check beyond syntax).

- [ ] **Step 3: Commit**

```bash
git add lib/categories.ts
git -c commit.gpgsign=false commit -m "Add shared vendor/budget category list"
```

---

### Task 2: Schema update + manual migration SQL

**Files:**
- Modify: `lib/db/schema.ts:19-22` (vendorCategoryEnum)
- Modify: `lib/db/schema.ts:81-92` (budgetItems table)
- Modify: `lib/db/schema.ts:108-119` (vendors table)

**Interfaces:**
- Produces: `vendors.categories` (array column, DB-level), `budget_items.vendor_id` FK, `budget_items.category` nullable — consumed by Tasks 3 and 4's Supabase queries (these are plain `.from("vendors")`/`.from("budget_items")` calls, not Drizzle queries, so the runtime contract is just the column names/types below).

- [ ] **Step 1: Update the vendor category enum**

In `lib/db/schema.ts`, replace:

```ts
export const vendorCategoryEnum = pgEnum("vendor_category", [
  "venue", "catering", "photography", "videography", "flowers",
  "hair_makeup", "styling", "sounds_lights", "cake", "transportation", "other",
]);
```

with:

```ts
export const vendorCategoryEnum = pgEnum("vendor_category", [
  "venue", "catering", "photography", "videography", "flowers",
  "hair_makeup", "styling", "attire", "sounds_lights", "cake",
  "invitations", "transportation", "other",
]);
```

- [ ] **Step 2: Update the `budgetItems` table**

Replace:

```ts
export const budgetItems = pgTable("budget_items", {
  id:              uuid("id").primaryKey().defaultRandom(),
  weddingId:       uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:        text("category").notNull(),
  label:           text("label").notNull(),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount:      numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vendorId:        uuid("vendor_id"),
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
  vendorId:        uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  dueDate:         date("due_date"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Update the `vendors` table**

Replace:

```ts
export const vendors = pgTable("vendors", {
  id:            uuid("id").primaryKey().defaultRandom(),
  weddingId:     uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:      vendorCategoryEnum("category").notNull(),
  name:          text("name").notNull(),
  contact:       text("contact"),
  priceRangeMin: numeric("price_range_min", { precision: 12, scale: 2 }),
  priceRangeMax: numeric("price_range_max", { precision: 12, scale: 2 }),
  status:        vendorStatusEnum("status").notNull().default("interested"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

with:

```ts
export const vendors = pgTable("vendors", {
  id:            uuid("id").primaryKey().defaultRandom(),
  weddingId:     uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  categories:    vendorCategoryEnum("categories").array().notNull(),
  name:          text("name").notNull(),
  contact:       text("contact"),
  priceRangeMin: numeric("price_range_min", { precision: 12, scale: 2 }),
  priceRangeMax: numeric("price_range_max", { precision: 12, scale: 2 }),
  status:        vendorStatusEnum("status").notNull().default("interested"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts
git -c commit.gpgsign=false commit -m "Make vendor categories an array, link budget items to vendors"
```

- [ ] **Step 6: Record the manual SQL migration for the user**

This SQL must be run by hand in the Supabase SQL editor before Tasks 3/4's UI will work against real data. Surface it to the user at the end of this plan's execution — do not run it automatically:

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

---

### Task 3: Vendors page — multi-tag categories

**Files:**
- Modify: `app/more/vendors/page.tsx`

**Interfaces:**
- Consumes: `VendorCategory`, `CATEGORY_LABELS`, `CATEGORY_ORDER` from `@/lib/categories` (Task 1).
- Produces: `Vendor.categories: VendorCategory[]` (replaces `Vendor.category`) — consumed by Task 4's vendor-link picker in the budget page.

- [ ] **Step 1: Replace local category type/constants with the shared import**

Replace:

```tsx
import { formatPHP } from "@/lib/utils";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type VendorStatus = "interested" | "shortlisted" | "booked" | "declined";
type VendorCategory =
  | "venue" | "catering" | "photography" | "videography" | "flowers"
  | "hair_makeup" | "styling" | "sounds_lights" | "cake" | "transportation" | "other";

type Vendor = {
  id: string;
  category: VendorCategory;
  name: string;
  contact: string | null;
  price_range_min: string | null;
  price_range_max: string | null;
  status: VendorStatus;
  notes: string | null;
};

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue:          "Venue",
  catering:       "Catering",
  photography:    "Photography",
  videography:    "Videography",
  flowers:        "Flowers",
  hair_makeup:    "Hair & Makeup",
  styling:        "Styling",
  sounds_lights:  "Sounds & Lights",
  cake:           "Cake",
  transportation: "Transportation",
  other:          "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as VendorCategory[];
```

with:

```tsx
import { formatPHP } from "@/lib/utils";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";

type VendorStatus = "interested" | "shortlisted" | "booked" | "declined";

type Vendor = {
  id: string;
  categories: VendorCategory[];
  name: string;
  contact: string | null;
  price_range_min: string | null;
  price_range_max: string | null;
  status: VendorStatus;
  notes: string | null;
};
```

- [ ] **Step 2: Update `EMPTY_FORM`, `openAdd`, `openEdit`**

Replace:

```tsx
const EMPTY_FORM = {
  name: "", category: "venue" as VendorCategory, contact: "",
  price_min: "", price_max: "", status: "interested" as VendorStatus, notes: "",
};
```

with:

```tsx
const EMPTY_FORM = {
  name: "", categories: ["venue"] as VendorCategory[], contact: "",
  price_min: "", price_max: "", status: "interested" as VendorStatus, notes: "",
};
```

Replace:

```tsx
  function openAdd(defaultCategory?: VendorCategory) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: defaultCategory ?? "venue" });
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      category: v.category,
      contact: v.contact ?? "",
      price_min: v.price_range_min ?? "",
      price_max: v.price_range_max ?? "",
      status: v.status,
      notes: v.notes ?? "",
    });
    setOpen(true);
  }
```

with:

```tsx
  function openAdd(defaultCategory?: VendorCategory) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categories: defaultCategory ? [defaultCategory] : ["venue"] });
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      categories: v.categories,
      contact: v.contact ?? "",
      price_min: v.price_range_min ?? "",
      price_max: v.price_range_max ?? "",
      status: v.status,
      notes: v.notes ?? "",
    });
    setOpen(true);
  }
```

- [ ] **Step 3: Update `save()` payload**

Replace:

```tsx
    const payload = {
      wedding_id: weddingId,
      name: form.name.trim(),
      category: form.category,
      contact: form.contact || null,
      price_range_min: form.price_min ? Number(form.price_min) : null,
      price_range_max: form.price_max ? Number(form.price_max) : null,
      status: form.status,
      notes: form.notes || null,
    };
```

with:

```tsx
    const payload = {
      wedding_id: weddingId,
      name: form.name.trim(),
      categories: form.categories,
      contact: form.contact || null,
      price_range_min: form.price_min ? Number(form.price_min) : null,
      price_range_max: form.price_max ? Number(form.price_max) : null,
      status: form.status,
      notes: form.notes || null,
    };
```

- [ ] **Step 4: Update the grouping logic**

Replace:

```tsx
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.category === cat),
  })).filter((g) => g.items.length > 0);
```

with:

```tsx
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.categories.includes(cat)),
  })).filter((g) => g.items.length > 0);
```

- [ ] **Step 5: Replace the category `<select>` with a multi-select chip grid**

Replace:

```tsx
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorCategory }))}
              >
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
```

with:

```tsx
            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((c) => {
                  const selected = form.categories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({
                        ...f,
                        categories: selected
                          ? f.categories.filter((x) => x !== c)
                          : [...f.categories, c],
                      }))}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium transition-colors",
                        selected
                          ? "border-accent bg-terra-100 text-accent"
                          : "border-border bg-card text-muted-fg hover:bg-muted"
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>
```

- [ ] **Step 6: Require at least one category before saving**

Replace:

```tsx
            <Button className="w-full" disabled={!form.name.trim() || saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add vendor"}
            </Button>
```

with:

```tsx
            <Button className="w-full" disabled={!form.name.trim() || form.categories.length === 0 || saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add vendor"}
            </Button>
```

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/more/vendors/page.tsx
git -c commit.gpgsign=false commit -m "Let vendors carry multiple categories for bundled packages"
```

---

### Task 4: Budget page — link expense to vendor

**Files:**
- Modify: `app/budget/page.tsx`

**Interfaces:**
- Consumes: `VendorCategory`, `CATEGORY_LABELS`, `CATEGORY_ORDER` from `@/lib/categories` (Task 1); `Vendor.categories: VendorCategory[]` shape from `vendors` table (Task 3).

- [ ] **Step 1: Replace the local `CATEGORIES` list and add a vendor-ref type**

Replace:

```tsx
import { formatPHP } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

const CATEGORIES = [
  "Venue", "Catering", "Photography", "Videography", "Flowers",
  "Attire", "Beauty", "Sounds & Lights", "Cake", "Transportation",
  "Invitations", "Other",
];

type BudgetItem = {
  id: string;
  category: string;
  label: string;
  estimated_amount: string;
  paid_amount: string;
  notes: string | null;
};
```

with:

```tsx
import { formatPHP } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { cn } from "@/lib/utils";

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

- [ ] **Step 2: Add vendor state and fetch vendors in `load()`**

Replace:

```tsx
export default function BudgetPage() {
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
```

with:

```tsx
export default function BudgetPage() {
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [vendors, setVendors] = useState<VendorRef[]>([]);
  const [loading, setLoading] = useState(true);
```

Replace:

```tsx
    const { data: budgetItems } = await supabase
      .from("budget_items")
      .select("*")
      .eq("wedding_id", w.id)
      .order("created_at", { ascending: true });

    setItems((budgetItems ?? []) as BudgetItem[]);
    setLoading(false);
  }, []);
```

with:

```tsx
    const { data: budgetItems } = await supabase
      .from("budget_items")
      .select("*")
      .eq("wedding_id", w.id)
      .order("created_at", { ascending: true });

    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, name, categories")
      .eq("wedding_id", w.id)
      .order("name");

    setItems((budgetItems ?? []) as BudgetItem[]);
    setVendors((vendorRows ?? []) as VendorRef[]);
    setLoading(false);
  }, []);
```

- [ ] **Step 3: Add `vendor_id` to form state, `openAdd`, `openEdit`**

Replace:

```tsx
  const [form, setForm] = useState({ label: "", category: "Venue", estimated: "", paid: "", notes: "" });
```

with:

```tsx
  const [form, setForm] = useState({ label: "", category: "Venue", vendor_id: null as string | null, estimated: "", paid: "", notes: "" });
```

Replace:

```tsx
  function openAdd() {
    setEditing(null);
    setForm({ label: "", category: "Venue", estimated: "", paid: "", notes: "" });
    setExpenseOpen(true);
  }

  function openEdit(item: BudgetItem) {
    setEditing(item);
    setForm({
      label: item.label,
      category: item.category,
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

- [ ] **Step 4: Update `saveExpense()` payload**

Replace:

```tsx
    const payload = {
      wedding_id: wedding.id,
      label: form.label,
      category: form.category,
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
      notes: form.notes || null,
    };
```

- [ ] **Step 5: Replace the category-string grouping with a label-based grouping that accounts for linked vendors**

Replace:

```tsx
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);
```

with:

```tsx
  function effectiveLabels(item: BudgetItem): string[] {
    if (item.vendor_id) {
      const v = vendors.find((vv) => vv.id === item.vendor_id);
      return v ? v.categories.map((c) => CATEGORY_LABELS[c]) : ["Other"];
    }
    return [item.category ?? "Other"];
  }

  const grouped = CATEGORY_ORDER.map((cat) => {
    const label = CATEGORY_LABELS[cat];
    return {
      category: label,
      items: items.filter((i) => effectiveLabels(i).includes(label)),
    };
  }).filter((g) => g.items.length > 0);
```

- [ ] **Step 6: Replace the category select with a manual/vendor-link toggle**

Replace:

```tsx
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
```

with:

```tsx
            <div className="space-y-1.5">
              <Label>How is this categorized?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setForm((f) => ({ ...f, vendor_id: null }))}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors",
                    !form.vendor_id ? "border-accent bg-terra-100 text-accent" : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  Manual category
                </button>
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
              </div>
            </div>

            {form.vendor_id ? (
              <div className="space-y-1.5">
                <Label>Vendor</Label>
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
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_ORDER.map((c) => <option key={c} value={CATEGORY_LABELS[c]}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            )}
```

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/budget/page.tsx
git -c commit.gpgsign=false commit -m "Let budget expenses link to a vendor instead of a fixed category"
```

---

### Task 5: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Report manual steps to the user**

Tell the user:
1. Run the Task 2 Step 6 SQL migration in the Supabase SQL editor before using the new fields against real data.
2. After that, push to GitHub and redeploy to Vercel (same flow used for every prior feature in this project).
3. Manually verify in the browser: add a vendor tagged with 2+ categories, confirm it appears under each category section; add a budget expense linked to that vendor, confirm it appears under each of the vendor's category groups in the budget breakdown.
