# Sponsors page → read-only Entourage page

## Problem

`/more/sponsors` was the original CRUD surface for entourage members. Since
the Guests page was unified to manage both guests and entourage in one
place (with its own role picker, move-between-lists actions, and the new
side tag), `/more/sponsors` now duplicates editing capability the Guests
page already owns — two places that can write the same `sponsors` rows.
The couple also wants three roles this page is missing: Flower Girl, Bible
Bearer, and Ring Bearer.

## Decision

Convert `/more/sponsors` into a read-only, role-grouped reference view
named "Entourage." All editing — add, edit, delete, and the confirm/pending
toggle — happens exclusively through the Guests page's existing Sponsor
dialog. Rows on the renamed page are not tappable; it exists purely to
browse the entourage by ceremony role, with each role's meaning shown
underneath (a feature the Guests page doesn't have room for and shouldn't
duplicate).

## Root cause of the duplication risk

`SponsorRole`, `ROLE_ORDER`, and `ROLE_LABELS` are each defined twice today
— once locally in `app/guests/page.tsx`, once locally in
`app/more/sponsors/page.tsx` — with no shared source. Adding 3 new roles by
hand-editing both files would re-create the exact drift risk being raised
here. Instead, a new `lib/sponsorRoles.ts` becomes the single source of
truth, following this project's existing pattern (`lib/categories.ts` for
vendor categories, `lib/budget.ts` for budget totals, etc.):

```ts
export type SponsorRole =
  | "principal" | "cord" | "veil" | "arrhae" | "candle"
  | "ring_bearer" | "bible_bearer" | "flower_girl"
  | "best_man" | "maid_of_honor" | "bridesmaid" | "groomsman";

export const ROLE_ORDER: SponsorRole[] = [
  "principal", "cord", "veil", "arrhae", "candle",
  "ring_bearer", "bible_bearer", "flower_girl",
  "best_man", "maid_of_honor", "bridesmaid", "groomsman",
];

export const ROLE_LABELS: Record<SponsorRole, string> = {
  principal: "Principal", cord: "Cord", veil: "Veil", arrhae: "Arrhae", candle: "Candle",
  ring_bearer: "Ring Bearer", bible_bearer: "Bible Bearer", flower_girl: "Flower Girl",
  best_man: "Best Man", maid_of_honor: "Maid of Honor", bridesmaid: "Bridesmaid", groomsman: "Groomsman",
};

export const ROLE_DESCRIPTIONS: Record<SponsorRole, string> = {
  principal: "Ninong & Ninang — witness the vows",
  cord: "Symbol of everlasting bond",
  veil: "Symbol of purity and unity",
  arrhae: "13 coins — symbol of prosperity",
  candle: "Symbol of the light of Christ",
  ring_bearer: "Carries the wedding rings",
  bible_bearer: "Carries the Bible or missal",
  flower_girl: "Scatters flower petals before the bride",
  best_man: "Groom's closest friend or brother",
  maid_of_honor: "Bride's closest friend or sister",
  bridesmaid: "Bride's side of the entourage",
  groomsman: "Groom's side of the entourage",
};
```

`ROLE_LABELS` stays singular (used for per-person badges on both pages).
The Entourage page's plural section headers ("Bridesmaids," "Groomsmen")
are irregular and can't be derived automatically, so that page keeps one
small local `ROLE_GROUP_LABELS` map — but the *role list itself*
(`ROLE_ORDER`) and the role *meaning* (`ROLE_DESCRIPTIONS`) now exist in
exactly one place.

## Database migration

```sql
ALTER TYPE sponsor_role ADD VALUE 'ring_bearer';
ALTER TYPE sponsor_role ADD VALUE 'bible_bearer';
ALTER TYPE sponsor_role ADD VALUE 'flower_girl';
```

Run by the user in the Supabase SQL editor, per this project's established
convention — schema changes are never run automatically.

## Page changes

**`app/more/sponsors/page.tsx` → `app/more/entourage/page.tsx`:**
- Title changes from "Sponsors" to "Entourage."
- `SponsorRole`, `ROLE_ORDER`, `ROLE_LABELS` are deleted from this file and
  imported from `lib/sponsorRoles.ts` instead; `ROLE_DESCRIPTIONS` is
  imported too (no longer locally defined).
- `openAdd`, `openEdit`, `save`, `remove`, `toggleConfirmed`, the Add/Edit
  dialog, and the floating Add button are all removed — there is no write
  path left on this page.
- Each row stops being a `<button>` (which opened the edit dialog) and
  becomes a plain `<div>` — not tappable, matching the "pure reference
  view" decision.
- The avatar's confirm-toggle behavior is removed along with it; the
  avatar just shows a checkmark or initial, no longer clickable.

**`app/more/page.tsx`** (the "More" hub): the link currently pointing at
`/more/sponsors` with label "Sponsors" is updated to point at
`/more/entourage` with label "Entourage."

**`app/guests/page.tsx`:** its local `SponsorRole`, `ROLE_ORDER`, and
`ROLE_LABELS` definitions are deleted and replaced with imports from
`lib/sponsorRoles.ts`. No other behavior on this page changes — the
existing role picker (used for both the Sponsor dialog and the
move-to-entourage flow) automatically gains the 3 new roles because it
already iterates `ROLE_ORDER`.

## Out of scope

- No redirect from the old `/more/sponsors` URL — the route is deleted
  outright (no backwards-compatibility shim), consistent with this
  project's stated convention of deleting unused code rather than leaving
  compatibility scaffolding behind.
- No change to how the side tag (shipped separately) or the move-between-
  lists actions work — this plan only touches role data and the
  sponsors→entourage page conversion.
