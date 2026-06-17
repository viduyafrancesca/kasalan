# Dashboard Reminders panel

## Problem

The dashboard shows stat counts (tasks, budget, RSVPs, sponsors) and an "Up
Next" checklist preview, but nothing actionable: it doesn't surface upcoming
vendor payments, pending RSVPs needing follow-up, entourage members who
haven't confirmed, or vendor categories still missing a booked vendor. All
of that data already exists in the DB; it's just never summarized anywhere.

## Design

A new "Reminders" section on `app/dashboard/page.tsx`, placed between the
stat card grid and "Up Next". It renders at most 4 lines — one per reminder
type below — each only appearing if that type has something to flag. If
none of the four have anything, the whole section (including its heading)
is omitted.

1. **Payments due** — from `budget_items` where `paid_amount < estimated_amount`
   and `due_date` is not null and is either in the past or within the next
   30 days, ordered by `due_date` ascending. The single most urgent item
   becomes the headline; if more items qualify, append "+N more". Days
   phrasing: "in 5 days" for future, "5 days overdue" for past, "due today"
   for today. Links to `/budget`.

   Example: "₱50,000 due to Casa Verde Events in 5 days +2 more"

2. **Pending RSVPs** — count of `guests` where `rsvp_status = 'pending'`.
   Shown as "N RSVPs still pending" (singular "1 RSVP still pending" for
   N=1). Links to `/guests`.

3. **Unconfirmed entourage** — names of `sponsors` where `confirmed = false`,
   first 2 names joined with a comma, then "+N more" if there are
   additional ones. Phrasing: "<names> haven't confirmed yet" (or "hasn't"
   for a single name). Links to `/more/sponsors`.

4. **Vendor gaps** — category labels (from the shared `lib/categories.ts`
   list) where no vendor tagged with that category has `status = 'booked'`.
   First 2 category labels, then "+N more". Phrasing: "No vendor booked yet
   for <labels>". Links to `/more/vendors`.

Each line is a `<Link>` styled as a card row (same visual treatment as the
existing "Up Next" rows), stacked vertically, each with a small icon or dot
indicating its type.

## Data fetching

All four queries run in the existing `Promise.all` in `app/dashboard/page.tsx`
alongside the current stat queries — no new round trips, just more entries
in the same array:

- `budget_items`: `select("label, due_date, estimated_amount, paid_amount, vendor_id, vendors(name)")` filtered to the wedding with `.not("due_date", "is", null)` (the only filter Supabase can apply server-side here). The `paid_amount < estimated_amount` check and the 30-day/overdue window are both applied in JS after fetching — the table is small enough per wedding that this is fine.
- `guests`: existing `rsvp_status` count query extended to also count `pending` (separate `count: "exact", head: true` query, same pattern as the existing attending-guests query).
- `sponsors`: `select("name").eq("confirmed", false)` for names (separate from the existing confirmed-count query).
- `vendors`: `select("categories, status")` for the whole wedding, then in JS: for each category in `CATEGORY_ORDER`, check whether any vendor's `categories` array includes it AND has `status === "booked"`; collect categories with no match.

## Out of scope

- Configurable reminder windows (30 days is fixed, not a user setting).
- Dismissing/snoozing individual reminders.
- Push notifications or email reminders — this is a dashboard-only summary.
