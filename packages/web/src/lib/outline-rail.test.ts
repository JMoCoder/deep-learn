import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  independentRailOpens,
  matchesOutlineRail,
  outlineOpenForViewport,
  OUTLINE_RAIL_QUERY,
} from "./outline-rail.ts";

describe("outline rail breakpoint", () => {
  it("restores the rail when wide and collapses when narrow", () => {
    assert.equal(outlineOpenForViewport(true), true);
    assert.equal(outlineOpenForViewport(false), false);
  });

  it("reads matchMedia for the rail query", () => {
    const wide = {
      matchMedia: (query: string) => ({
        matches: query === OUTLINE_RAIL_QUERY,
        media: query,
      }),
    } as unknown as Window;
    const narrow = {
      matchMedia: () => ({ matches: false, media: OUTLINE_RAIL_QUERY }),
    } as unknown as Window;
    assert.equal(matchesOutlineRail(wide), true);
    assert.equal(matchesOutlineRail(narrow), false);
    assert.equal(matchesOutlineRail(undefined), false);
  });

  it("keeps outline and session opens independent across persistent layout flips", () => {
    const collapsedOutline = {
      outlineWidePref: false,
      sessionWidePref: true,
      outlineDrawerOpen: false,
      sessionDrawerOpen: false,
    };
    const wide = independentRailOpens({ persistent: true, ...collapsedOutline });
    assert.equal(wide.outlineOpen, false);
    assert.equal(wide.sessionOpen, true);
    const narrow = independentRailOpens({ persistent: false, ...collapsedOutline });
    assert.equal(narrow.outlineOpen, false);
    assert.equal(narrow.sessionOpen, false);
    const wideAgain = independentRailOpens({ persistent: true, ...collapsedOutline });
    assert.equal(wideAgain.outlineOpen, false);
    assert.equal(wideAgain.sessionOpen, true);
    assert.notEqual(wideAgain.outlineOpen, wideAgain.sessionOpen);
  });
});
