import type { BoundarySnapshot, InterviewDimensionId, InterviewDimensionStatus } from "@quantum/shared";
import {
  STUB_INTERVIEW_NOTE,
  interviewDimensionStatus,
  isDefaultTopicTitle,
  kindsToDimensionIds,
  looksLikeOutlineConfirm,
  outlineComposerPlaceholder,
} from "@quantum/shared";

export {
  DEFAULT_TOPIC_TITLE,
  isDefaultTopicTitle,
  topicTitleFromUtterance,
} from "@quantum/shared";

export const ALL_ASKED_COPY = "8 维都已问到。确认边界卡前再看一眼缺口。";

export function visibleInterviewChips(
  snapshot: BoundarySnapshot,
  askedKinds: string[],
  currentKind?: string | null,
): InterviewDimensionStatus[] {
  const currentIds = currentKind ? kindsToDimensionIds(currentKind) : [];
  return interviewDimensionStatus(snapshot, askedKinds, currentKind).map((dim) => {
    const currentUnfilled = currentIds.includes(dim.id) && !dim.filled;
    if (currentUnfilled || (!dim.filled && (dim.chip === "asking" || dim.asked))) {
      return { ...dim, chip: "asking", chipLabel: "在问" };
    }
    if (dim.filled) return { ...dim, chip: "filled", chipLabel: "已答" };
    return { ...dim, chip: "unasked", chipLabel: "未问" };
  });
}

/** Banner is derived from the same chips the UI paints. Asking / 未问 always win. */
export function interviewGuideCopy(
  dims: Array<{ chip: string; chipLabel?: string; label: string }>,
  coachMode: "stub" | "live" = "stub",
): string {
  const asking = dims.find((dim) => dim.chip === "asking" || dim.chipLabel === "在问");
  if (asking) return `正在问「${asking.label}」。答完这一维再看是否齐。`;
  const unfinished = dims.some((dim) => dim.chip !== "filled" && dim.chipLabel !== "已答");
  if (unfinished || dims.length < 8) {
    return coachMode === "stub" ? STUB_INTERVIEW_NOTE : "可合并问，不可缺维。未问到的维不会标成已齐。";
  }
  return ALL_ASKED_COPY;
}

/** 「8 维都已问到」only when every visible chip is 已答. */
export function allInterviewChipsFilled(
  snapshot: BoundarySnapshot,
  askedKinds: string[],
  currentKind?: string | null,
): boolean {
  const dims = visibleInterviewChips(snapshot, askedKinds, currentKind);
  return dims.length === 8 && dims.every((dim) => dim.chip === "filled");
}

export function currentUnansweredKind(
  rows: Array<{ kind: string; status: string; answer: string }>,
): string | null {
  return (
    [...rows].reverse().find((row) => row.status === "asked" && !row.answer.trim())?.kind ?? null
  );
}

/** Interview answers must submit even if a prior turn left `busy` stuck. */
export function composerShouldLock(input: {
  busy: boolean;
  phase: string;
  currentKind?: string | null;
}): boolean {
  if (!input.busy) return false;
  if (input.phase === "boundary_interview") return false;
  if (input.currentKind) return false;
  return true;
}

export function shouldBlockComposerConfirm(input: {
  text: string;
  pendingCard: boolean;
  interviewing: boolean;
}): boolean {
  if (!input.pendingCard || input.interviewing) return false;
  return looksLikeOutlineConfirm(input.text);
}

export function needsTopicAnchor(input: {
  phase: string;
  title?: string | null;
  anchored?: boolean;
}): boolean {
  if (input.phase !== "boundary_interview") return false;
  if (input.anchored) return false;
  return isDefaultTopicTitle(input.title);
}

export function looksLikeKickoffUserLine(text: string): boolean {
  return /学习者刚新建主题|请开始边界访谈/.test(text);
}

export function composerPlaceholder(input: {
  phase: string;
  currentKind?: string | null;
  pendingBoundary: boolean;
  pendingOutline: boolean;
  overBudget?: boolean;
  awaitingTopicAnchor?: boolean;
}): string {
  if (input.awaitingTopicAnchor) return "直接说想学什么，不必先填难度";
  const askingId = input.currentKind ? kindsToDimensionIds(input.currentKind)[0] : undefined;
  if (askingId || input.phase === "boundary_interview") {
    const map: Record<InterviewDimensionId, string> = {
      motivation: "回答动机：为什么现在要学",
      goal_outcome: "回答终点表现：学完能做成哪一件事",
      success_evidence: "回答成功证据：怎样算学会",
      prior_level: "回答先验：哪一档最像你",
      prereq: "回答先修：会：…；不会：…",
      scope: "回答范围：必须包含 / 坚决不碰",
      depth: "回答深度：认路 / 能讲清 / 能动手",
      load: "回答负荷：单次能啃多少",
    };
    return askingId ? map[askingId] : "直接回答当前这一问";
  }
  if (input.pendingBoundary) return "先确认学习页边界卡；缺维在这里补一句，不要直接说「可以」";
  if (input.pendingOutline) return outlineComposerPlaceholder(Boolean(input.overBudget));
  if (input.phase === "learning") {
    return "问这一节，或说「下一节」推进；踩排除区会被拒回流";
  }
  return "直接回答，或说卡住了哪里";
}

