import type { BoundarySnapshot } from "@quantum/shared";
import { visibleInterviewChips } from "@/lib/interview-ui";
import { chipLabel, dimLabel, useT, type TFunction } from "@/i18n";
import { cn } from "@/lib/utils";

export { composerPlaceholder } from "@/lib/interview-ui";

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
  const t = useT();
  const dims = visibleInterviewChips(snapshot, askedKinds, currentKind);
  const banner = guideBanner(dims, coachMode, t);
  const complete = dims.length === 8 && dims.every((dim) => dim.chip === "filled");

  return (
    <section
      data-testid="interview-guide"
      className="rounded-xl border border-paper-line bg-paper-deep/50 px-3 py-2"
    >
      <p className="text-[11px] font-semibold tracking-wide text-paper-muted">{t("interview.dims")}</p>
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
            {dimLabel(dim.id, t)} · {chipLabel(dim.chip, t)}
          </li>
        ))}
      </ul>
      <p
        data-testid="interview-guide-banner"
        data-banner={complete ? "complete" : dims.some((d) => d.chip === "asking") ? "asking" : "pending"}
        className={`mt-2 text-[11px] leading-relaxed ${complete ? "text-pine" : "text-paper-muted"}`}
      >
        {banner}
      </p>
    </section>
  );
}

function guideBanner(
  dims: Array<{ id: string; chip: string }>,
  coachMode: "stub" | "live",
  t: TFunction,
): string {
  const asking = dims.find((dim) => dim.chip === "asking");
  if (asking) return t("interview.asking", { label: dimLabel(asking.id, t) });
  const unfinished = dims.some((dim) => dim.chip !== "filled");
  if (unfinished || dims.length < 8) {
    return coachMode === "stub" ? t("interview.stub") : t("interview.incomplete");
  }
  return t("interview.complete");
}
