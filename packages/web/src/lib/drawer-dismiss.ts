/** Shared by overlay drawers. Persistent wide rails must not use this. */

export const DRAWER_SWIPE_AXIS_LOCK_PX = 8;
export const DRAWER_DISMISS_DISTANCE_PX = 72;
export const DRAWER_DISMISS_RATIO = 0.28;

export type DrawerSide = "left" | "right";
export type DrawerSwipeAxis = "h" | "v";

/** Positive travel is toward the closed (off-screen) side — reverse of open. */
export function drawerCloseTravel(side: DrawerSide, dx: number): number {
  return side === "left" ? -dx : dx;
}

/** Follow the finger only in the close direction. */
export function clampDrawerDrag(side: DrawerSide, dx: number): number {
  const travel = Math.max(0, drawerCloseTravel(side, dx));
  if (travel === 0) return 0;
  return side === "left" ? -travel : travel;
}

export function lockDrawerSwipeAxis(
  dx: number,
  dy: number,
  slop = DRAWER_SWIPE_AXIS_LOCK_PX,
): DrawerSwipeAxis | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
}

export function shouldDismissDrawer(input: {
  side: DrawerSide;
  dx: number;
  dy: number;
  width: number;
  enabled?: boolean;
}): boolean {
  if (input.enabled === false) return false;
  if (Math.abs(input.dx) < Math.abs(input.dy)) return false;
  const travel = drawerCloseTravel(input.side, input.dx);
  if (travel <= 0) return false;
  const byDistance = travel >= DRAWER_DISMISS_DISTANCE_PX;
  const byRatio = input.width > 0 && travel >= input.width * DRAWER_DISMISS_RATIO;
  return byDistance || byRatio;
}

export function drawerDragOverlayOpacity(side: DrawerSide, dx: number, width: number): number {
  if (width <= 0) return 1;
  const progress = Math.min(1, Math.max(0, drawerCloseTravel(side, dx)) / width);
  return 1 - progress;
}
