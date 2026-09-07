import type { TopicPhase } from "@quantum/shared";
import { useT, type TFunction } from "@/i18n";

export function AcceptHint({
  phase,
  pendingBoundary,
  pendingOutline,
  hasTopic,
  overBudget,
  awaitingTopicAnchor,
}: {
  phase: TopicPhase | "";
  pendingBoundary: boolean;
  pendingOutline: boolean;
  hasTopic: boolean;
  overBudget?: boolean;
  awaitingTopicAnchor?: boolean;
}) {
  const t = useT();
  const step = hintFor(
    { phase, pendingBoundary, pendingOutline, hasTopic, overBudget, awaitingTopicAnchor },
    t,
  );
  return (
    <aside
      data-testid="accept-hint"
      className="rounded-lg border border-dashed border-paper-line bg-paper-deep/40 px-3 py-2 text-[11px] leading-relaxed text-paper-muted"
    >
      <p className="font-semibold tracking-wide text-paper-ink/70">
        {t("hint.kicker")} · {step.label}
      </p>
      <p className="mt-1">{step.body}</p>
    </aside>
  );
}

function hintFor(
  input: {
    phase: TopicPhase | "";
    pendingBoundary: boolean;
    pendingOutline: boolean;
    hasTopic: boolean;
    overBudget?: boolean;
    awaitingTopicAnchor?: boolean;
  },
  t: TFunction,
): { label: string; body: string } {
  if (!input.hasTopic) {
    return { label: t("hint.new.label"), body: t("hint.new.body") };
  }
  if (input.awaitingTopicAnchor) {
    return { label: t("hint.topic.label"), body: t("hint.topic.body") };
  }
  if (input.phase === "boundary_interview" || input.pendingBoundary) {
    return { label: t("hint.boundary.label"), body: t("hint.boundary.body") };
  }
  if (input.pendingOutline) {
    return {
      label: t("hint.outline.label"),
      body: input.overBudget ? t("hint.outline.overBudget") : t("hint.outline.body"),
    };
  }
  if (input.phase === "learning") {
    return { label: t("hint.learn.label"), body: t("hint.learn.body") };
  }
  return { label: t("hint.guide.label"), body: t("hint.guide.body") };
}
