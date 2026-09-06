import {
  FINALIZE_REQUIRED_FIELDS,
  KIND_TO_SNAPSHOT,
  type BoundarySnapshot,
  type FinalizeRequiredField,
} from "./tutor.js";

/** Core1 interview dimensions. May be merged in one ask; none may be silently dropped. */
export const INTERVIEW_DIMENSIONS = [
  {
    id: "motivation",
    label: "动机",
    hint: "为什么现在要学",
    fields: ["motivation"] as const,
    stubCovered: false,
    kinds: ["motivation"],
  },
  {
    id: "goal_outcome",
    label: "终点表现",
    hint: "学完能做成哪一件具体的事",
    fields: ["goal_outcome"] as const,
    stubCovered: true,
    kinds: ["goal", "goal_outcome"],
  },
  {
    id: "success_evidence",
    label: "成功证据",
    hint: "怎样自证学会了",
    fields: ["success_evidence", "success"] as const,
    stubCovered: false,
    kinds: ["success", "success_evidence"],
  },
  {
    id: "prior_level",
    label: "先验",
    hint: "零基础 / 听说过 / 用过皮毛 / 能独立做",
    fields: ["prior_level"] as const,
    stubCovered: true,
    kinds: ["prior", "prior_level"],
  },
  {
    id: "prereq",
    label: "先修轻探",
    hint: "关键概念会 / 半会 / 不会",
    fields: ["prior_known", "prior_gaps", "first_gap"] as const,
    stubCovered: false,
    kinds: ["prior_known", "prior_gaps", "gap", "first_gap"],
  },
  {
    id: "scope",
    label: "范围",
    hint: "必须包含 / 坚决不碰",
    fields: ["scope_in", "scope_out"] as const,
    stubCovered: "partial" as const,
    kinds: ["constraint", "scope_out", "scope_in"],
  },
  {
    id: "depth",
    label: "深度",
    hint: "认路 / 能讲清 / 能动手 / 能教人",
    fields: ["depth"] as const,
    stubCovered: true,
    kinds: ["depth"],
  },
  {
    id: "load",
    label: "负荷",
    hint: "单节字数或单次可学时长",
    fields: ["chunk_budget"] as const,
    stubCovered: true,
    kinds: ["time", "chunk_budget"],
  },
] as const;

export type InterviewDimensionId = (typeof INTERVIEW_DIMENSIONS)[number]["id"];

export type InterviewDimensionStatus = {
  id: InterviewDimensionId;
  label: string;
  hint: string;
  value: string;
  filled: boolean;
  asked: boolean;
  stubCovered: boolean | "partial";
  /** Visible gap: empty, and either required or a dim the UI must not pretend was asked. */
  gap: boolean;
};

const ALIAS_PAIRS: Array<[keyof BoundarySnapshot, keyof BoundarySnapshot]> = [
  ["success", "success_evidence"],
  ["success_evidence", "success"],
  ["first_gap", "prior_gaps"],
  ["prior_gaps", "first_gap"],
  ["scaffold_pref", "modality"],
  ["modality", "scaffold_pref"],
];

export function emptyBoundarySnapshot(): BoundarySnapshot {
  return {
    goal_outcome: "",
    prior_level: "",
    scope_out: "",
    depth: "",
    chunk_budget: "",
    motivation: "",
    success_evidence: "",
    prior_known: "",
    prior_gaps: "",
    scope_in: "",
    time_budget: "",
    modality: "",
    success: "",
    first_gap: "",
    scaffold_pref: "",
  };
}

export function applyKindAnswer(snap: BoundarySnapshot, kind: string, answer: string): void {
  const trimmed = answer.trim();
  if (!trimmed) return;
  const field = KIND_TO_SNAPSHOT[kind];
  if (field) snap[field] = trimmed;
  for (const [from, to] of ALIAS_PAIRS) {
    if (field === from && !snap[to].trim()) snap[to] = trimmed;
  }
}

export function snapshotFromAnswers(
  rows: Array<{ kind: string; answer: string }>,
): BoundarySnapshot {
  const snap = emptyBoundarySnapshot();
  for (const row of rows) applyKindAnswer(snap, row.kind, row.answer);
  return snap;
}

export function missingFinalizeFields(snapshot: BoundarySnapshot): FinalizeRequiredField[] {
  return FINALIZE_REQUIRED_FIELDS.filter((field) => !snapshot[field].trim());
}

export function canConfirmBoundaryCard(snapshot: BoundarySnapshot): boolean {
  return missingFinalizeFields(snapshot).length === 0;
}

export function hasAnySnapshotValue(snapshot: BoundarySnapshot): boolean {
  return Object.values(snapshot).some((value) => value.trim().length > 0);
}

