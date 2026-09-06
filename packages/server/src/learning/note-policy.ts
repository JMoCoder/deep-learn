import {
  APPEND_NOTE_MAX_CHARS,
  noteTypeFromReason,
  parseNoteReasonCode,
  type NoteReasonCode,
  type NoteType,
} from "@quantum/shared";

export function evaluateAppendNote(
  body: string,
  reasonRaw: unknown,
): {
  ok: boolean;
  error?: string;
  body: string;
  reason_code: NoteReasonCode | 0;
  type: NoteType;
} {
  const trimmed = body.trim();
  const code = parseNoteReasonCode(reasonRaw);
  if (!code) {
    return {
      ok: false,
      error: "reason_code 必须是 1–4",
      body: trimmed,
      reason_code: 0,
      type: "思考",
    };
  }
  const type = noteTypeFromReason(code);
  if (!trimmed) {
    return { ok: false, error: "笔记不能为空", body: "", reason_code: code, type };
  }
  if (trimmed.length > APPEND_NOTE_MAX_CHARS) {
    return {
      ok: false,
      error: `笔记超过 ${APPEND_NOTE_MAX_CHARS} 字`,
      body: trimmed,
      reason_code: code,
      type,
    };
  }
  return { ok: true, body: trimmed, reason_code: code, type };
}
