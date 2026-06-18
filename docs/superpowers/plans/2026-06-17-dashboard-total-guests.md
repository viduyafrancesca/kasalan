# Dashboard Total Guests Stat Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Total Guests" stat card to the dashboard showing all guests plus all entourage/sponsors, regardless of RSVP/confirmed status.

**Architecture:** Two new `count`-only Supabase queries added to `app/dashboard/page.tsx`'s existing `Promise.all`; one new `StatCard` inserted into the existing stat grid.

**Tech Stack:** Next.js 16 (App Router, server components), Supabase JS client, TypeScript. No test runner exists in this project — verification is `npx tsc --noEmit` and `npm run build`, same as prior plans this session.

## Global Constraints

- No comments in code unless explaining a non-obvious constraint.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.
- "RSVPs" and "Sponsors" cards keep their current counts (attending-only, confirmed-only) — only a new card is added, nothing existing changes meaning.

---

### Task 1: Add the Total Guests stat card

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:** none (self-contained single-file change).

- [ ] **Step 1: Add the two count queries to the `Promise.all`**

Replace:

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

with:

```tsx
  const [
    { count: totalTasks },
    { count: doneTasks },
    { data: budgetItems },
    { data: dueBudgetItems },
    { count: attendingGuests },
    { count: pendingGuests },
    { count: totalGuests },
    { count: confirmedSponsors },
    { count: totalSponsors },
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
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("confirmed", true),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
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

- [ ] **Step 2: Add the combined total and render the new card**

Replace:

```tsx
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={confirmedSponsors ?? 0} label="Sponsors" />
        </div>
```

with:

```tsx
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={(totalGuests ?? 0) + (totalSponsors ?? 0)} label="Total Guests" />
          <StatCard value={confirmedSponsors ?? 0} label="Sponsors" />
        </div>
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git -c commit.gpgsign=false commit -m "Add Total Guests stat card to dashboard"
```

---

### Task 2: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

If `.next/` exists from a prior run, remove it first to avoid the stale-artifact `ENOTEMPTY` error seen earlier this session:

Run: `rm -rf .next && npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Report to the user**

No manual SQL migration needed — this feature only reads existing columns. Push to GitHub and redeploy to Vercel once verified. Manually check in the browser: the dashboard stat grid shows 5 cards (2-per-row on mobile, 5-in-a-row on desktop), and "Total Guests" equals guest list count plus entourage count.
