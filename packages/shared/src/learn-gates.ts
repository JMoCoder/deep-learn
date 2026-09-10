/**
 * Learn confirm / finalize / current-topic gates.
 *
 * UI truth is only GET /api/state (currentTopicId, boundaryConfirmed,
 * boundaryFinalized) plus server phase / boundary events. Browser storage
 * is a cold-start cache overwritten after fetch — it must not alone decide
 * “card confirmed” or “current topic”. On conflict, state always wins.
 */

export function isBoundaryFinalizedPhase(phase: string | null | undefined): boolean {
  return phase === "outline_draft" || phase === "learning" || phase === "done";
}

export function isPastBoundaryConfirmGate(phase: string | null | undefined): boolean {
  return phase === "learning" || phase === "done";
}

export function learnGatesFromServer(input: {
  phase?: string | null;
  boundaryConfirmed?: boolean | null;
  boundaryFinalized?: boolean | null;
}): { boundaryConfirmed: boolean; boundaryFinalized: boolean } {
  const finalized = Boolean(input.boundaryFinalized) || isBoundaryFinalizedPhase(input.phase);
  const confirmed = isPastBoundaryConfirmGate(input.phase) || Boolean(input.boundaryConfirmed);
  return { boundaryConfirmed: confirmed, boundaryFinalized: finalized };
}

/** After /api/state arrives, the server pointer is the only current topic. */
export function currentTopicIdFromState(stateId: string | null | undefined): string | null {
  return stateId ?? null;
}
