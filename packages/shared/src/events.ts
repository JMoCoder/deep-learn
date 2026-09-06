export const SESSION_EVENT_TYPES = [
  "session_start",
  "session_end",
  "text_delta",
  "message",
  "tool_start",
  "tool_end",
  "phase_changed",
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
  | { type: "message"; role: "user" | "assistant"; text: string }
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
  | { type: "topic_updated"; topicId: string }
  | { type: "section_updated"; topicId: string; sectionId: string }
  | { type: "note_appended"; topicId: string; noteId: string }
  | { type: "outline_updated"; topicId: string }
  | {
      type: "export_ready";
      topicId: string;
      format: string;
      filename: string;
      downloadPath: string;
    }
  | { type: "error"; message: string };
