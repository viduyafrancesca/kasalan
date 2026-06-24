# Desktop Navigation Expansion — Design Spec

## Purpose

This app's primary nav (Home, Checklist, Budget, Guests) plus a catch-all "More" page (Entourage, Vendor Shortlist, Compare Packages, Supplier Lineup, Share, Settings) was designed for mobile's limited bottom-nav width. On desktop, the sidebar (`components/shared/SideNav.tsx`) currently mirrors the same 5-item structure even though it has plenty of vertical room to show every page as its own link. This project makes the desktop sidebar use that space: the 4 main items stay first, then every page that's currently buried inside `/more` gets its own direct sidebar link.

## Scope

- Desktop sidebar (`SideNav.tsx`, `hidden lg:flex`) only. Mobile bottom nav (`BottomNav.tsx`, `lg:hidden`) is unchanged — still exactly Home/Tasks/Budget/Guests/More.
- The `/more` page itself is untouched and stays reachable by direct navigation (e.g. an old bookmark, or if linked from elsewhere later) — it's simply no longer linked from the desktop sidebar, since every item it lists now has its own sidebar link.
- This is sub-project 1 of a two-part "make the site more responsive" request. Sub-project 2 (a responsive audit of other pages/components at various widths) is a separate follow-up after this ships, since it requires inspecting the app first to find concrete issues before fixes can be specified.

## Design

**New file: `lib/navigation.ts`** — single source of truth for the items currently hardcoded in `app/more/page.tsx`'s `SECTIONS` array:

```ts
export const MORE_SECTIONS = [
  { href: "/more/entourage",       label: "Entourage",       desc: "Ninong, ninang & secondary sponsors",             Icon: Heart },
  { href: "/more/vendors",         label: "Vendor Shortlist", desc: "Venues, caterers, photographers & more",         Icon: MapPin },
  { href: "/more/compare",         label: "Compare Packages", desc: "Side-by-side vendor comparison by category",     Icon: GitCompare },
  { href: "/more/supplier-lineup", label: "Supplier Lineup",  desc: "Build and save a full vendor combination",      Icon: ListChecks },
  { href: "/more/share",           label: "Share",            desc: "Invite partner or share with family",            Icon: Share2 },
  { href: "/more/settings",        label: "Settings",         desc: "Wedding details, ceremony preferences & account", Icon: Settings },
];
```

`app/more/page.tsx` imports `MORE_SECTIONS` instead of defining its own `SECTIONS` array — same rendering, same order, just sourced from the shared module. This removes the only duplication risk between the `/more` page and the sidebar.

**`components/shared/SideNav.tsx`** — its own `NAV` array drops the "More" entry, keeping just Home/Checklist/Budget/Guests. Below that 4-item block, a thin horizontal divider, then the sidebar maps over `MORE_SECTIONS` rendering icon + label (no description — sidebar rows are compact, one line each) as additional links, in the same order as `MORE_SECTIONS`. Active-state highlighting (the existing `pathname === href` / `pathname.startsWith(href)` check) applies identically to these new links as it already does to the main 4.

**`components/shared/BottomNav.tsx`** — no changes.

## Out of Scope

- Any change to mobile's bottom nav structure or the `/more` page's own UI.
- The broader responsive audit (sub-project 2) — covered separately once this ships.
