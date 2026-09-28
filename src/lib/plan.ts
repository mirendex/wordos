export function daysLeft(today: string, until: string): number {
  const a = new Date(today + 'T00:00');
  const b = new Date(until + 'T00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dailyQuota(fresh: number, daysLeftCount: number): number {
  if (fresh <= 0) return 0;
  const days = Math.max(1, daysLeftCount);
  return Math.max(5, Math.min(20, Math.ceil(fresh / days)));
}

export interface GoalProgressItem {
  id: string;
}

export interface GoalProgressCard {
  b: number;
  skip?: 1;
}

export function goalProgress(
  items: Record<string, GoalProgressItem>,
  srs: Record<string, GoalProgressCard>,
): { learned: number; total: number } {
  const ids = Object.keys(items);
  const learned = ids.filter((id) => srs[id] && (srs[id].skip || srs[id].b >= 3)).length;
  return { learned, total: ids.length };
}
