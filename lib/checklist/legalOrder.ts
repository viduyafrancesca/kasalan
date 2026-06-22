export type LegalItem = {
  id: string;
  title: string;
  completed: boolean;
  depends_on_title: string | null;
  months_before: number | string;
};

export function sortLegalItems(items: LegalItem[]): LegalItem[] {
  const sorted = [...items].sort((a, b) => Number(b.months_before) - Number(a.months_before));

  for (const item of sorted) {
    if (!item.depends_on_title) continue;
    const prereqIndex = sorted.findIndex((i) => i.title === item.depends_on_title);
    const itemIndex = sorted.indexOf(item);
    if (prereqIndex === -1 || prereqIndex < itemIndex) continue;

    sorted.splice(itemIndex, 1);
    const newPrereqIndex = sorted.findIndex((i) => i.title === item.depends_on_title);
    sorted.splice(newPrereqIndex + 1, 0, item);
  }

  return sorted;
}
