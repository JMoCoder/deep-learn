import { kindsToDimensionIds, type InterviewDimensionId } from "@quantum/shared";
import type { TutorStrategy } from "@quantum/shared";
import type { MessageKey } from "./messages.ts";
import type { TFunction } from "./translate.ts";

const DIM_KEYS: Record<InterviewDimensionId, MessageKey> = {
  motivation: "dim.motivation",
  goal_outcome: "dim.goal_outcome",
  success_evidence: "dim.success_evidence",
  prior_level: "dim.prior_level",
  prereq: "dim.prereq",
  scope: "dim.scope",
  depth: "dim.depth",
  load: "dim.load",
};

const CHIP_KEYS = {
  asking: "chip.asking",
  filled: "chip.filled",
  unasked: "chip.unasked",
  asked: "chip.asked",
} as const;

const PLACEHOLDER_KEYS: Record<InterviewDimensionId, MessageKey> = {
  motivation: "placeholder.motivation",
  goal_outcome: "placeholder.goal_outcome",
  success_evidence: "placeholder.success_evidence",
  prior_level: "placeholder.prior_level",
  prereq: "placeholder.prereq",
  scope: "placeholder.scope",
  depth: "placeholder.depth",
  load: "placeholder.load",
};

const STRATEGY_KEYS: Record<TutorStrategy, MessageKey> = {
  PROBE: "strategy.PROBE",
  SCAFFOLD: "strategy.SCAFFOLD",
  GROUND: "strategy.GROUND",
  ELABORATE: "strategy.ELABORATE",
  CONTRAST: "strategy.CONTRAST",
  CHECK: "strategy.CHECK",
  REDIRECT: "strategy.REDIRECT",
  HOLD: "strategy.HOLD",
  ADVANCE: "strategy.ADVANCE",
  NOTEWORTHY: "strategy.NOTEWORTHY",
  REFUSE_OFFSCOPE: "strategy.REFUSE_OFFSCOPE",
};

const TOOL_KEYS: Record<string, MessageKey> = {
  ask_boundary: "tool.ask_boundary",
  finalize_boundary: "tool.finalize_boundary",
  draft_outline: "tool.draft_outline",
  finalize_outline: "tool.finalize_outline",
  generate_section: "tool.generate_section",
  get_section: "tool.get_section",
  list_outline: "tool.list_outline",
  append_note: "tool.append_note",
  summarize_notes_for_export: "tool.summarize_notes_for_export",
  export_topic: "tool.export_topic",
};

const PHASE_KEYS: Record<string, MessageKey> = {
  idle: "phase.idle",
  boundary_interview: "phase.boundary_interview",
  outline_draft: "phase.outline_draft",
  learning: "phase.learning",
  done: "phase.done",
};

export function dimLabel(id: string, t: TFunction): string {
  const key = DIM_KEYS[id as InterviewDimensionId];
  return key ? t(key) : id;
}

export function chipLabel(chip: string, t: TFunction): string {
  const key = CHIP_KEYS[chip as keyof typeof CHIP_KEYS];
  return key ? t(key) : chip;
}

export function strategyText(strategy: TutorStrategy, t: TFunction): string {
  return t(STRATEGY_KEYS[strategy]);
}

export function toolText(name: string | undefined, t: TFunction): string {
  if (!name) return t("tool.generic");
  return TOOL_KEYS[name] ? t(TOOL_KEYS[name]) : name;
}

export function phaseText(phase: string, t: TFunction): string {
  return PHASE_KEYS[phase] ? t(PHASE_KEYS[phase]) : phase;
}

export function composerPlaceholderText(
  input: {
    phase: string;
    currentKind?: string | null;
    pendingBoundary: boolean;
    pendingOutline: boolean;
    overBudget?: boolean;
    awaitingTopicAnchor?: boolean;
  },
  t: TFunction,
): string {
  if (input.awaitingTopicAnchor) return t("placeholder.topicAnchor");
  const askingId = input.currentKind ? kindsToDimensionIds(input.currentKind)[0] : undefined;
  if (askingId || input.phase === "boundary_interview") {
    return askingId ? t(PLACEHOLDER_KEYS[askingId]) : t("placeholder.current");
  }
  if (input.pendingBoundary) return t("placeholder.pendingBoundary");
  if (input.pendingOutline) {
    return input.overBudget ? t("placeholder.overBudget") : t("placeholder.outline");
  }
  if (input.phase === "learning") return t("placeholder.learning");
  return t("placeholder.default");
}

export function fieldLabel(key: string, t: TFunction): string {
  const map: Record<string, MessageKey> = {
    goal_outcome: "field.goal_outcome",
    prior_level: "field.prior_level",
    scope_out: "field.scope_out",
    depth: "field.depth",
    chunk_budget: "field.chunk_budget",
    motivation: "field.motivation",
    success_evidence: "field.success_evidence",
    prior_known: "field.prior_known",
    prior_gaps: "field.prior_gaps",
    scope_in: "field.scope_in",
  };
  return map[key] ? t(map[key]) : key;
}
