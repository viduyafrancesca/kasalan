# Legal Requirements card on the Dashboard

## Problem

Checklist tasks in the "Legal" category (civil registration, marriage
license, PSA documents, etc. — see `lib/checklist/templates.ts`) are
currently mixed into the Dashboard's "Up Next" feed alongside every
other category, sorted purely by `months_before`. Legal/civil paperwork
often has hard external deadlines tied to government offices (LCR,
PSA), so the couple wants it called out on its own, separate from the
general task feed — but only on the Dashboard. The Checklist page itself
(`/checklist`, grouped by month timeline) is unaffected.

## Decision

**New section, Dashboard only:** A "Legal Requirements" card appears
between the existing "Reminders" and "Up Next" sections on
`app/dashboard/page.tsx`. It lists every `checklist_items` row with
`category = 'Legal'` for the wedding (both complete and incomplete),
ordered by `months_before` ascending — same ordering Up Next already
uses. The header shows a done/total count (e.g. "2/5"), matching the
Checklist page's existing month-group header style
(`groupDone`/`group.items.length`).

Each row shows the task title with a small circular indicator — filled
accent with a checkmark when complete, empty border when not — same
visual language as the Checklist page's row indicator. The card is
**read-only**: no checkbox toggle, no click action. This matches every
other Dashboard card today (stat cards, Reminders, Up Next are all
display-only; completion only happens on `/checklist`).

If the wedding has zero Legal-category tasks (e.g. `has_civil_registration`
was turned off in Settings, so the setup wizard never generated any),
the card doesn't render at all — same empty-state pattern the Reminders
section already follows (`reminders.length > 0 && (...)`).

**Up Next excludes Legal:** Up Next's existing query gets a `.neq("category", "Legal")`
filter added, so a Legal task never shows in both places at once. Up
Next continues to show the next 4 soonest incomplete tasks from every
other category, unchanged otherwise.

## Data flow

One new query added to the dashboard's existing `Promise.all([...])`:

```ts
supabase.from("checklist_items")
  .select("id, title, completed")
  .eq("wedding_id", wedding.id)
  .eq("category", "Legal")
  .order("months_before", { ascending: true }),
```

The existing Up Next query:

```ts
supabase.from("checklist_items")
  .select("id, title, category, months_before")
  .eq("wedding_id", wedding.id)
  .eq("completed", false)
  .order("months_before", { ascending: true })
  .limit(4),
```

gains `.neq("category", "Legal")` before `.order(...)`.

## Out of scope

- No change to `/checklist` — it keeps showing Legal tasks inline with
  every other category, grouped by month timeline, exactly as today.
- No interactivity (checkbox/toggle) on the new card.
- No new component file — implemented inline in
  `app/dashboard/page.tsx`, matching how "Up Next" and "Reminders" are
  already written inline rather than as separate component files.
