/**
 * Single leaf-budget API. Hard cap — over budget must replan/cut leaves.
 * Do not raise the cap or soft-pass.
 */

export function parseChunkBudgetMinutes(chunk: string): number {
  const hour = chunk.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hour) return Math.round(Number(hour[1]) * 60);
  const minutes = chunk.match(/(\d+)\s*分钟/);
  if (minutes) return Number(minutes[1]);
  const bare = chunk.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Math.round(Number(bare[1]) * 60);
  if (/每天|每日/.test(chunk)) return 5 * 40;
  if (/周末/.test(chunk)) return 120;
  return 90;
}

export function leafBudget(weeklyMinutes: number, weeks = 4): number {
  const sittings = Math.max(4, Math.round((weeklyMinutes * weeks) / 35));
  return Math.min(12, Math.max(6, sittings));
}