export function interviewDimensionStatus(
  snapshot: BoundarySnapshot,
  askedKinds: string[] = [],
): InterviewDimensionStatus[] {
  const asked = new Set(askedKinds);
  return INTERVIEW_DIMENSIONS.map((dim) => {
    const value = dim.fields
      .map((field) => snapshot[field].trim())
      .find(Boolean) ?? "";
    const filled = value.length > 0;
    const wasAsked = dim.kinds.some((kind) => asked.has(kind));
    if (dim.id === "scope") {
      return {
        id: dim.id,
        label: dim.label,
        hint: dim.hint,
        value: formatScopeValue(snapshot),
        filled: Boolean(snapshot.scope_out.trim()),
        asked: wasAsked,
        stubCovered: dim.stubCovered,
        gap: !snapshot.scope_out.trim() || !snapshot.scope_in.trim(),
      };
    }
    return {
      id: dim.id,
      label: dim.label,
      hint: dim.hint,
      value,
      filled,
      asked: wasAsked,
      stubCovered: dim.stubCovered,
      gap: !filled,
    };
  });
}

function formatScopeValue(snapshot: BoundarySnapshot): string {
  const parts: string[] = [];
  if (snapshot.scope_in.trim()) parts.push(`含：${snapshot.scope_in.trim()}`);
  if (snapshot.scope_out.trim()) parts.push(`排除：${snapshot.scope_out.trim()}`);
  return parts.join(" · ");
}

export function dimensionForKind(kind: string | null | undefined) {
  if (!kind) return null;
  return INTERVIEW_DIMENSIONS.find((dim) => (dim.kinds as readonly string[]).includes(kind)) ?? null;
}

export function shouldShowBoundaryCard(input: {
  phase: string;
  snapshot: BoundarySnapshot | null;
  confirmed: boolean;
}): boolean {
  if (input.confirmed) return false;
  if (input.phase === "learning" || input.phase === "done") return false;
  if (input.phase === "outline_draft") return true;
  return Boolean(input.snapshot && hasAnySnapshotValue(input.snapshot) && input.phase !== "boundary_interview");
}

export function shouldShowOutlineConfirm(input: {
  phase: string;
  boundaryConfirmed: boolean;
  hasOutline?: boolean;
}): boolean {
  return input.phase === "outline_draft" && input.boundaryConfirmed;
}

const OUTLINE_CONFIRM_RE = /(可以|锁定|定稿|开始学|行|好的|确认大纲)/;

export function looksLikeOutlineConfirm(text: string): boolean {
  return OUTLINE_CONFIRM_RE.test(text.trim());
}

/**
 * 2.7 refuse+redirect hook.
 * Prefer `strategy === "REFUSE_OFFSCOPE"` on `message` (no new SSE domain name).
 * Compat: REDIRECT + off-scope wording, or text that names the strategy.
 */
export function isRefuseOffscopeSignal(input: {
  strategy?: string | null;
  text?: string | null;
  toolName?: string | null;
}): boolean {
  const strategy = (input.strategy ?? "").trim();
  if (strategy === "REFUSE_OFFSCOPE") return true;
  const text = input.text ?? "";
  if (/\bREFUSE_OFFSCOPE\b/.test(text)) return true;
  if (strategy === "REDIRECT" && looksOffscopeText(text)) return true;
  if (input.toolName === "append_note") return false;
  return false;
}

function looksOffscopeText(text: string): boolean {
  return /scope_out|超范围|超出.*范围|不在本次范围|踩界|排除区/.test(text);
}

export function refuseRedirectCopy(input: {
  scopeIn?: string;
  scopeOut?: string;
  text?: string;
}): { title: string; refuse: string; redirect: string } {
  const scopeIn = input.scopeIn?.trim();
  const scopeOut = input.scopeOut?.trim();
  const refuse = input.text?.trim()
    ? clip(input.text.trim(), 160)
    : scopeOut
      ? `这个问题落在排除区（${clip(scopeOut, 40)}），这次不展开。`
      : "这个问题超出当前学习边界，这次不展开。";
  const redirect = scopeIn
    ? `回到范围内：${clip(scopeIn, 80)}。直接问当前节目标即可。`
    : "回到当前节的范围内继续。不要把踩界内容记成笔记。";
  return { title: "拒 + 回流", refuse, redirect };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const STUB_INTERVIEW_NOTE =
  "本地 stub 目前只问 5 维：终点表现、先验、负荷、深度、排除。动机、成功证据、先修轻探、scope_in 未问齐时会在边界卡标缺口，不会假装已经问过。";
