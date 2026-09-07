import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyBoundarySnapshot, snapshotFromAnswers } from "@quantum/shared";
import {
  ALL_ASKED_COPY,
  allInterviewChipsFilled,
  composerPlaceholder,
  composerShouldLock,
  currentUnansweredKind,
  interviewGuideCopy,
  isChatOutlineConfirm,
  shouldBlockComposerConfirm,
  shouldShowLearnBoundaryCard,
  visibleInterviewChips,
} from "./interview-ui.ts";

const EIGHT = [
  { kind: "motivation", answer: "因为工作" },
  { kind: "goal", answer: "我能独立画一遍" },
  { kind: "success_evidence", answer: "能讲 10 分钟" },
  { kind: "prior", answer: "零基础" },
  { kind: "prior_gaps", answer: "会：无；不会：投影" },
  { kind: "scope_in", answer: "测量公设" },
  { kind: "constraint", answer: "排除：弦论" },
  { kind: "depth", answer: "能讲清" },
  { kind: "time", answer: "20 分钟" },
];

describe("1.2 interview UI honesty + send", () => {
  it("一维在问 ⇒ 不出现「8维都已问到」", () => {
    const asked = EIGHT.map((row) => row.kind);
    const withoutLoad = snapshotFromAnswers(EIGHT.filter((row) => row.kind !== "time"));
    const dims = visibleInterviewChips(withoutLoad, asked, "time");
    assert.equal(dims.find((d) => d.id === "load")?.chip, "asking");
    assert.equal(dims.find((d) => d.id === "load")?.chipLabel, "在问");
    const copy = interviewGuideCopy(dims);
    assert.equal(copy.includes("8 维都已问到"), false);
    assert.equal(copy.includes(ALL_ASKED_COPY), false);
    assert.match(copy, /正在问「负荷」/);
    assert.equal(allInterviewChipsFilled(withoutLoad, asked, "time"), false);
    assert.equal(allInterviewChipsFilled(emptyBoundarySnapshot(), asked, "time"), false);
  });

  it("literal 在问 chip never yields the complete banner", () => {
    const copy = interviewGuideCopy([
      { chip: "filled", chipLabel: "已答", label: "动机" },
      { chip: "asking", chipLabel: "在问", label: "负荷" },
    ]);
    assert.equal(copy.includes("8 维都已问到"), false);
    assert.match(copy, /正在问「负荷」/);
  });

  it("shows 8 维都已问到 only when every chip is 已答", () => {
    const asked = EIGHT.map((row) => row.kind);
    const dims = visibleInterviewChips(snapshotFromAnswers(EIGHT), asked, null);
    assert.equal(dims.every((d) => d.chip === "filled"), true);
    assert.equal(interviewGuideCopy(dims), ALL_ASKED_COPY);
    assert.equal(allInterviewChipsFilled(snapshotFromAnswers(EIGHT), asked, null), true);
  });

  it("keeps composer unlocked on the load dim even when busy", () => {
    assert.equal(
      composerShouldLock({ busy: true, phase: "boundary_interview", currentKind: "time" }),
      false,
    );
    assert.equal(composerShouldLock({ busy: true, phase: "learning" }), true);
    assert.equal(composerShouldLock({ busy: false, phase: "learning" }), false);
  });

  it("does not treat load answers as outline confirm", () => {
    assert.equal(isChatOutlineConfirm("每周 3 小时就行"), false);
    assert.equal(isChatOutlineConfirm("每次 20 分钟"), false);
    assert.equal(isChatOutlineConfirm("可以"), true);
    assert.equal(
      shouldBlockComposerConfirm({
        text: "每周 3 小时就行",
        pendingCard: true,
        interviewing: true,
      }),
      false,
    );
    assert.equal(
      shouldBlockComposerConfirm({ text: "可以", pendingCard: true, interviewing: false }),
      true,
    );
  });

  it("placeholder follows unanswered ask_boundary.kind, not a premature card", () => {
    assert.match(
      composerPlaceholder({
        phase: "boundary_interview",
        currentKind: "time",
        pendingBoundary: true,
        pendingOutline: false,
      }),
      /负荷/,
    );
  });

  it("current kind is only the unanswered asked row", () => {
    const rows = [
      { kind: "depth", status: "answered", answer: "能讲清" },
      { kind: "time", status: "asked", answer: "" },
    ];
    assert.equal(currentUnansweredKind(rows), "time");
    assert.equal(
      currentUnansweredKind([{ kind: "time", status: "answered", answer: "20 分钟" }]),
      null,
    );
  });
});

describe("1.3 boundary card visibility", () => {
  it("shows the card after finalize even if phase still lags", () => {
    const snap = snapshotFromAnswers(EIGHT);
    assert.equal(
      shouldShowLearnBoundaryCard({
        phase: "boundary_interview",
        snapshot: snap,
        confirmed: false,
        finalized: true,
      }),
      true,
    );
    assert.equal(
      shouldShowLearnBoundaryCard({
        phase: "outline_draft",
        snapshot: snap,
        confirmed: false,
      }),
      true,
    );
    assert.equal(
      shouldShowLearnBoundaryCard({
        phase: "outline_draft",
        snapshot: snap,
        confirmed: true,
        finalized: true,
      }),
      false,
    );
  });
});
