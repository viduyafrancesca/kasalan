# Supplier Lineup — Move Inclusions to Bottom — Design Spec

## Purpose

In the Supplier Lineup builder (`app/more/supplier-lineup/[id]/page.tsx`), each category row currently shows the picked vendor's inclusion tags inline. Since a vendor can be picked into multiple category slots (e.g. Vendor A does both Venue and Catering as one package — already supported per the multi-category-picking design), its inclusion tags currently render once per slot, repeating the same list. This moves inclusions out of the category rows into a single section at the bottom of the page, deduplicated by vendor.

## Scope

- Applies to both surfaces in the builder page that currently render per-category inclusions: the interactive on-screen view and the print-only summary block (shown via "Print / Save as PDF").
- Category rows lose their inclusion-tag display entirely — they keep vendor name, price range, and contact only.
- A new "Inclusions" section appears below the category list (interactive view) / below the picked-categories list (print view), listing each **unique vendor currently picked anywhere in the lineup** once, with that vendor's inclusion tags — deduplication is by vendor, not by individual tag, so two different vendors that happen to share an identical tag (e.g. both have "Free parking") still each get their own line.
- A vendor with an empty inclusions list is skipped in this section (nothing to show). If no picked vendor in the lineup has any inclusions at all, the entire section is omitted (consistent with how the Compare Packages page already omits its Inclusions section when empty).
- Out of scope: the Compare Packages page (`app/more/compare/page.tsx`) and the Vendors page dialog — neither is affected by this change, since this is specific to how the Supplier Lineup builder renders picks.

## Design

**Deduplication logic:** iterate `activeCategories` in order, look up each category's pick via the existing `picksByCategory` map, and collect each vendor the first time it's encountered (skipping repeats) — the same dedup pattern already used for the total-price calculation on this page, applied here to build a `uniqueInclusionVendors: Vendor[]` list instead of a price sum. Only vendors with `inclusions.length > 0` are included.

**Interactive view:** the existing per-category inclusion-chip block is removed from each category row. After the category list card and before the "Print / Save as PDF" button, a new card renders (only if `uniqueInclusionVendors.length > 0`): a header labeled "Inclusions," then one row per unique vendor showing its name and its inclusion tags as the same chip style currently used inline.

**Print summary:** the existing per-category inclusion line (`{pick.vendor.inclusions.length > 0 && <p>...}`) is removed from each picked-category block. After the picked-categories loop, a new block renders (only if `uniqueInclusionVendors.length > 0`): a header labeled "Inclusions," then one line per unique vendor in the form "Vendor Name: tag, tag, tag" — matching the print summary's existing plain-text style (no chips, since the print layout doesn't use chip styling anywhere else).
