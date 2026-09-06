import type { BoundaryKind, BoundaryRecord, FinalizeRequiredField } from "@quantum/shared";
import { evaluateFinalize } from "./boundary-snapshot.js";

/**
 * Draft interview policy. Sources: Knowles (need-to-know / prior experience),
 * Wiggins backward design, cognitive-load time caps. Not validated in-product.
 *
 * TODO (product research): shortest question set that still yields a usable outline.
 */

export const BOUNDARY_SCRIPT: Array<{
  kind: BoundaryKind;
  question: string;
  why: string;
}> = [
  {
    kind: "goal",
    question: "这次学完，你希望自己能独立做成哪一件具体的事？请用「我能……」来写，而不是一个学科名。",
    why: "Performance goal, not a catalog title.",
  },
  {
    kind: "prior",
    question: "这件事上你已经会什么？卡在哪一步？如果几乎从零开始，也直接说。",
    why: "Places the first gap before we invent chapters.",
  },
  {
    kind: "time",
    question: "接下来四周，你每周大概能拿出多少专注时间？更想浅扫一遍，还是只啃最关键的几块？",
    why: "Width cap. Time + depth often arrive together; we still ask depth next if vague.",
  },
  {
    kind: "depth",
    question: "过关标准更接近哪一种：能向别人讲清、能独立做一遍、还是只要认路？",
    why: "Stops the outline from pretending every leaf is mastery.",
  },
  {
    kind: "constraint",
    question: "有没有必须用的语言/工具，或必须避开的材料（时间、设备、先修）？没有就写「没有」。",
    why: "Keeps generation practical.",
  },
];

/** Interview kinds that fill the five operational required snapshot fields. */
export const REQUIRED_TO_FINALIZE: BoundaryKind[] = [
  "goal",
  "prior",
  "time",
  "depth",
  "constraint",
];

export function nextBoundaryKind(existing: BoundaryRecord[]): BoundaryKind | null {
  const have = new Set(existing.filter((b) => b.answer.trim() || b.status === "asked").map((b) => b.kind));
  for (const step of BOUNDARY_SCRIPT) {
    if (!have.has(step.kind)) return step.kind;
  }
  return null;
}

export function questionFor(kind: BoundaryKind): string {
  return BOUNDARY_SCRIPT.find((s) => s.kind === kind)?.question ?? "还有什么边界需要说清？";
}

export function canFinalize(existing: BoundaryRecord[]): {
  ok: boolean;
  missing: FinalizeRequiredField[];
} {
  return evaluateFinalize(existing);
}

export function digestBoundaries(existing: BoundaryRecord[]): string {
  if (existing.length === 0) return "（尚未记录边界）";
  return existing
    .map((b) => `- ${b.kind}「${b.question}」→ ${b.answer.trim() || "（待答）"}`)
    .join("\n");
}
