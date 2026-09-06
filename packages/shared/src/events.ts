import type { NoteReasonCode, NoteType, TutorStrategy } from "./tutor.js";

export const SESSION_EVENT_TYPES = [
  "session_start",
  "session_end",
  "text_delta",
  "message",
  "tool_start",
  "tool_end",
  "phase_changed",
  "boundary_finalized",
  "outline_finalized",
  "section_status",
  "section_ready",
  "topic_updated",
  "section_updated",
  "note_appended",
  "outline_updated",
  "export_ready",
  "error",
] as const;

export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export type SessionEvent =
  | { type: "session_start"; topicId: string }
  | { type: "session_end"; topicId: string }
  | { type: "text_delta"; text: string }
  | {
      type: "message";
      role: "user" | "assistant";
      text: string;
      strategy?: TutorStrategy;
      citations?: Array<{ section_id: string; note_id?: string }>;
    }
  | {
      type: "tool_start";
      toolName: string;
      toolCallId: string;
    }
  | {
      type: "tool_end";
      toolName: string;
      toolCallId: string;
      ok: boolean;
      summary: string;
    }
  | {
      type: "phase_changed";
      topicId: string;
      phase: string;
      exportState: string;
    }
  | { type: "boundary_finalized"; topic_id: string; phase: string }
  | { type: "outline_finalized"; topic_id: string; phase: string }
  | {
      type: "section_status";
      topic_id: string;
      section_id: string;
      status: string;
      outline_node_id?: string;
    }
  | { type: "section_ready"; topic_id: string; section_id: string }
  | { type: "topic_updated"; topicId: string }
  | { type: "section_updated"; topicId: string; sectionId: string }
  | {
      type: "note_appended";
      note_id: string;
      /** Note.type. Wire name is note_type because `type` is the SSE discriminant. */
      note_type: NoteType;
      reason_code?: NoteReasonCode;
      section_id?: string;
      topic_id?: string;
    }
  | { type: "outline_updated"; topicId: string }
  | {
      type: "export_ready";
      topicId: string;
      format: string;
      filename: string;
      downloadPath: string;
    }
  | { type: "error"; message: string };
