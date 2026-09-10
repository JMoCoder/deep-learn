import type { BoundaryKind, BoundaryRecord } from "@quantum/shared";

/**
 * Default interview order from core1 §3.1. Questions may merge semantics,
 * but every dimension gets its own ask_boundary.kind so the UI can mark 已问.
 */

export const BOUNDARY_SCRIPT: Array<{
  kind: BoundaryKind;
  question: string;
  why: string;
}> = [
  {
    kind: "motivation",
    question: "你为什么现在要学这个？一句话说清场景或差距就行。",
    why: "Needs / motivation. Not a catalog title.",
  },
  {
    kind: "goal",
    question: "学完你希望自己能独立做成哪一件具体的事？请用「我能……」写，而不是学科名。",
    why: "Desired results / goal_outcome.",
  },
  {
    kind: "success_evidence",
    question: "怎样算「够了」？能向别人讲清、能做一道小练习，还是能交出一份东西？",
    why: "UbD evidence.",
  },
  {
    kind: "prior",
    question: "先验哪一档最像你：零基础 / 听说过 / 用过皮毛 / 能独立做？已经会什么、卡在哪？",
    why: "Learner analysis / prior_level.",
  },
  {
    kind: "prior_gaps",
    question:
      "对目标里冒出的关键概念，用「会：…；半会/不会：…」点一下。没有把握也直接说。",
    why: "Light prerequisite probe.",
  },
  {
    kind: "scope_in",
    question: "这次必须包含什么？没有硬性包含就写「没有」。",
    why: "scope_in.",
  },
  {
    kind: "constraint",
    question:
      "坚决不碰什么？没有排除就写「没有」。若要一次写清范围，可用「含：…；排除：…」。",
    why: "scope_out. Optional 含：/排除： fills both fields.",
  },
  {
    kind: "depth",
    question: "要到哪一档深度：认路 / 能讲清 / 能动手 / 能教人？",
    why: "Depth band.",
  },
  {
    kind: "time",
    question: "单次能啃多少？用字数或分钟说，也可以写每周可投入多久。",
    why: "Cognitive load / chunk_budget.",
  },
];

/** Load dim aliases. Last in the stub walk; answering any of these must finalize, not re-ask. */
export const LOAD_KINDS: ReadonlySet<BoundaryKind> = new Set(["time", "chunk_budget", "time_budget"]);

export function isLoadKind(kind: string): boolean {
  return LOAD_KINDS.has(kind as BoundaryKind);
}

export function nextBoundaryKind(existing: BoundaryRecord[]): BoundaryKind | null {
  const have = new Set(existing.filter((b) => b.answer.trim() || b.status === "asked").map((b) => b.kind));
  if ([...have].some((kind) => isLoadKind(kind))) {
    have.add("time");
    have.add("chunk_budget");
    have.add("time_budget");
  }
  for (const step of BOUNDARY_SCRIPT) {
    if (!have.has(step.kind)) return step.kind;
  }
  return null;
}

export function questionFor(kind: BoundaryKind): string {
  return BOUNDARY_SCRIPT.find((s) => s.kind === kind)?.question ?? "还有什么边界需要说清？";
}

export function digestBoundaries(existing: BoundaryRecord[]): string {
  if (existing.length === 0) return "（尚未记录边界）";
  return existing
    .map((b) => `- ${b.kind}「${b.question}」→ ${b.answer.trim() || "（待答）"}`)
    .join("\n");
}
