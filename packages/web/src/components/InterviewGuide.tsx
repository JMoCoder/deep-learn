import type { BoundarySnapshot, InterviewDimensionId } from "@quantum/shared";
import { STUB_INTERVIEW_NOTE, interviewDimensionStatus } from "@quantum/shared";
import { cn } from "@/lib/utils";

const KIND_TO_DIM: Record<string, InterviewDimensionId> = {
  motivation: "motivation",
  goal: "goal_outcome",
  goal_outcome: "goal_outcome",
  success: "success_evidence",
  success_evidence: "success_evidence",
  prior: "prior_level",
  prior_level: "prior_level",
  prior_known: "prereq",
  prior_gaps: "prereq",
  gap: "prereq",
  first_gap: "prereq",
  constraint: "scope",
  scope_out: "scope",
  scope_in: "scope",
  depth: "depth",
  time: "load",
  chunk_budget: "load",
};

export function InterviewGuide({
  snapshot,
  askedKinds,
  coachMode,
  currentKind,
}: {
  snapshot: BoundarySnapshot;
  askedKinds: string[];
  coachMode: "stub" | "live";
  currentKind?: string | null;
}) {
  const dims = interviewDimensionStatus(snapshot, askedKinds);
  const currentId = currentKind ? KIND_TO_DIM[currentKind] : undefined;

  return (
    <section className="rounded-xl border border-paper-line bg-paper-deep/50 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-paper-muted">引导维</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {dims.map((dim) => (
          <li
            key={dim.id}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              dim.filled
                ? "border-pine/25 bg-pine/10 text-pine"
                : dim.gap
                  ? "border-cinnabar/25 bg-cinnabar/5 text-cinnabar"
                  : "border-paper-line text-paper-muted",
              currentId === dim.id ? "ring-1 ring-cinnabar/40" : "",
            )}
            title={dim.hint}
          >
            {dim.label}
            {dim.filled ? " · 已答" : dim.asked ? " · 在问" : dim.stubCovered ? " · 待问" : " · 未问"}
          </li>
        ))}
      </ul>
      {coachMode === "stub" ? (
        <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">{STUB_INTERVIEW_NOTE}</p>
      ) : (
        <p className="mt-2 text-[11px] text-paper-muted">可合并问，不可缺维。</p>
      )}
    </section>
  );
}

export function composerPlaceholder(input: {
  phase: string;
  currentKind?: string | null;
  pendingBoundary: boolean;
  pendingOutline: boolean;
}): string {
  if (input.pendingBoundary) return "先确认学习页边界卡；缺维在这里补一句，不要直接说「可以」";
  if (input.pendingOutline) return "大纲可以的话回复「可以」；要改结构直接说";
  if (input.phase === "boundary_interview") {
    const label = input.currentKind ? KIND_TO_DIM[input.currentKind] : undefined;
    const map: Record<InterviewDimensionId, string> = {
      motivation: "回答动机：为什么现在要学",
      goal_outcome: "回答终点表现：学完能做成哪一件事",
      success_evidence: "回答成功证据：怎样算学会",
      prior_level: "回答先验：哪一档最像你",
      prereq: "回答先修：关键概念会 / 半会 / 不会",
      scope: "回答范围：必须包含 / 坚决不碰",
      depth: "回答深度：认路 / 能讲清 / 能动手",
      load: "回答负荷：单次能啃多少",
    };
    return label ? map[label] : "直接回答当前这一问";
  }
  return "直接回答，或说卡住了哪里";
}
