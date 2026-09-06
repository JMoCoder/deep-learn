import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canConfirmBoundaryCard,
  interviewDimensionStatus,
  isRefuseOffscopeSignal,
  looksLikeOutlineConfirm,
  missingFinalizeFields,
  missingInterviewWalk,
  shouldShowBoundaryCard,
  shouldShowOutlineConfirm,
  snapshotFromAnswers,
} from "@quantum/shared";
import { BOUNDARY_SCRIPT } from "./boundary-interview.js";

describe("boundary card + interview contract (1.2 / 1.3 / 2.7)", () => {
  it("packs full dimensions and keeps required-five finalize gate", () => {
    const snap = snapshotFromAnswers([
      { kind: "goal", answer: "我能独立画一遍" },
      { kind: "prior", answer: "只会定义" },
      { kind: "time", answer: "每周 2 小时" },
      { kind: "depth", answer: "能讲清" },
      { kind: "constraint", answer: "弦论" },
      { kind: "success", answer: "能给同事讲 10 分钟" },
    ]);
    assert.equal(snap.goal_outcome, "我能独立画一遍");
    assert.equal(snap.success_evidence, "能给同事讲 10 分钟");
    assert.equal(snap.motivation, "");
    assert.deepEqual(missingFinalizeFields(snap), []);
    assert.equal(canConfirmBoundaryCard(snap), true);

    const dims = interviewDimensionStatus(snap, ["goal", "prior", "time", "depth", "constraint"]);
    const motivation = dims.find((d) => d.id === "motivation");
    const evidence = dims.find((d) => d.id === "success_evidence");
    const scope = dims.find((d) => d.id === "scope");
    const prereq = dims.find((d) => d.id === "prereq");
    assert.equal(motivation?.gap, true);
    assert.equal(motivation?.chip, "unasked");
    assert.equal(evidence?.filled, true);
    assert.equal(evidence?.chip, "filled");
    assert.equal(prereq?.gap, true);
    assert.equal(prereq?.chip, "unasked");
    assert.equal(scope?.asked, true);
    assert.equal(scope?.gap, true);
  });

  it("marks a dimension asking then filled once its kind is asked and answered", () => {
    const empty = snapshotFromAnswers([]);
    const asking = interviewDimensionStatus(empty, ["motivation"], "motivation");
    assert.equal(asking.find((d) => d.id === "motivation")?.chip, "asking");
    assert.equal(asking.find((d) => d.id === "goal_outcome")?.chip, "unasked");

    const filled = snapshotFromAnswers([
      { kind: "motivation", answer: "因为工作" },
      { kind: "goal", answer: "我能独立画一遍" },
      { kind: "success_evidence", answer: "能讲 10 分钟" },
      { kind: "prior", answer: "零基础" },
      { kind: "prior_gaps", answer: "会：无；不会：投影" },
      { kind: "scope_in", answer: "测量公设" },
      { kind: "constraint", answer: "排除：弦论" },
      { kind: "depth", answer: "能讲清" },
      { kind: "time", answer: "20 分钟" },
    ]);
    const asked = [
      "motivation",
      "goal",
      "success_evidence",
      "prior",
      "prior_gaps",
      "scope_in",
      "constraint",
      "depth",
      "time",
    ];
    const dims = interviewDimensionStatus(filled, asked);
    assert.equal(dims.every((d) => d.asked || d.filled), true);
    assert.equal(dims.every((d) => d.chip === "filled"), true);
    assert.equal(dims.some((d) => d.gap), false);
    assert.equal(filled.scope_in, "测量公设");
    assert.equal(filled.scope_out, "弦论");
  });

  it("does not enter outline confirm until the boundary card is confirmed", () => {
    const snap = snapshotFromAnswers([
      { kind: "goal_outcome", answer: "我能做" },
      { kind: "prior_level", answer: "零" },
      { kind: "scope_out", answer: "没有" },
      { kind: "depth", answer: "认路" },
      { kind: "chunk_budget", answer: "20 分钟" },
    ]);
    assert.equal(
      shouldShowBoundaryCard({ phase: "outline_draft", snapshot: snap, confirmed: false }),
      true,
    );
    assert.equal(
      shouldShowOutlineConfirm({ phase: "outline_draft", boundaryConfirmed: false, hasOutline: true }),
      false,
    );
    assert.equal(
      shouldShowOutlineConfirm({ phase: "outline_draft", boundaryConfirmed: true }),
      true,
    );
    assert.equal(looksLikeOutlineConfirm("可以"), true);
    assert.equal(looksLikeOutlineConfirm("卡在符号"), false);
  });

  it("lists stub interview kinds in core1 §3.1 order", () => {
    assert.deepEqual(
      BOUNDARY_SCRIPT.map((s) => s.kind),
      [
        "motivation",
        "goal",
        "success_evidence",
        "prior",
        "prior_gaps",
        "scope_in",
        "constraint",
        "depth",
        "time",
      ],
    );
    const fiveOnly = snapshotFromAnswers([
      { kind: "goal_outcome", answer: "我能做" },
      { kind: "prior_level", answer: "零" },
      { kind: "scope_out", answer: "没有" },
      { kind: "depth", answer: "认路" },
      { kind: "chunk_budget", answer: "20 分钟" },
    ]);
    assert.deepEqual(missingFinalizeFields(fiveOnly), []);
    assert.ok(missingInterviewWalk(fiveOnly).includes("motivation"));
  });

  it("detects REFUSE_OFFSCOPE without inventing a new SSE domain name", () => {
    assert.equal(isRefuseOffscopeSignal({ strategy: "REFUSE_OFFSCOPE", text: "弦论不讲" }), true);
    assert.equal(isRefuseOffscopeSignal({ strategy: "REDIRECT", text: "这题踩了 scope_out" }), true);
    assert.equal(isRefuseOffscopeSignal({ text: "策略 REFUSE_OFFSCOPE：拉回当前节" }), true);
    assert.equal(isRefuseOffscopeSignal({ strategy: "GROUND", text: "看这一段正文" }), false);
    assert.equal(isRefuseOffscopeSignal({ toolName: "append_note", text: "记下弦论" }), false);
  });
});
