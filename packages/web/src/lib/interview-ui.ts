import type { BoundarySnapshot, InterviewDimensionId } from "@quantum/shared";
import { interviewDimensionStatus, kindsToDimensionIds, shouldShowBoundaryCard } from "@quantum/shared";

/** 「8 维都已问到」only when every chip is 已答. Asked-but-empty (在问) is not 齐. */
export function allInterviewChipsFilled(
  snapshot: BoundarySnapshot,
  askedKinds: string[],
  currentKind?: string | null,
): boolean {
  return interviewDimensionStatus(snapshot, askedKinds, currentKind).every(
    (dim) => dim.chip === "filled",
  );
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

/**
 * Whole-utterance card/outline confirm. Must not match load answers like「每周 3 小时就行」.
 */
export function isChatOutlineConfirm(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(可以|锁定|定稿|开始学|好的|好|确认大纲|确认边界)[。.!！]*$/.test(trimmed)) return true;
  return /确认边界|看大纲|确认大纲/.test(trimmed) && trimmed.length <= 16;
}

export function shouldBlockComposerConfirm(input: {
  text: string;
  pendingCard: boolean;
  interviewing: boolean;
}): boolean {
  if (!input.pendingCard || input.interviewing) return false;
  return isChatOutlineConfirm(input.text);
}

export function composerPlaceholder(input: {
  phase: string;
  currentKind?: string | null;
  pendingBoundary: boolean;
  pendingOutline: boolean;
}): string {
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
  if (input.pendingOutline) return "大纲可以的话回复「可以」；要改结构直接说";
  if (input.phase === "learning") {
    return "问这一节，或说「下一节」推进；踩排除区会被拒回流";
  }
  return "直接回答，或说卡住了哪里";
}

export function shouldShowLearnBoundaryCard(input: {
  phase: string;
  snapshot: BoundarySnapshot | null;
  confirmed: boolean;
  finalized?: boolean;
}): boolean {
  if (input.confirmed) return false;
  if (input.phase === "learning" || input.phase === "done") return false;
  if (input.finalized) return true;
  return shouldShowBoundaryCard({
    phase: input.phase,
    snapshot: input.snapshot,
    confirmed: input.confirmed,
  });
}
