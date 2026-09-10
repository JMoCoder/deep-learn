import { useCallback, useEffect, useState } from "react";
import type { AppSnapshot } from "@quantum/shared";
import { api } from "@/lib/api";
import {
  adoptServerLearnState,
  coldStartLearnGates,
} from "@/lib/learn-gates";
import {
  overwriteGateCacheFromState,
  readTopicAnchor,
  writeBoundaryConfirmed,
  writeBoundaryFinalized,
  writeCachedTopicId,
  writeTopicAnchor,
} from "@/lib/boundary-session";

/**
 * Boundary confirm / finalize follow /api/state after mount.
 * Cold-start cache is a hint only; adoptServerLearnState overwrites it.
 */
export function useLearnGates(snapshot: AppSnapshot | null) {
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(() => coldStartLearnGates().boundaryConfirmed);
  const [boundaryFinalized, setBoundaryFinalized] = useState(() => coldStartLearnGates().boundaryFinalized);
  const [topicAnchor, setTopicAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    const adopted = adoptServerLearnState(snapshot);
    setBoundaryConfirmed(adopted.boundaryConfirmed);
    setBoundaryFinalized(adopted.boundaryFinalized);
  }, [snapshot]);

  useEffect(() => {
    const id = snapshot?.currentTopicId;
    setTopicAnchor(id ? readTopicAnchor(id) : null);
  }, [snapshot?.currentTopicId]);

  const applyBoundaryFinalizedEvent = useCallback((topicId: string) => {
    setBoundaryFinalized(true);
    setBoundaryConfirmed(false);
    writeCachedTopicId(topicId);
    writeBoundaryFinalized(topicId, true);
    writeBoundaryConfirmed(topicId, false);
  }, []);

  const confirmBoundary = useCallback(async (topicId: string) => {
    setBoundaryConfirmed(true);
    try {
      const result = await api.confirmBoundary(topicId);
      overwriteGateCacheFromState({
        currentTopicId: topicId,
        boundaryConfirmed: result.boundaryConfirmed,
        boundaryFinalized: result.boundaryFinalized,
      });
      setBoundaryConfirmed(result.boundaryConfirmed);
      setBoundaryFinalized(result.boundaryFinalized);
    } catch (err) {
      setBoundaryConfirmed(false);
      throw err;
    }
  }, []);

  const resetGatesForNewTopic = useCallback((topicId: string) => {
    setBoundaryConfirmed(false);
    setBoundaryFinalized(false);
    setTopicAnchor(null);
    overwriteGateCacheFromState({
      currentTopicId: topicId,
      boundaryConfirmed: false,
      boundaryFinalized: false,
    });
  }, []);

  return {
    boundaryConfirmed,
    boundaryFinalized,
    topicAnchor,
    setTopicAnchor,
    writeTopicAnchor,
    applyBoundaryFinalizedEvent,
    confirmBoundary,
    resetGatesForNewTopic,
  };
}
