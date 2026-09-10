import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOUNDARY_OPTIONAL_ROWS,
  BOUNDARY_REQUIRED_ROWS,
  FINALIZE_GATE_SENTENCE,
  FINALIZE_REQUIRED_FIELDS,
  INTERVIEW_WALK_FIELDS,
  canConfirmBoundaryCard,
  leafBudget,
  looksLikeOutlineConfirm,
  missingFinalizeFields,
  missingInterviewWalk,
  parseChunkBudgetMinutes,
  snapshotFromAnswers,
} from "./index.js";

const FIVE = [
  { kind: "goal_outcome", answer: "我能独立画一遍" },
  { kind: "prior_level", answer: "只会定义" },
  { kind: "scope_out", answer: "没有" },
  { kind: "depth", answer: "认路" },
  { kind: "chunk_budget", answer: "每次 20 分钟" },
];

describe("Red-2 shared rule single-source", () => {
  it("finalize gate is the five required fields only", () => {
    assert.deepEqual(FINALIZE_REQUIRED_FIELDS, [
      "goal_outcome",
      "prior_level",
      "scope_out",
      "depth",
      "chunk_budget",
    ]);
    assert.deepEqual(
      BOUNDARY_REQUIRED_ROWS.map((row) => row.key),
      [...FINALIZE_REQUIRED_FIELDS],
    );
    assert.ok(FINALIZE_GATE_SENTENCE.includes(FINALIZE_REQUIRED_FIELDS.join(" / ")));
    assert.equal(FINALIZE_GATE_SENTENCE.includes("8 维"), false);
    assert.match(FINALIZE_GATE_SENTENCE, /缺则 ok:false/);

    const fiveOnly = snapshotFromAnswers(FIVE);
    assert.deepEqual(missingFinalizeFields(fiveOnly), []);
    assert.equal(canConfirmBoundaryCard(fiveOnly), true);
    assert.ok(missingInterviewWalk(fiveOnly).includes("motivation"));
    assert.ok(INTERVIEW_WALK_FIELDS.includes("motivation"));
    assert.ok(BOUNDARY_OPTIONAL_ROWS.some((row) => row.key === "motivation"));
  });

  it("looksLikeOutlineConfirm is whole-phrase and ignores 行/就行", () => {
    assert.equal(looksLikeOutlineConfirm("可以"), true);
    assert.equal(looksLikeOutlineConfirm("好的"), true);
    assert.equal(looksLikeOutlineConfirm("确认大纲"), true);
    assert.equal(looksLikeOutlineConfirm("行"), false);
    assert.equal(looksLikeOutlineConfirm("就行"), false);
    assert.equal(looksLikeOutlineConfirm("每周 3 小时就行"), false);
    assert.equal(looksLikeOutlineConfirm("每次 20 分钟"), false);
    assert.equal(looksLikeOutlineConfirm("卡在符号"), false);
  });

  it("leafBudget / parseChunkBudgetMinutes keep the frozen 20 分钟 → 6 cap", () => {
    assert.equal(parseChunkBudgetMinutes("每次 20 分钟"), 20);
    assert.equal(leafBudget(20), 6);
    assert.equal(leafBudget(parseChunkBudgetMinutes("每周 3 小时")), 12);
    assert.ok(leafBudget(10_000) <= 12);
  });
});
