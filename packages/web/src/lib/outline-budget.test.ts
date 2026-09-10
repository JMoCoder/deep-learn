import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutlineNode } from "@quantum/shared";
import { looksLikeOutlineConfirm } from "@quantum/shared";
import {
  OVER_BUDGET_COPY,
  draftToolLooksOverBudget,
  evaluateOutlineLeafBudget,
  leafBudget,
  outlineComposerPlaceholder,
  parseChunkBudgetMinutes,
  shouldBlockOverBudgetConfirm,
} from "./outline-budget.ts";

function leaf(id: string, title: string): OutlineNode {
  return {
    id,
    topicId: "t",
    parentId: null,
    title,
    intent: "",
    objective: "",
    dependsOn: [],
    targetChars: 0,
    sortOrder: 0,
    status: "draft",
    children: [],
  };
}

describe("1.4 / 五步2 outline confirm gate", () => {
  it("keeps the frozen 20 分钟 → cap 6 and blocks confirm when 7 leaves", () => {
    assert.equal(parseChunkBudgetMinutes("每次 20 分钟"), 20);
    assert.equal(leafBudget(20), 6);
    const seven = Array.from({ length: 7 }, (_, i) => leaf(`n${i}`, `叶${i}`));
    const over = evaluateOutlineLeafBudget(seven, "每次 20 分钟");
    assert.equal(over.leafCount, 7);
    assert.equal(over.leafCap, 6);
    assert.equal(over.overBudget, true);
    assert.equal(over.canConfirm, false);
    assert.equal(OVER_BUDGET_COPY, "超负荷预算，请重拟");
  });

  it("unlocks confirm after a redraft that fits the cap", () => {
    const six = Array.from({ length: 6 }, (_, i) => leaf(`n${i}`, `叶${i}`));
    const ok = evaluateOutlineLeafBudget(six, "每次 20 分钟");
    assert.equal(ok.overBudget, false);
    assert.equal(ok.canConfirm, true);
  });

  it("does not treat 可以 as an over-budget pass, but lets 减叶 through", () => {
    assert.equal(
      shouldBlockOverBudgetConfirm({
        text: "可以",
        overBudget: true,
        pendingOutline: true,
        isConfirm: looksLikeOutlineConfirm("可以"),
      }),
      true,
    );
    assert.equal(
      shouldBlockOverBudgetConfirm({
        text: "减叶",
        overBudget: true,
        pendingOutline: true,
        isConfirm: looksLikeOutlineConfirm("减叶"),
      }),
      false,
    );
    assert.match(outlineComposerPlaceholder(true), /减叶|重拟/);
    assert.equal(outlineComposerPlaceholder(true).includes("可以」我就"), false);
  });

  it("clears a stale draft failure once the tool reports ok", () => {
    assert.equal(
      draftToolLooksOverBudget({
        toolName: "draft_outline",
        ok: false,
        summary: "大纲未通过约束：叶子 7 超过 chunk_budget 上限 6",
      }),
      true,
    );
    assert.equal(
      draftToolLooksOverBudget({
        toolName: "draft_outline",
        ok: true,
        summary: "已起草大纲",
      }),
      false,
    );
  });
});
