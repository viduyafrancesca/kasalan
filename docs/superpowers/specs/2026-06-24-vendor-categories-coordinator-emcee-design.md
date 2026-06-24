# Add Event Coordinator & Emcee Vendor Categories — Design Spec

## Purpose

The Vendor Shortlist (and everywhere that reads from it — Compare Packages, Supplier Lineup) is missing two common Filipino wedding suppliers: an event coordinator and an emcee. This adds both as proper vendor categories.

## Scope

- Two new `VendorCategory` enum values: `event_coordinator` (label "Event Coordinator") and `emcee` (label "Emcee").
- Display order: right after `venue`, before `catering` — i.e. `CATEGORY_ORDER` becomes `venue, event_coordinator, emcee, catering, photography, ...` (unchanged otherwise).
- `VendorCategory` is backed by a Postgres enum (`vendor_category`, via `lib/db/schema.ts`'s `vendorCategoryEnum`) used by the `vendors.categories` array column. Adding values requires a manually-run migration, per this project's established schema-change workflow: SQL is written to a dated file under `supabase/migrations/` (gitignored, never committed), the user runs it themselves in the Supabase SQL editor, and code changes don't ship until they confirm it's run.
- No other code changes: Vendor Shortlist, Compare Packages, and Supplier Lineup all already derive their category list from `CATEGORY_ORDER` / `getActiveCategories()` in `lib/categories.ts` — adding the two new entries there is sufficient for the new categories to appear everywhere automatically (vendor add/edit dialog, compare table tabs, lineup builder rows).

## Migration

```sql
ALTER TYPE vendor_category ADD VALUE 'event_coordinator' AFTER 'venue';
ALTER TYPE vendor_category ADD VALUE 'emcee' AFTER 'event_coordinator';
```

(Postgres lets new enum values be inserted at a specific position via `AFTER`, so the underlying enum's physical ordering matches the desired display order — though `lib/categories.ts`'s `CATEGORY_ORDER` array is what actually controls UI display order, independent of the enum's internal order.)

## `lib/categories.ts` Changes

- `VendorCategory` union gains `"event_coordinator" | "emcee"`.
- `CATEGORY_LABELS` gains `event_coordinator: "Event Coordinator"` and `emcee: "Emcee"`.
- `CATEGORY_ORDER` (derived from `Object.keys(CATEGORY_LABELS)`) automatically reflects the new entries in whatever order they're added to the `CATEGORY_LABELS` object literal — so both new keys are inserted right after `venue` in the object literal itself to get the desired display order.

## Out of Scope

- Any change to existing vendors, checklist templates, or other category-driven features beyond the two new entries.
- Renaming or reordering any existing category.
