# Customizable side/relationship tags

## Problem

The "Side" tag on guests and entourage members is currently a fixed
5-value Postgres enum (`guest_side`): one partner's family/friend, the
other partner's family/friend, or "Mutual Friend." The couple wants to
add their own custom tags (e.g. "College Friends," "Officemates") beyond
those five, and wants the five originals to behave like ordinary,
deletable entries too — not special-cased exceptions.

## Decision: defaults stay dynamic, custom tags are plain text

Side labels like "Maria's Family" are computed live from the partner
names stored in Settings — renaming a partner there updates every side
label automatically, with no extra step. Making every side fully custom
free text would lose that: a renamed partner would leave old side labels
stale until manually edited. The couple chose to keep that live behavior
for the five originals. A `kind` column distinguishes "this row's label
is computed from partner names" (one of the five known kinds) from "this
row's label is exactly what the user typed" (`kind` is `NULL`).

## Data model

```sql
CREATE TABLE wedding_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  kind text,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `kind` is one of `partner1_family`, `partner1_friend`, `partner2_family`,
  `partner2_friend`, `mutual_friend` for the five originals, or `NULL` for
  anything the couple adds themselves.
- `label` is `NULL` when `kind` is set (the display text is computed, not
  stored) and holds the literal text when `kind` is `NULL`.
- `sort_order`: the five defaults get 0–4 in their current display order;
  each custom addition gets `max(sort_order) + 1` for that wedding, so new
  tags always append at the end.
- No RLS policies — matching every other table in this app today
  (`guests`, `sponsors`, etc. have none; access is scoped entirely by the
  client always filtering on `wedding_id`). This is a known gap flagged
  for a possible future security pass across the whole app, not something
  this feature introduces or is expected to fix alone.

`guests.side` and `sponsors.side` change from the `guest_side` enum to a
`uuid` column referencing `wedding_sides.id`, `ON DELETE RESTRICT`. The
column **keeps the name `side`** — only its type changes — so existing
app code referencing `g.side`, `s.side`, `guestForm.side`, etc. keeps the
same field name, just holding a uuid string instead of an enum string.
`ON DELETE RESTRICT` is a database-level backstop; the real deletion gate
is the app-level usage check described below.

## Migration (run once, by the user, in the Supabase SQL editor)

```sql
CREATE TABLE wedding_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  kind text,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO wedding_sides (wedding_id, kind, sort_order)
SELECT id, 'partner1_family', 0 FROM weddings
UNION ALL
SELECT id, 'partner1_friend', 1 FROM weddings
UNION ALL
SELECT id, 'partner2_family', 2 FROM weddings
UNION ALL
SELECT id, 'partner2_friend', 3 FROM weddings
UNION ALL
SELECT id, 'mutual_friend', 4 FROM weddings;

ALTER TABLE guests ADD COLUMN side_new uuid REFERENCES wedding_sides(id) ON DELETE RESTRICT;
UPDATE guests g SET side_new = ws.id
  FROM wedding_sides ws
  WHERE ws.wedding_id = g.wedding_id AND ws.kind = g.side::text AND g.side IS NOT NULL;
ALTER TABLE guests DROP COLUMN side;
ALTER TABLE guests RENAME COLUMN side_new TO side;

ALTER TABLE sponsors ADD COLUMN side_new uuid REFERENCES wedding_sides(id) ON DELETE RESTRICT;
UPDATE sponsors s SET side_new = ws.id
  FROM wedding_sides ws
  WHERE ws.wedding_id = s.wedding_id AND ws.kind = s.side::text AND s.side IS NOT NULL;
ALTER TABLE sponsors DROP COLUMN side;
ALTER TABLE sponsors RENAME COLUMN side_new TO side;

DROP TYPE guest_side;
```

Existing `side` values on every guest/sponsor row are preserved — each one
is re-pointed at the matching new `wedding_sides` row for its wedding
before the old enum column is dropped.

## Deletion behavior

Clicking delete on a side runs a `count(*)` across `guests` + `sponsors`
where `side` equals that row's id (one query per table, summed).

- **Count > 0:** show an inline warning — "N people are tagged with this
  side — remove the tag from them first" — and do not delete.
- **Count = 0:** delete immediately. No separate "are you sure" step,
  matching how every other delete action in this app already behaves
  (Guests, Sponsors, Budget items, Vendors).

## UI

**Settings page (`/more/settings`):** a new "Sides" section — a list of
every `wedding_sides` row (ordered by `sort_order`) with its computed
display label and a delete button per row, plus a small "Add side" text
input + button that inserts a new custom row.

**Guests page (`app/guests/page.tsx`):** the side picker (in the Guest
dialog, the Sponsor/Entourage dialog, and the filter dialog) stops using
the static `SIDE_ORDER` array and `GuestSide` union type. It instead
fetches the wedding's `wedding_sides` rows (same `load()` call that
already fetches guests/sponsors/coupleNames) and renders them in
`sort_order`, computing each row's display label the same way the
Settings page does — plus "Unspecified" (`side = null`) as a permanent,
non-deletable extra option, exactly as today.

**Setup wizard (`app/setup/page.tsx`):** `handleFinish()` inserts the same
5 default `wedding_sides` rows (kind + sort_order, no label) for the
newly created wedding, right alongside its existing `wedding_setup` and
`checklist_items` inserts — so every wedding created after this change
starts with the same five defaults the migration backfills for existing
weddings.

## Out of scope

- No RLS added anywhere — flagged as a future cross-table security
  initiative, not part of this feature.
- No reordering UI for custom sides (no drag-to-reorder) — they always
  append at the end by creation order.
- No bulk reassignment tool (e.g. "move everyone from side A to side B
  before deleting A") — the warning tells the couple how many people are
  affected; reassigning them happens one at a time via the existing Guest/
  Sponsor edit dialogs, same as any other field edit.
