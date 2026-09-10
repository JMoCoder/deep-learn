import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutlineNode } from "./index.js";
import {
  BOUNDARY_OPTIONAL_ROWS,
  BOUNDARY_REQUIRED_ROWS,
  FINALIZE_GATE_SENTENCE,
  FINALIZE_REQUIRED_FIELDS,
  INTERVIEW_WALK_FIELDS,
  OUTLINE_ACTION_CARD_ONLY,
  OVER_BUDGET_COPY,
  canConfirmBoundaryCard,
  evaluateOutlineLeafBudget,
  leafBudget,
  leafCapFromChunkBudget,
  looksLikeOutlineConfirm,
  missingFinalizeFields,
  missingInterviewWalk,
  parseChunkBudgetMinutes,
  shouldBlockOverBudgetConfirm,
  shouldDeferOutlineActionToCard,
  shouldShowBoundaryCard,
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
    assert.equal(leafCapFromChunkBudget("每次 20 分钟"), 6);
    assert.equal(leafCapFromChunkBudget("每周 3 小时"), 12);
    assert.equal(leafBudget(parseChunkBudgetMinutes("每周 3 小时")), 12);
    assert.ok(leafBudget(10_000) <= 12);
  });

  it("evaluateOutlineLeafBudget and over-budget confirm copy live in shared", () => {
    const leaf = (id: string): OutlineNode => ({
      id,
      topicId: "t",
      parentId: null,
      title: id,
      intent: "",
      objective: "",
      dependsOn: [],
      targetChars: 0,
      sortOrder: 0,
      status: "draft",
      children: [],
    });
    const over = evaluateOutlineLeafBudget(
      Array.from({ length: 7 }, (_, i) => leaf(`n${i}`)),
      "每次 20 分钟",
    );
    assert.equal(over.leafCap, 6);
    assert.equal(over.overBudget, true);
    assert.equal(over.canConfirm, false);
    assert.equal(OVER_BUDGET_COPY, "超负荷预算，请重拟");
    assert.equal(
      shouldBlockOverBudgetConfirm({
        text: "可以",
        overBudget: true,
        pendingOutline: true,
        isConfirm: looksLikeOutlineConfirm("可以"),
      }),
      true,
    );
    assert.equal(shouldDeferOutlineActionToCard({ text: "可以", pendingOutline: true }), true);
    assert.equal(shouldDeferOutlineActionToCard({ text: "减叶", pendingOutline: true }), true);
    assert.match(OUTLINE_ACTION_CARD_ONLY, /大纲卡/);
    assert.match(OUTLINE_ACTION_CARD_ONLY, /可以/);
    assert.equal(shouldDeferOutlineActionToCard({ text: "可以", pendingOutline: false }), false);
    assert.equal(shouldDeferOutlineActionToCard({ text: "这段在讲什么", pendingOutline: true }), false);
  });

  it("shouldShowBoundaryCard uses finalized, not an 8-dim gate", () => {
    const fiveOnly = snapshotFromAnswers(FIVE);
    assert.equal(
      shouldShowBoundaryCard({
        phase: "boundary_interview",
        snapshot: fiveOnly,
        confirmed: false,
        finalized: true,
      }),
      true,
    );
    assert.equal(
      shouldShowBoundaryCard({
        phase: "outline_draft",
        snapshot: fiveOnly,
        confirmed: true,
        finalized: true,
      }),
      false,
    );
  });
});
