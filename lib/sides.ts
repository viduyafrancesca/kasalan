export type SideKind =
  | "partner1_family" | "partner1_friend"
  | "partner2_family" | "partner2_friend"
  | "mutual_friend";

export type WeddingSide = {
  id: string;
  wedding_id: string;
  kind: SideKind | null;
  label: string | null;
  sort_order: number;
  created_at: string;
};

export function sideLabel(side: WeddingSide, coupleNames: { name1: string; name2: string }): string {
  switch (side.kind) {
    case "partner1_family": return `${coupleNames.name1}'s Family`;
    case "partner1_friend":  return `${coupleNames.name1}'s Friend`;
    case "partner2_family": return `${coupleNames.name2}'s Family`;
    case "partner2_friend":  return `${coupleNames.name2}'s Friend`;
    case "mutual_friend":    return "Mutual Friend";
    default:                 return side.label ?? "";
  }
}

export function findSideLabel(
  sideId: string | null,
  sides: WeddingSide[],
  coupleNames: { name1: string; name2: string }
): string {
  if (!sideId) return "Unspecified";
  const side = sides.find((s) => s.id === sideId);
  return side ? sideLabel(side, coupleNames) : "Unspecified";
}
