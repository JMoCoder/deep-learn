import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FINALIZE_GATE_SENTENCE, FINALIZE_REQUIRED_FIELDS, OUTLINE_ACTION_CARD_ONLY } from "@quantum/shared";
import { baseSystemPrompt, phasePrompt } from "./prompts.js";

describe("live prompt finalize gate (product freeze)", () => {
  it("card/server/live share the five-field sentence and do not require 8 dims done", () => {
    assert.equal(
      FINALIZE_GATE_SENTENCE,
      `finalize_boundary 必填 ${FINALIZE_REQUIRED_FIELDS.join(" / ")}；缺则 ok:false。`,
    );
    const base = baseSystemPrompt();
    const interview = phasePrompt("boundary_interview");
    assert.ok(base.includes(FINALIZE_GATE_SENTENCE));
    assert.ok(interview.includes(FINALIZE_GATE_SENTENCE));
    assert.equal(base.includes("8 维走完再 finalize"), false);
    assert.equal(interview.includes("8 维走完再 finalize"), false);
    for (const field of FINALIZE_REQUIRED_FIELDS) {
      assert.ok(base.includes(field));
      assert.ok(interview.includes(field));
    }
  });

  it("live and stub share card-only confirm/reduce and refuse+reflow", () => {
    const base = baseSystemPrompt();
    const outline = phasePrompt("outline_draft");
    const learning = phasePrompt("learning");
    assert.ok(base.includes(OUTLINE_ACTION_CARD_ONLY));
    assert.ok(outline.includes(OUTLINE_ACTION_CARD_ONLY));
    assert.equal(outline.includes("得到学习者确认后再 finalize_outline"), false);
    assert.ok(learning.includes("REFUSE_OFFSCOPE"));
    assert.ok(learning.includes("禁止 append_note"));
  });

  it("learner-visible prompt identity is Deep Learn, not Quantum", () => {
    const base = baseSystemPrompt();
    assert.match(base, /Deep Learn/);
    assert.equal(base.includes("你是 Quantum"), false);
  });
});
