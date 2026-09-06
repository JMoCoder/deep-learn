import {
  APPEND_NOTE_MAX_CHARS,
  NOTE_REASON_BY_CODE,
  type NoteReasonCode,
  type NoteReasonNumber,
} from "@quantum/shared";

export function normalizeReasonCode(raw: unknown): {
  name: NoteReasonCode;
  code: NoteReasonNumber | 0;
} {
  if (typeof raw === "number" && raw in NOTE_REASON_BY_CODE) {
    const code = raw as NoteReasonNumber;
    return { name: NOTE_REASON_BY_CODE[code], code };
  }
  if (typeof raw === "string" && raw in mapNameToCode) {
    const name = raw as NoteReasonCode;
    return { name, code: mapNameToCode[name] };
  }
  return { name: "unspecified", code: 0 };
}

const mapNameToCode: Record<NoteReasonCode, NoteReasonNumber | 0> = {
  friction: 1,
  contrast: 2,
  checkpoint: 3,
  transfer: 4,
  correction: 0,
  export_worthy: 0,
  unspecified: 0,
};

export function evaluateAppendNote(body: string, reasonRaw: unknown): {
  ok: boolean;
  error?: string;
  body: string;
  reason_code: NoteReasonNumber | 0;
  reason_name: NoteReasonCode;
} {
  const trimmed = body.trim();
  const reason = normalizeReasonCode(reasonRaw);
  if (!trimmed) return { ok: false, error: "笔记不能为空", body: "", ...flatten(reason) };
  if (trimmed.length > APPEND_NOTE_MAX_CHARS) {
    return {
      ok: false,
      error: `笔记超过 ${APPEND_NOTE_MAX_CHARS} 字`,
      body: trimmed,
      ...flatten(reason),
    };
  }
  return { ok: true, body: trimmed, ...flatten(reason) };
}

function flatten(reason: { name: NoteReasonCode; code: NoteReasonNumber | 0 }) {
  return { reason_code: reason.code, reason_name: reason.name };
}
