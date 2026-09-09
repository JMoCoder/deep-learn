/** Wide enough for a real outline rail; below this the rail collapses to a drawer. */
export const OUTLINE_RAIL_QUERY = "(min-width: 768px)";

export function matchesOutlineRail(
  media: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window,
): boolean {
  if (!media || typeof media.matchMedia !== "function") return false;
  return media.matchMedia(OUTLINE_RAIL_QUERY).matches;
}

/** Collapse on a narrow viewport; restore the persistent rail when wide again. */
export function outlineOpenForViewport(wide: boolean): boolean {
  return wide;
}
