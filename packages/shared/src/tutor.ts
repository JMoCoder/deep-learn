import type { ExportSubstate, TopicPhase } from "./phases.js";

/** Sidebar turn hint. Firing policy is draft — see docs/core2-sidebar-ai-research-v0.md */
export const TUTOR_STRATEGIES = [
  "PROBE",
  "SCAFFOLD",
  "GROUND",
  "ELABORATE",
  "CONTRAST",
  "CHECK",
  "REDIRECT",
  "HOLD",
  "ADVANCE",
  "NOTEWORTHY",
  "REFUSE_OFFSCOPE",
] as const;

export type TutorStrategy = (typeof TUTOR_STRATEGIES)[number];

/**
 * Frozen numeric `append_note.reason_code`. Do not replace with an English enum.
 * 1 稳定结论/心得 → 思考
 * 2 可复查误解或未解 → 疑问
 * 3 超 objective 旁支且用户想留 → 拓展
 * 4 同题往返≥2 轮未解 → 疑问
 */
export const NOTE_REASON_CODES = [1, 2, 3, 4] as const;
export type NoteReasonCode = (typeof NOTE_REASON_CODES)[number];

export const NOTE_TYPES = ["思考", "疑问", "拓展"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_REASON_MEANING = {
  1: "稳定结论/心得",
  2: "可复查误解或未解",
  3: "超 objective 旁支且用户想留",
  4: "同题往返≥2 轮未解",
} as const satisfies Record<NoteReasonCode, string>;

export const NOTE_TYPE_BY_REASON = {
  1: "思考",
  2: "疑问",
  3: "拓展",
  4: "疑问",
} as const satisfies Record<NoteReasonCode, NoteType>;

export function parseNoteReasonCode(raw: unknown): NoteReasonCode | null {
  const n = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

export function noteTypeFromReason(code: NoteReasonCode): NoteType {
  return NOTE_TYPE_BY_REASON[code];
}

export const APPEND_NOTE_MAX_CHARS = 300;

/**
 * Packed interview. Operational required-to-finalize (v0.5 lock):
 * goal_outcome, prior_level, scope_out, depth, chunk_budget.
 * Full core1 dimensions also live here so the boundary card can show gaps.
 * Interview kinds map: goal→goal_outcome, prior→prior_level,
 * constraint→scope_out, time→chunk_budget.
 * Compat aliases: success↔success_evidence, first_gap↔prior_gaps,
 * scaffold_pref↔modality.
 */
export type BoundarySnapshot = {
  goal_outcome: string;
  prior_level: string;
  scope_out: string;
  depth: string;
  chunk_budget: string;
  motivation: string;
  success_evidence: string;
  prior_known: string;
  prior_gaps: string;
  scope_in: string;
  time_budget: string;
  modality: string;
  success: string;
  first_gap: string;
  scaffold_pref: string;
};

export const BOUNDARY_SNAPSHOT_FIELDS = [
  "goal_outcome",
  "prior_level",
  "scope_out",
  "depth",
  "chunk_budget",
  "motivation",
  "success_evidence",
  "prior_known",
  "prior_gaps",
  "scope_in",
  "time_budget",
  "modality",
  "success",
  "first_gap",
  "scaffold_pref",
] as const satisfies ReadonlyArray<keyof BoundarySnapshot>;

export const FINALIZE_REQUIRED_FIELDS = [
  "goal_outcome",
  "prior_level",
  "scope_out",
  "depth",
  "chunk_budget",
] as const;

export type FinalizeRequiredField = (typeof FINALIZE_REQUIRED_FIELDS)[number];

export const KIND_TO_SNAPSHOT: Record<string, keyof BoundarySnapshot> = {
  goal: "goal_outcome",
  goal_outcome: "goal_outcome",
  prior: "prior_level",
  prior_level: "prior_level",
  constraint: "scope_out",
  scope_out: "scope_out",
  depth: "depth",
  time: "chunk_budget",
  chunk_budget: "chunk_budget",
  time_budget: "time_budget",
  success: "success",
  success_evidence: "success_evidence",
  gap: "first_gap",
  first_gap: "first_gap",
  prior_gaps: "prior_gaps",
  prior_known: "prior_known",
  scope_in: "scope_in",
  motivation: "motivation",
  scaffold: "scaffold_pref",
  scaffold_pref: "scaffold_pref",
  modality: "modality",
};

export type TutorContext = {
  L0: {
    topicId: string;
    title: string;
    phase: TopicPhase;
    exportState: ExportSubstate;
    coachMode: "stub" | "live";
    /** Learning-phase hint only. Not a scored pedagogy engine. */
    strategyHint: TutorStrategy;
  };
  L1: {
    snapshot: BoundarySnapshot;
    /** Disk excerpt of the current section. Empty only when the leaf has no body yet. */
    body: string;
    sectionId: string | null;
    title: string | null;
    truncated: boolean;
  };
  L2: {
    currentId: string | null;
    currentTitle: string | null;
    currentObjective: string | null;
    dependsOn: string[];
    prevTitle: string | null;
    nextTitle: string | null;
    tree: Array<{ id: string; title: string; objective: string; status: string }>;
  };
  L3: {
    sectionId: string | null;
    title: string | null;
    body: string;
    truncated: boolean;
  };
  /** Deferred. Default packer omits L4 (no vector retrieval, no note dump). */
  L4?: {
    recentNotes: Array<{
      body: string;
      reasonCode: NoteReasonCode;
      type: NoteType;
      createdAt: number;
    }>;
  };
};
