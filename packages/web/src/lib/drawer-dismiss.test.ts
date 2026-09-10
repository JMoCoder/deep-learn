import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampDrawerDrag,
  DRAWER_DISMISS_DISTANCE_PX,
  drawerCloseTravel,
  drawerDragOverlayOpacity,
  lockDrawerSwipeAxis,
  shouldDismissDrawer,
} from "./drawer-dismiss.ts";

describe("drawer swipe dismiss (reverse of open)", () => {
  it("treats left-drawer close as swipe left and right-drawer close as swipe right", () => {
    assert.equal(drawerCloseTravel("left", -80), 80);
    assert.equal(drawerCloseTravel("left", 80), -80);
    assert.equal(drawerCloseTravel("right", 80), 80);
    assert.equal(drawerCloseTravel("right", -80), -80);
  });

  it("clamps drag so the panel cannot be pulled further open", () => {
    assert.equal(clampDrawerDrag("left", -40), -40);
    assert.equal(clampDrawerDrag("left", 40), 0);
    assert.equal(clampDrawerDrag("right", 40), 40);
    assert.equal(clampDrawerDrag("right", -40), 0);
  });

  it("locks horizontal vs vertical after slop so scroll is not a dismiss", () => {
    assert.equal(lockDrawerSwipeAxis(3, 2), null);
    assert.equal(lockDrawerSwipeAxis(-30, 4), "h");
    assert.equal(lockDrawerSwipeAxis(4, 30), "v");
  });

  it("closes only when enabled and travel is reverse + far enough", () => {
    const wideEnough = 280;
    assert.equal(
      shouldDismissDrawer({
        side: "left",
        dx: -DRAWER_DISMISS_DISTANCE_PX,
        dy: 0,
        width: wideEnough,
      }),
      true,
    );
    assert.equal(
      shouldDismissDrawer({
        side: "right",
        dx: DRAWER_DISMISS_DISTANCE_PX,
        dy: 0,
        width: wideEnough,
      }),
      true,
    );
    assert.equal(
      shouldDismissDrawer({ side: "left", dx: 90, dy: 0, width: wideEnough }),
      false,
    );
    assert.equal(
      shouldDismissDrawer({ side: "right", dx: -90, dy: 0, width: wideEnough }),
      false,
    );
    assert.equal(
      shouldDismissDrawer({ side: "left", dx: -20, dy: 0, width: wideEnough }),
      false,
    );
    assert.equal(
      shouldDismissDrawer({ side: "left", dx: -90, dy: 120, width: wideEnough }),
      false,
    );
    assert.equal(
      shouldDismissDrawer({
        side: "left",
        dx: -90,
        dy: 0,
        width: wideEnough,
        enabled: false,
      }),
      false,
    );
  });

  it("fades the overlay as the panel travels toward closed", () => {
    assert.equal(drawerDragOverlayOpacity("left", 0, 200), 1);
    assert.equal(drawerDragOverlayOpacity("left", -100, 200), 0.5);
    assert.equal(drawerDragOverlayOpacity("right", 200, 200), 0);
    assert.equal(drawerDragOverlayOpacity("left", 80, 200), 1);
  });
});
