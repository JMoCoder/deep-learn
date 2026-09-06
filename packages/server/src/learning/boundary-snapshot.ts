import type {
  BoundaryRecord,
  BoundarySnapshot,
  FinalizeRequiredField,
} from "@quantum/shared";
import { FINALIZE_REQUIRED_FIELDS, KIND_TO_SNAPSHOT } from "@quantum/shared";

export function snapshotFromRecords(records: BoundaryRecord[]): BoundarySnapshot {
  const snap: BoundarySnapshot = {
    goal_outcome: "",
    prior_level: "",
    scope_out: "",
    depth: "",
    chunk_budget: "",
    success: "",
    first_gap: "",
    scaffold_pref: "",
  };
  for (const row of records) {
    const field = KIND_TO_SNAPSHOT[row.kind];
    if (!field) continue;
    const answer = row.answer.trim();
    if (answer) snap[field] = answer;
  }
  return snap;
}

export function mergeAnswersIntoRecords(
  existing: BoundaryRecord[],
  answers: Array<{ kind: string; question: string; answer: string }>,
): Array<{ kind: BoundaryRecord["kind"]; question: string; answer: string }> {
  const merged = existing.map((b) => ({
    kind: b.kind,
    question: b.question,
    answer: answers.find((a) => a.kind === b.kind || KIND_TO_SNAPSHOT[a.kind] === KIND_TO_SNAPSHOT[b.kind])
      ?.answer || b.answer,
  }));
  for (const extra of answers) {
    const field = KIND_TO_SNAPSHOT[extra.kind];
    if (!merged.some((m) => KIND_TO_SNAPSHOT[m.kind] === field)) {
      merged.push({
        kind: extra.kind as BoundaryRecord["kind"],
        question: extra.question,
        answer: extra.answer,
      });
    }
  }
  return merged;
}

export function evaluateFinalize(records: Array<{ kind: string; answer: string }>): {
  ok: boolean;
  missing: FinalizeRequiredField[];
  snapshot: BoundarySnapshot;
} {
  const snapshot = snapshotFromRecords(
    records.map((r, i) => ({
      id: String(i),
      topicId: "",
      kind: r.kind as BoundaryRecord["kind"],
      question: "",
      answer: r.answer,
      status: "answered" as const,
      sortOrder: i,
      createdAt: 0,
    })),
  );
  const missing = FINALIZE_REQUIRED_FIELDS.filter((field) => !snapshot[field].trim());
  return { ok: missing.length === 0, missing, snapshot };
}
