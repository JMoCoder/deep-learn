import type { BoundarySnapshot } from "@quantum/shared";
import { STUB_INTERVIEW_NOTE, interviewDimensionStatus } from "@quantum/shared";
import { allInterviewChipsFilled, composerPlaceholder } from "@/lib/interview-ui";
import { cn } from "@/lib/utils";

export { composerPlaceholder };

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
  const allFilled = allInterviewChipsFilled(snapshot, askedKinds, currentKind);

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
      {allFilled ? (
        <p className="mt-2 text-[11px] text-pine">8 维都已问到。确认边界卡前再看一眼缺口。</p>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
          {dims.some((d) => d.chip === "asking")
            ? `正在问「${dims.find((d) => d.chip === "asking")?.label}」。答完这一维再看是否齐。`
            : coachMode === "stub"
              ? STUB_INTERVIEW_NOTE
              : "可合并问，不可缺维。未问到的维不会标成已齐。"}
        </p>
      )}
    </section>
  );
}
