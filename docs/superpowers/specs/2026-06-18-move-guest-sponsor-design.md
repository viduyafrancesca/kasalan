# Move people between Guests and Entourage

## Problem

Guests and the wedding entourage (principal sponsors, cord/veil/arrhae,
best man, maid of honor, bridesmaid, groomsman) are stored in two separate
Supabase tables — `guests` and `sponsors` — with different schemas. Today,
if someone is entered as a plain guest but later asked to be a sponsor (or
vice versa), the only option is deleting one entry and manually re-typing
everything into the other table. The couple wants to move a person between
the two lists without re-entering their name, contact info, and notes.

## Data model

No other table references `guests.id` or `sponsors.id` as a foreign key
(`lib/db/schema.ts` confirms this), so a "move" is simply: insert a new row
in the target table, then delete the source row. The moved person gets a
new UUID — nothing else depends on the old one.

**Fields carried over directly (exist on both tables):** `name`, `phone`,
`email`, `notes`.

**Guest → Sponsor:**
- `confirmed = (rsvp_status === "attending")` — preserves the attendance
  signal instead of discarding it.
- `role` — chosen via an inline role picker before the move is confirmed
  (sponsors require a role; there's no sensible default to guess).
- `meal_choice`, `table_number`, `plus_one` are dropped — sponsors have no
  equivalent fields. The UI shows a one-line note about this before the
  move so it isn't a silent surprise.

**Sponsor → Guest:**
- `rsvp_status = confirmed ? "attending" : "pending"` — same mapping in
  reverse.
- `meal_choice = null`, `table_number = null`, `plus_one = false` — sponsors
  never captured this data, so the new guest starts blank on these fields,
  same as any newly added guest.

## UI

Both actions live inside the existing per-person edit dialogs in
`app/guests/page.tsx` — no new screens.

**Guest edit dialog** gains a "Move to Entourage" button (placed between
the Save and Delete buttons). Clicking it swaps the dialog's lower section
to the same role-picker grid used in the Add Entourage dialog
(`ROLE_ORDER`/`ROLE_LABELS`), plus a one-line note ("Table number and meal
choice won't carry over") and "Confirm move" / "Cancel" buttons. "Cancel"
returns to the normal edit view without saving anything. "Confirm move"
performs the insert-then-delete, closes the dialog, and reloads the list.

**Sponsor edit dialog** gains a "Move to Guest List" button. Clicking it
swaps to an inline confirmation ("Move this person to the guest list?
Their role and confirmation status won't be needed anymore." + "Confirm
move" / "Cancel") — no extra input is needed since every guest field has a
mapping or a sensible blank default. Confirming performs the same
insert-then-delete, closes the dialog, and reloads.

In both cases, if the insert or delete fails, the error is surfaced in the
dialog the same way other dialogs in this codebase already handle Supabase
errors (e.g. `app/budget/page.tsx`'s `expenseError` pattern) — the move
must not silently fail.

## Out of scope

- No bulk-move (move multiple people at once).
- No "undo" — moving is a manual action the couple confirms; if they
  change their mind they move the person back, which is exactly the
  feature being built.
- No changes to the `sponsors` or `guests` table schemas — this works
  entirely with existing columns.
