export type VendorCategory =
  | "venue" | "catering" | "photography" | "videography" | "flowers"
  | "hair_makeup" | "styling" | "attire" | "sounds_lights" | "cake"
  | "invitations" | "transportation" | "other";

export const CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue:          "Venue",
  catering:       "Catering",
  photography:    "Photography",
  videography:    "Videography",
  flowers:        "Flowers",
  hair_makeup:    "Hair & Makeup",
  styling:        "Styling",
  attire:         "Attire",
  sounds_lights:  "Sounds & Lights",
  cake:           "Cake",
  invitations:    "Invitations",
  transportation: "Transportation",
  other:          "Other",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as VendorCategory[];

export function getActiveCategories(hidden: VendorCategory[]): VendorCategory[] {
  return CATEGORY_ORDER.filter((c) => !hidden.includes(c));
}
