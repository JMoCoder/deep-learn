import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesOutlineRail, outlineOpenForViewport, OUTLINE_RAIL_QUERY } from "./outline-rail.ts";

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
});
