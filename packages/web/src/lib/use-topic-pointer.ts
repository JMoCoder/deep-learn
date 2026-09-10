import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSnapshot,
  BoundaryRecord,
  BoundarySnapshot,
  NoteRecord,
  OutlineNode,
  PrereqEdge,
  SectionRecord,
  SessionMessage,
  TopicSummary,
} from "@quantum/shared";
import {
  currentTopicIdFromState,
  emptyBoundarySnapshot,
  evaluateOutlineLeafBudget,
  learnGatesFromServer,
  snapshotFromAnswers,
} from "@quantum/shared";
import type { TFunction } from "@/i18n";
import { api } from "@/lib/api";
import { overwriteGateCacheFromState } from "@/lib/boundary-session";
import { mergePrereqEdges } from "@/lib/prereq-display";

export type PointerKey = "app.pointer.topicDetail" | "app.pointer.projection";

/**
 * Loads /api/state as the sole current-topic pointer.
 * localStorage is overwritten only when this generation of refresh commits.
 * A newer refresh (confirm, SSE) invalidates in-flight GETs so they cannot
 * un-confirm or invent a topic from a stale response.
 */
export function useTopicPointer(t: TFunction) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [draftRejected, setDraftRejected] = useState(false);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [section, setSection] = useState<SectionRecord | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryRecord[]>([]);
  const [boundarySnapshot, setBoundarySnapshot] = useState<BoundarySnapshot>(emptyBoundarySnapshot());
  const [prereqEdges, setPrereqEdges] = useState<PrereqEdge[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topicPointerNote, setTopicPointerNote] = useState<PointerKey | null>(null);
  const outlineRef = useRef<OutlineNode[]>([]);
  const refreshGen = useRef(0);
  const clearTopicViews = useCallback(() => {
    setOutline([]);
    outlineRef.current = [];
    setPrereqEdges([]);
    setSection(null);
    setNotes([]);
    setBoundaries([]);
    setBoundarySnapshot(emptyBoundarySnapshot());
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current;
    try {
      const [state, listed, messages] = await Promise.all([
        api.state(),
        api.topics(),
        api.messages(),
      ]);
      if (gen !== refreshGen.current) return;

      const topicId = currentTopicIdFromState(state.currentTopicId);
      const gates = learnGatesFromServer({
        phase: state.topic?.phase,
        boundaryConfirmed: state.boundaryConfirmed,
        boundaryFinalized: state.boundaryFinalized,
      });
      const nextSnapshot: AppSnapshot = {
        ...state,
        currentTopicId: topicId,
        ...gates,
      };

      if (!topicId) {
        overwriteGateCacheFromState(nextSnapshot);
        setTopics(listed);
        setMessages(messages);
        setSnapshot(nextSnapshot);
        clearTopicViews();
        setTopicPointerNote(null);
        setLoadError(null);
        return;
      }

      let pointerNote: PointerKey | null = null;
      let detail;
      try {
        detail = await api.topic(topicId);
      } catch (err) {
        if (gen !== refreshGen.current) return;
        overwriteGateCacheFromState(nextSnapshot);
        setTopics(listed);
        setMessages(messages);
        setLoadError(err instanceof Error ? err.message : t("app.error.topicDetail"));
        setSnapshot({
          ...nextSnapshot,
          topic: nextSnapshot.topic ?? listed.find((item) => item.id === topicId) ?? null,
        });
        setTopicPointerNote("app.pointer.topicDetail");
        return;
      }
      if (gen !== refreshGen.current) return;

      let edges = mergePrereqEdges(undefined, detail.outline);
      try {
        const proj = await api.projection();
        if (gen !== refreshGen.current) return;
        edges = mergePrereqEdges(proj.prereq_edges, detail.outline);
      } catch {
        pointerNote = "app.pointer.projection";
      }
      if (gen !== refreshGen.current) return;

      const packed = detail.boundary_snapshot ?? snapshotFromAnswers(detail.boundaries);
      overwriteGateCacheFromState(nextSnapshot);
      setTopics(listed);
      setMessages(messages);
      setSnapshot({
        ...nextSnapshot,
        topic: nextSnapshot.topic ?? detail.topic,
      });
      setOutline(detail.outline);
      outlineRef.current = detail.outline;
      setSection(detail.currentSection);
      setPrereqEdges(edges);
      setNotes(detail.notes);
      setBoundaries(detail.boundaries);
      setBoundarySnapshot(packed);
      if (evaluateOutlineLeafBudget(detail.outline, packed.chunk_budget).canConfirm) {
        setDraftRejected(false);
      }
      setTopicPointerNote(pointerNote);
      setLoadError(null);
    } catch (err) {
      if (gen !== refreshGen.current) return;
      setLoadError(err instanceof Error ? err.message : t("app.error.connect"));
    }
  }, [clearTopicViews, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    topics,
    outline,
    outlineRef,
    section,
    notes,
    boundaries,
    boundarySnapshot,
    setBoundarySnapshot,
    prereqEdges,
    messages,
    loadError,
    setLoadError,
    topicPointerNote,
    draftRejected,
    setDraftRejected,
    refresh,
  };
}
