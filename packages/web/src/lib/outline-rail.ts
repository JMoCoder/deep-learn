/** Wide enough for persistent Learn rails (outline + session); below this they collapse to drawers. */
export const OUTLINE_RAIL_QUERY = "(min-width: 768px)";

export function matchesOutlineRail(
  media: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window,
): boolean {
  if (!media || typeof media.matchMedia !== "function") return false;
  return media.matchMedia(OUTLINE_RAIL_QUERY).matches;
}

/** Default open for a fresh persistent rail. Not a command to copy onto the other rail. */
export function outlineOpenForViewport(wide: boolean): boolean {
  return wide;
}

/** Persistent layout vs drawer: each rail keeps its own open pref. */
export function railOpenForLayout(
  persistent: boolean,
  widePref: boolean,
  drawerOpen: boolean,
): boolean {
  return persistent ? widePref : drawerOpen;
}

/**
 * matchMedia only switches persistent vs drawer layout.
 * It must not force outlineOpen === sessionOpen.
 */
export function independentRailOpens(input: {
  persistent: boolean;
  outlineWidePref: boolean;
  sessionWidePref: boolean;
  outlineDrawerOpen: boolean;
  sessionDrawerOpen: boolean;
}): { outlineOpen: boolean; sessionOpen: boolean } {
  return {
    outlineOpen: railOpenForLayout(input.persistent, input.outlineWidePref, input.outlineDrawerOpen),
    sessionOpen: railOpenForLayout(input.persistent, input.sessionWidePref, input.sessionDrawerOpen),
  };
}
