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
] as const;

export type TutorStrategy = (typeof TUTOR_STRATEGIES)[number];

export const NOTE_REASON_CODES = [
  "friction",
  "contrast",
  "checkpoint",
  "transfer",
  "correction",
  "export_worthy",
  "unspecified",
] as const;

export type NoteReasonCode = (typeof NOTE_REASON_CODES)[number];

/** Packed interview. Required-to-finalize: goal + prior. */
export type BoundarySnapshot = {
  goal: string;
  prior: string;
  time: string;
  success: string;
  depth: string;
  constraint: string;
  /** TODO (product research): own ask_boundary kind vs folded into prior */
  first_gap: string;
  /** TODO (product research): ask in v0 interview or after first section */
  scaffold_pref: string;
};

export const BOUNDARY_SNAPSHOT_FIELDS = [
  "goal",
  "prior",
  "time",
  "success",
  "depth",
  "constraint",
  "first_gap",
  "scaffold_pref",
] as const satisfies ReadonlyArray<keyof BoundarySnapshot>;

export const BOUNDARY_SNAPSHOT_REQUIRED = ["goal", "prior"] as const;

export type TutorContext = {
  L0: {
    topicId: string;
    title: string;
    phase: TopicPhase;
    exportState: ExportSubstate;
    coachMode: "stub" | "live";
  };
  L1: { snapshot: BoundarySnapshot };
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
  L4: {
    recentNotes: Array<{ body: string; reasonCode: NoteReasonCode; createdAt: number }>;
    strategyHint: TutorStrategy;
  };
};
