# Urgency/prerequisite ordering for the Legal Requirements card

## Problem

The Dashboard's "Legal Requirements" card (added previously) lists every
`Legal`-category checklist task, but in an order that doesn't reflect
when each task actually needs to happen. It currently sorts
`months_before` ascending, which is backwards: in this app's data model,
a *higher* `months_before` means the task should be tackled earlier
(further from the wedding day), and a *lower* one means it's meant for
right before the wedding. There's also no way to express that one Legal
task genuinely can't be done until another is finished — e.g. applying
for a marriage license requires PSA birth certificates first, even
though both are tagged `months_before: 6` today and sort arbitrarily
relative to each other.

## Decision

**Ordering fix:** Sort the Legal Requirements card by `months_before`
descending — this alone fixes the chronological order for every Legal
task except the one real tie (PSA certificates and the marriage license
application both at `months_before: 6`).

**Dependency data:** Add a nullable `depends_on_title` text column to
both `checklist_templates` and `checklist_items`, holding the exact
`title` string of the prerequisite task (or `null` if none). This is
set for the two real Legal dependencies:

- `"Apply for marriage license at LCR"` → depends on
  `"Prepare PSA birth certificates"`
- `"Confirm marriage license is ready"` → depends on
  `"Apply for marriage license at LCR"`

`"Inquire with the civil registrar (LCR)"` and `"Prepare PSA birth
certificates"` have no dependency (`null`) — they're the first step in
their respective chains.

A title string (not a foreign key to another row) is enough here: the
dependency is a fixed property of *what the task is*, not of any
specific wedding's data, so it's set once on the templates and copied
verbatim onto each wedding's generated `checklist_items` rows at setup
time — there's no need to resolve or store a row ID.

**Card behavior:**
1. Fetch Legal items including the new `depends_on_title` column.
2. Sort by `months_before` descending.
3. Run one corrective pass: for any item with a `depends_on_title`
   matching another item currently later in the list, move the
   dependent item to immediately after its prerequisite. This only
   ever fires for the PSA/marriage-license tie today, but works
   generally for any future Legal task with a same-`months_before`
   dependency.
4. Each task with a `depends_on_title` shows a small line underneath
   reading `Requires: <title>`, shown regardless of whether that
   prerequisite is itself already complete — it's informational
   context for why the task is ordered where it is, not a live blocker
   state.

## Data flow / migration

A migration adds the column to both tables and backfills the two known
dependencies onto any already-existing `checklist_items` rows for
existing weddings (matched by exact `title`, scoped to
`category = 'Legal'`):

```sql
ALTER TABLE checklist_templates ADD COLUMN depends_on_title text;
ALTER TABLE checklist_items ADD COLUMN depends_on_title text;

UPDATE checklist_templates SET depends_on_title = 'Prepare PSA birth certificates'
  WHERE title = 'Apply for marriage license at LCR';
UPDATE checklist_templates SET depends_on_title = 'Apply for marriage license at LCR'
  WHERE title = 'Confirm marriage license is ready';

UPDATE checklist_items SET depends_on_title = 'Prepare PSA birth certificates'
  WHERE category = 'Legal' AND title = 'Apply for marriage license at LCR';
UPDATE checklist_items SET depends_on_title = 'Apply for marriage license at LCR'
  WHERE category = 'Legal' AND title = 'Confirm marriage license is ready';
```

`lib/checklist/templates.ts`'s in-code template list (the source the
setup wizard reads at signup, separate from the DB `checklist_templates`
table — confirmed this app's setup wizard generates tasks directly from
this file, not from a `checklist_templates` table read) gets a
`dependsOnTitle` field added to the two relevant template entries, and
`app/setup/page.tsx`'s `handleFinish()` copies it onto each inserted
`checklist_items` row.

(The `ALTER TABLE checklist_templates` statement is included for
completeness/consistency with `lib/db/schema.ts`'s documentation mirror,
even though the live app doesn't currently query that table at runtime —
confirmed by reading `app/setup/page.tsx`, which builds tasks from
`lib/checklist/generateChecklist.ts` + `lib/checklist/templates.ts`
entirely in application code.)

## Out of scope

- No general dependency graph / multi-level chain resolution beyond the
  single corrective pass described above — sufficient for the known
  Legal tasks today.
- No change to other categories or to the Checklist page's own
  month-grouped view — this is Legal-card-only, Dashboard-only, same
  scope boundary as the original Legal card feature.
- No blocking behavior (e.g. disabling a task until its prerequisite is
  done) — the "Requires" note is informational only.
