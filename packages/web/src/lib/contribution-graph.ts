import type { HeatmapDay } from "@quantum/shared";

/** Pad a day list so columns are weeks (Sun–Sat), GitHub-style. */
export function padContributionCells(days: HeatmapDay[]): Array<HeatmapDay | null> {
  if (days.length === 0) return [];
  const first = new Date(`${days[0].date}T00:00:00`);
  const pad = Number.isNaN(first.getTime()) ? 0 : first.getDay();
  const cells: Array<HeatmapDay | null> = Array.from({ length: pad }, () => null);
  cells.push(...days);
  const rem = cells.length % 7;
  if (rem !== 0) {
    cells.push(...Array.from({ length: 7 - rem }, () => null));
  }
  return cells;
}
