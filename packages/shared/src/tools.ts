import type { NoteReasonCode } from "./tutor.js";

export const TOOL_NAMES = [
  "ask_boundary",
  "finalize_boundary",
  "draft_outline",
  "finalize_outline",
  "generate_section",
  "get_section",
  "list_outline",
  "append_note",
  "summarize_notes_for_export",
  "export_topic",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const BOUNDARY_KINDS = [
  "goal",
  "prior",
  "time",
  "depth",
  "constraint",
  "success",
  "goal_outcome",
  "prior_level",
  "scope_out",
  "chunk_budget",
  "motivation",
  "success_evidence",
  "prior_known",
  "prior_gaps",
  "scope_in",
  "time_budget",
  "modality",
] as const;

export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

export const EXPORT_FORMATS = ["md", "html", "epub"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type AskBoundaryArgs = {
  kind: BoundaryKind;
  question: string;
  record_previous?: {
    kind: BoundaryKind;
    answer: string;
  };
};

export type FinalizeBoundaryArgs = {
  answers: Array<{
    kind: BoundaryKind;
    question: string;
    answer: string;
  }>;
};

export type OutlineDraftNode = {
  title: string;
  intent: string;
  objective?: string;
  depends_on?: string[];
  target_chars?: number;
  children?: OutlineDraftNode[];
};

export type DraftOutlineArgs = {
  title: string;
  nodes: OutlineDraftNode[];
};

export type FinalizeOutlineArgs = {
  title?: string;
};

export type GenerateSectionArgs = {
  outline_node_id: string;
  title: string;
  body_md: string;
};

export type GetSectionArgs = {
  outline_node_id: string;
};

export type ListOutlineArgs = Record<string, never>;

export type AppendNoteArgs = {
  body: string;
  section_id?: string;
  reason_code: NoteReasonCode;
};

export type SummarizeNotesArgs = {
  max_chars?: number;
};

export type ExportTopicArgs = {
  format: ExportFormat;
};
