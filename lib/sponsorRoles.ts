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
  principal:     "Principal",
  cord:          "Cord",
  veil:          "Veil",
  arrhae:        "Arrhae",
  candle:        "Candle",
  ring_bearer:   "Ring Bearer",
  bible_bearer:  "Bible Bearer",
  flower_girl:   "Flower Girl",
  best_man:      "Best Man",
  maid_of_honor: "Maid of Honor",
  bridesmaid:    "Bridesmaid",
  groomsman:     "Groomsman",
};

export const ROLE_DESCRIPTIONS: Record<SponsorRole, string> = {
  principal:     "Ninong & Ninang — witness the vows",
  cord:          "Symbol of everlasting bond",
  veil:          "Symbol of purity and unity",
  arrhae:        "13 coins — symbol of prosperity",
  candle:        "Symbol of the light of Christ",
  ring_bearer:   "Carries the wedding rings",
  bible_bearer:  "Carries the Bible or missal",
  flower_girl:   "Scatters flower petals before the bride",
  best_man:      "Groom's closest friend or brother",
  maid_of_honor: "Bride's closest friend or sister",
  bridesmaid:    "Bride's side of the entourage",
  groomsman:     "Groom's side of the entourage",
};
