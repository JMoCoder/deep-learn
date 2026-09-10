import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { padContributionCells } from "./contribution-graph.ts";

describe("padContributionCells", () => {
  it("pads the first weekday so columns are weeks", () => {
    // 2026-09-09 is a Wednesday (getDay() === 3)
    const cells = padContributionCells([
      { date: "2026-09-09", count: 1 },
      { date: "2026-09-10", count: 0 },
    ]);
    assert.equal(cells.length % 7, 0);
    assert.equal(cells[0], null);
    assert.equal(cells[1], null);
    assert.equal(cells[2], null);
    assert.deepEqual(cells[3], { date: "2026-09-09", count: 1 });
    assert.deepEqual(cells[4], { date: "2026-09-10", count: 0 });
  });

  it("returns an empty list when there are no days", () => {
    assert.deepEqual(padContributionCells([]), []);
  });
});
