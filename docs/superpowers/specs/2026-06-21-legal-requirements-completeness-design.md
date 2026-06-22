# Complete the Legal requirements checklist for civil, Catholic, and Christian weddings

## Problem

Research into actual Philippine marriage requirements (PSA, LCR, parish,
and denomination-specific rules) found the seeded checklist is missing
several real, commonly-needed pre-wedding documents and steps:

- **Universal** (every ceremony type): CENOMAR and the civil
  Pre-Marriage Counseling (PMC) seminar — both required before the LCR
  will issue a marriage license — aren't in the checklist at all.
- **Catholic**: baptismal certificate, confirmation certificate (both
  "for marriage purposes"), and marriage banns aren't in the checklist,
  even though they're standard requirements for any Catholic wedding.
- **Christian** (non-Catholic): the ceremony type has **zero** Legal or
  Church Requirements tasks today. Every existing Church Requirements
  entry is tagged `catholic`-only.

(The Catholic "mixed marriage" interfaith clearance was researched too,
but is explicitly excluded — it only applies when one partner isn't
Catholic, and there's no existing setup-wizard toggle to conditionally
include/exclude a task like there is for `has_coordinator`/
`has_cotillion`. Adding one is a separate, bigger feature.)

## Decision: everything goes into the `Legal` category

The app has a separate `Church Requirements` category for
church-administrative scheduling (Pre-Cana, the canonical interview),
but all new items — including the church-administrative ones
(baptismal cert, confirmation cert, marriage banns) — go into `Legal`
instead. This matches what was asked: the Dashboard's Legal Requirements
card becomes the single, complete pre-wedding paperwork list, regardless
of whether the document comes from a government office or a parish.

## New template entries

All added to `lib/checklist/templates.ts`'s `CHECKLIST_TEMPLATES` array,
following the existing `TemplateInput` shape (`title`, `category`,
`monthsBefore`, `ceremonyTypes`, `description`, `sortOrder`, and the
existing `dependsOnTitle` field added in the previous Legal-card-urgency
feature).

**Universal** (`ceremonyTypes: ALL`):

| Title | monthsBefore | description | dependsOnTitle |
|---|---|---|---|
| Apply for CENOMAR at PSA | 6 | "Certificate of No Marriage Record — valid 6 months, required for the marriage license application." | — |
| Attend Pre-Marriage Counseling (PMC) seminar | 6 | "Required under the RH Law before the LCR can issue your marriage license. Separate from any church Pre-Cana seminar." | — |

**Catholic only** (`ceremonyTypes: ["catholic"]`):

| Title | monthsBefore | description | dependsOnTitle |
|---|---|---|---|
| Secure baptismal certificate (for marriage purposes) | 6 | "Newly issued with a \"For Marriage Purposes\" annotation; valid 6 months." | — |
| Secure confirmation certificate (for marriage purposes) | 6 | "Newly issued with a \"For Marriage Purposes\" annotation; valid 6 months." | — |
| File marriage banns at your home parishes | 3 | "Posted at both parties' home parishes for 3 consecutive Sundays, then returned to the wedding parish." | "Schedule canonical interview at the parish" |

**Christian only** (`ceremonyTypes: ["christian"]`) — a new track, since
this ceremony type currently has no Legal or Church Requirements items
at all:

| Title | monthsBefore | description | dependsOnTitle |
|---|---|---|---|
| Confirm church membership requirements with your chosen church | 9 | "Most congregations require at least one party to be an active member in good standing." | — |
| Complete your church's pre-marital counseling/seminar | 6 | "Format and length vary by denomination — ask your church directly." | "Confirm church membership requirements with your chosen church" |
| Confirm officiating minister's marriage solemnizing authority (CRASM) | 6 | "Confirm your pastor/minister is registered with the PSA to legally solemnize marriages — ask for their CRASM registration." | — |

**Note on the marriage banns dependency:** `"Schedule canonical
interview at the parish"` lives in the `Church Requirements` category,
not `Legal`. The Dashboard's Legal Requirements card only fetches
`Legal`-category rows, so the corrective sort pass in
`lib/checklist/legalOrder.ts` (which reorders a task to appear after its
prerequisite) won't find that title in its fetched list and will no-op
for this one dependency — harmless, since `months_before` (6 vs. 3)
already puts the canonical interview before marriage banns on its own.
The "Requires: Schedule canonical interview at the parish" note still
renders correctly underneath the banns task either way, since the note
just displays whatever string is in `depends_on_title` — it doesn't
require the referenced task to be in the same fetched list.

**Note on marriage-license dependency limits:** `depends_on_title` only
holds one prerequisite per task. "Apply for marriage license at LCR"
already depends on `"Prepare PSA birth certificates"` from the earlier
feature; in reality it also needs CENOMAR and the PMC certificate, but
this isn't modeled as a second dependency edge — those two new tasks sit
at the same `months_before: 6` tier as peers with no dependency wiring
into the license application. Out of scope to extend to multiple
dependencies for this pass.

## Backfilling existing weddings

New weddings get these tasks automatically once `lib/checklist/templates.ts`
is updated, since `app/setup/page.tsx`'s `handleFinish()` already reads
from this file. Weddings created **before** this ships need a one-time
SQL backfill that inserts the new `checklist_items` rows (matching each
existing wedding's `ceremony_type` from `wedding_setup`) so they're not
missing these tasks retroactively. The backfill only inserts rows for
weddings that don't already have a `checklist_items` row with that exact
`title` for that `wedding_id` (idempotent — safe to re-run, and avoids
duplicating a task a couple already has under a slightly different
flow).

## Out of scope

- No interfaith/mixed-marriage clearance task (explicitly excluded above).
- No multi-dependency support for `depends_on_title`.
- No new setup-wizard questions or toggles.
- No changes to the `Church Requirements` category's existing items.
