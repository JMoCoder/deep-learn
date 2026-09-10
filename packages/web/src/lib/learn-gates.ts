import {
  currentTopicIdFromState,
  learnGatesFromServer,
  type AppSnapshot,
} from "@quantum/shared";
import {
  overwriteGateCacheFromState,
  readBoundaryConfirmed,
  readBoundaryFinalized,
  readCachedTopicId,
} from "@/lib/boundary-session";

/**
 * Adopt GET /api/state as the only UI truth for pointer + confirm/finalize.
 * Cache is overwritten here; a stale confirmed/topic hint never wins.
 */
export function adoptServerLearnState(state: Pick<
  AppSnapshot,
  "currentTopicId" | "boundaryConfirmed" | "boundaryFinalized"
> & { topic?: { phase?: string } | null }): {
  currentTopicId: string | null;
  boundaryConfirmed: boolean;
  boundaryFinalized: boolean;
} {
  const topicId = currentTopicIdFromState(state.currentTopicId);
  const gates = learnGatesFromServer({
    phase: state.topic?.phase,
    boundaryConfirmed: state.boundaryConfirmed,
    boundaryFinalized: state.boundaryFinalized,
  });
  overwriteGateCacheFromState({
    currentTopicId: topicId,
    ...gates,
  });
  return { currentTopicId: topicId, ...gates };
}

/** Cold-start paint only. After /api/state, call adoptServerLearnState instead. */
export function coldStartLearnGates(): {
  currentTopicId: string | null;
  boundaryConfirmed: boolean;
  boundaryFinalized: boolean;
} {
  const currentTopicId = readCachedTopicId();
  return {
    currentTopicId,
    boundaryConfirmed: readBoundaryConfirmed(currentTopicId),
    boundaryFinalized: readBoundaryFinalized(currentTopicId),
  };
}

/** Documented conflict rule: state wins; cache is ignored once state is present. */
export function resolveAgainstCache<T>(stateValue: T, _cacheValue: T): T {
  return stateValue;
}
