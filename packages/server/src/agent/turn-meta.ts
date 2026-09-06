import type { TutorStrategy } from "@quantum/shared";

export type TurnCitation = {
  section_id: string;
  note_id?: string;
};

type TurnMeta = {
  strategy?: TutorStrategy;
  citations: TurnCitation[];
};

const turns = new Map<string, TurnMeta>();

export function beginTurn(topicId: string, strategy?: TutorStrategy): void {
  turns.set(topicId, { strategy, citations: [] });
}

export function setTurnStrategy(topicId: string, strategy: TutorStrategy): void {
  const current = turns.get(topicId) ?? { citations: [] };
  current.strategy = strategy;
  turns.set(topicId, current);
}

export function addTurnCitation(topicId: string, citation: TurnCitation): void {
  const current = turns.get(topicId) ?? { citations: [] };
  const exists = current.citations.some(
    (c) => c.section_id === citation.section_id && c.note_id === citation.note_id,
  );
  if (!exists) current.citations.push(citation);
  turns.set(topicId, current);
}

export function peekTurnMeta(topicId: string): TurnMeta {
  return turns.get(topicId) ?? { citations: [] };
}

export function endTurn(topicId: string): void {
  turns.delete(topicId);
}
