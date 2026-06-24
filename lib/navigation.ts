import { type LucideIcon, Heart, MapPin, GitCompare, ListChecks, Share2, Settings } from "lucide-react";

export type MoreSection = {
  href: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
};

export const MORE_SECTIONS: MoreSection[] = [
  { href: "/more/entourage",       label: "Entourage",       desc: "Ninong, ninang & secondary sponsors",             Icon: Heart },
  { href: "/more/vendors",         label: "Vendor Shortlist", desc: "Venues, caterers, photographers & more",         Icon: MapPin },
  { href: "/more/compare",         label: "Compare Packages", desc: "Side-by-side vendor comparison by category",     Icon: GitCompare },
  { href: "/more/supplier-lineup", label: "Supplier Lineup",  desc: "Build and save a full vendor combination",      Icon: ListChecks },
  { href: "/more/share",           label: "Share",            desc: "Invite partner or share with family",            Icon: Share2 },
  { href: "/more/settings",        label: "Settings",         desc: "Wedding details, ceremony preferences & account", Icon: Settings },
];
