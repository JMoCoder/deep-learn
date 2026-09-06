import type { BoundarySnapshot, InterviewDimensionId } from "@quantum/shared";
import {
  STUB_INTERVIEW_NOTE,
  allInterviewDimensionsAsked,
  interviewDimensionStatus,
  kindsToDimensionIds,
} from "@quantum/shared";
import { cn } from "@/lib/utils";

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
  const dims = interviewDimensionStatus(snapshot, askedKinds, currentKind);
  const allAsked = allInterviewDimensionsAsked(askedKinds);

  return (
    <section className="rounded-xl border border-paper-line bg-paper-deep/50 px-3 py-2">
      <p className="text-[11px] font-semibold tracking-wide text-paper-muted">引导维</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {dims.map((dim) => (
          <li
            key={dim.id}
            data-dim={dim.id}
            data-chip={dim.chip}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              dim.chip === "filled"
                ? "border-pine/25 bg-pine/10 text-pine"
                : dim.chip === "asking"
                  ? "border-cinnabar/35 bg-cinnabar/10 text-cinnabar"
                  : dim.chip === "asked"
                    ? "border-pine/15 text-pine"
                    : "border-paper-line text-paper-muted",
            )}
            title={dim.hint}
          >
            {dim.label} · {dim.chipLabel}
          </li>
        ))}
      </ul>
      {allAsked ? (
        <p className="mt-2 text-[11px] text-pine">8 维都已问到。确认边界卡前再看一眼缺口。</p>
      ) : coachMode === "stub" ? (
        <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">{STUB_INTERVIEW_NOTE}</p>
      ) : (
        <p className="mt-2 text-[11px] text-paper-muted">可合并问，不可缺维。未问到的维不会标成已齐。</p>
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
    const id = input.currentKind ? kindsToDimensionIds(input.currentKind)[0] : undefined;
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
    return id ? map[id] : "直接回答当前这一问";
  }
  if (input.phase === "learning") {
    return "问这一节，或说「下一节」推进；踩排除区会被拒回流";
  }
  return "直接回答，或说卡住了哪里";
}
