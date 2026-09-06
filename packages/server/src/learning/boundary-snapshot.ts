import type {
  BoundaryRecord,
  BoundarySnapshot,
  FinalizeRequiredField,
  InterviewWalkField,
} from "@quantum/shared";
import {
  KIND_TO_SNAPSHOT,
  missingFinalizeFields,
  missingInterviewWalk,
  snapshotFromAnswers,
} from "@quantum/shared";

export function snapshotFromRecords(records: BoundaryRecord[]): BoundarySnapshot {
  return snapshotFromAnswers(records);
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
  unasked: InterviewWalkField[];
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
  const missing = missingFinalizeFields(snapshot);
  const unasked = missingInterviewWalk(snapshot);
  return {
    ok: missing.length === 0 && unasked.length === 0,
    missing,
    unasked,
    snapshot,
  };
}
