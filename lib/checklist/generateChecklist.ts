import { CHECKLIST_TEMPLATES, type TemplateInput } from "./templates";

export type SetupAnswers = {
  ceremonyType: "catholic" | "civil" | "christian" | "garden" | "beach";
  hasCoordinator: boolean;
  hasCotillion: boolean;
  hasCivilRegistration: boolean;
  hasSecondarySponsors: boolean;
};

export function filterTemplates(setup: SetupAnswers): TemplateInput[] {
  return CHECKLIST_TEMPLATES.filter((t) => {
    const types = t.ceremonyTypes ?? [];
    if (!types.includes(setup.ceremonyType)) return false;

    if (t.requiresCoordinator === true && !setup.hasCoordinator) return false;
    if (t.requiresCoordinator === false && setup.hasCoordinator) return false;

    if (t.requiresCotillion === true && !setup.hasCotillion) return false;
    if (t.requiresCotillion === false && setup.hasCotillion) return false;

    return true;
  });
}

export function monthLabel(monthsBefore: number): string {
  if (monthsBefore <= 0.25) return "1 Week Before";
  if (monthsBefore === 1)   return "1 Month Before";
  return `${monthsBefore} Months Before`;
}

export function monthsUntilWedding(weddingDate: string | null | undefined): number | null {
  if (!weddingDate) return null;
  const today = new Date();
  const target = new Date(weddingDate);
  const diffMs = target.getTime() - today.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.44);
}

export type GroupedTasks<T> = { label: string; items: T[] };

export function groupByTimeline<T extends { monthsBefore?: number | string | null; months_before?: number | string | null }>(
  items: T[],
  weddingDate: string | null | undefined
): GroupedTasks<T>[] {
  const monthsLeft = monthsUntilWedding(weddingDate);

  const overdue: T[] = [];
  const bucketMap = new Map<number, T[]>(MONTH_BUCKETS.map((b) => [b, []]));

  for (const item of items) {
    // Supabase returns snake_case; Drizzle types use camelCase — handle both
    const mb = Number(item.months_before ?? item.monthsBefore);
    if (monthsLeft !== null && mb > monthsLeft) {
      overdue.push(item);
    } else {
      // Find the matching bucket (exact match from schema values)
      const bucket = MONTH_BUCKETS.find((b) => b === mb) ?? mb;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(item);
    }
  }

  const groups: GroupedTasks<T>[] = [];
  if (overdue.length > 0) groups.push({ label: "Overdue — Do These Now", items: overdue });

  for (const bucket of MONTH_BUCKETS) {
    const bucketItems = bucketMap.get(bucket) ?? [];
    if (bucketItems.length > 0) groups.push({ label: monthLabel(bucket), items: bucketItems });
  }

  return groups;
}

export const MONTH_BUCKETS = [12, 9, 6, 3, 1, 0.25] as const;
