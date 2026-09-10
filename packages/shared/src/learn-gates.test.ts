import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentTopicIdFromState,
  isBoundaryFinalizedPhase,
  isPastBoundaryConfirmGate,
  learnGatesFromServer,
} from "./learn-gates.js";

describe("learn gates from server state", () => {
  it("treats outline_draft as finalized and uses persisted confirm only", () => {
    assert.equal(isBoundaryFinalizedPhase("outline_draft"), true);
    assert.equal(isPastBoundaryConfirmGate("outline_draft"), false);
    assert.deepEqual(
      learnGatesFromServer({
        phase: "outline_draft",
        boundaryConfirmed: false,
        boundaryFinalized: true,
      }),
      { boundaryConfirmed: false, boundaryFinalized: true },
    );
    assert.deepEqual(
      learnGatesFromServer({
        phase: "outline_draft",
        boundaryConfirmed: true,
        boundaryFinalized: true,
      }),
      { boundaryConfirmed: true, boundaryFinalized: true },
    );
  });

  it("learning/done are past the confirm gate even if the column is still 0", () => {
    assert.deepEqual(learnGatesFromServer({ phase: "learning", boundaryConfirmed: false }), {
      boundaryConfirmed: true,
      boundaryFinalized: true,
    });
  });

  it("interview is neither confirmed nor finalized unless columns say so", () => {
    assert.deepEqual(learnGatesFromServer({ phase: "boundary_interview" }), {
      boundaryConfirmed: false,
      boundaryFinalized: false,
    });
  });

  it("never invents currentTopicId from a cache hint", () => {
    assert.equal(currentTopicIdFromState(null), null);
    assert.equal(currentTopicIdFromState("top_1"), "top_1");
    assert.equal(currentTopicIdFromState(undefined), null);
  });
});
