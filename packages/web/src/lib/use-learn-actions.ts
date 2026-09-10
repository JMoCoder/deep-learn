import { useRef, type Dispatch, type SetStateAction } from "react";
import type { AppSnapshot, BoundaryRecord, BoundarySnapshot, OutlineNode } from "@quantum/shared";
import {
  evaluateOutlineLeafBudget,
  looksLikeOutlineConfirm,
  shouldBlockOverBudgetConfirm,
  shouldShowBoundaryCard,
  shouldShowOutlineConfirm,
} from "@quantum/shared";
import type { TFunction } from "@/i18n";
import { api } from "@/lib/api";
import {
  currentUnansweredKind,
  needsTopicAnchor,
  shouldBlockComposerConfirm,
  topicTitleFromUtterance,
} from "@/lib/interview-ui";
import type { LiveSessionRow } from "@/lib/session-display";

type Tab = "learn" | "books" | "me";

export function useLearnActions(input: {
  t: TFunction;
  snapshot: AppSnapshot | null;
  outline: OutlineNode[];
  boundaries: BoundaryRecord[];
  boundarySnapshot: BoundarySnapshot;
  boundaryConfirmed: boolean;
  boundaryFinalized: boolean;
  topicAnchor: string | null;
  setTopicAnchor: (title: string | null) => void;
  writeTopicAnchor: (topicId: string, title: string) => void;
  draftRejected: boolean;
  setDraftRejected: (rejected: boolean) => void;
  refresh: () => Promise<void>;
  confirmBoundary: (topicId: string) => Promise<void>;
  resetGatesForNewTopic: (topicId: string) => void;
  setLiveRows: Dispatch<SetStateAction<LiveSessionRow[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setTab: Dispatch<SetStateAction<Tab>>;
  setSessionOpen: (open: boolean) => void;
  setBooksDrawer: Dispatch<SetStateAction<boolean>>;
}) {
  const creatingTopic = useRef(false);

  const pendingBoundary = shouldShowBoundaryCard({
    phase: input.snapshot?.topic?.phase ?? "",
    snapshot: input.boundarySnapshot,
    confirmed: input.boundaryConfirmed,
    finalized: input.boundaryFinalized,
  });
  const pendingOutline = shouldShowOutlineConfirm({
    phase: input.snapshot?.topic?.phase ?? "",
    boundaryConfirmed: input.boundaryConfirmed,
    hasOutline: input.outline.length > 0,
  });

  async function send(text: string) {
    input.setError(null);
    const topicId = input.snapshot?.currentTopicId;
    const awaitingAnchor = needsTopicAnchor({
      phase: input.snapshot?.topic?.phase ?? "",
      title: input.snapshot?.topic?.title,
      anchored: Boolean(input.topicAnchor),
    });
    if (topicId && awaitingAnchor) {
      const title = topicTitleFromUtterance(text);
      if (!title) return;
      input.writeTopicAnchor(topicId, title);
      input.setTopicAnchor(title);
      try {
        await api.renameTopic(topicId, title);
      } catch {
        /* stub prompt still locks the title if PATCH is missing */
      }
    }
    const unanswered = currentUnansweredKind(input.boundaries);
    const interviewing =
      input.snapshot?.topic?.phase === "boundary_interview" || Boolean(unanswered);
    if (topicId && shouldBlockComposerConfirm({ text, pendingCard: pendingBoundary, interviewing })) {
      input.setError(input.t("app.error.confirmBoundaryFirst"));
      input.setTab("learn");
      input.setSessionOpen(false);
      return;
    }
    const outlineBudget = evaluateOutlineLeafBudget(input.outline, input.boundarySnapshot.chunk_budget);
    const overBudget = outlineBudget.overBudget || (outlineBudget.leafCount === 0 && input.draftRejected);
    if (
      topicId &&
      shouldBlockOverBudgetConfirm({
        text,
        overBudget,
        pendingOutline,
        isConfirm: looksLikeOutlineConfirm(text),
      })
    ) {
      input.setError(input.t("app.error.overBudget"));
      input.setTab("learn");
      return;
    }
    try {
      await api.prompt(text);
    } catch (err) {
      input.setError(err instanceof Error ? err.message : input.t("app.error.send"));
    }
  }

  async function confirmBoundaryCard() {
    const topicId = input.snapshot?.currentTopicId;
    if (!topicId) return;
    try {
      await input.confirmBoundary(topicId);
      input.setSessionOpen(true);
      await input.refresh();
    } catch {
      await input.refresh();
    }
  }

  async function createTopic() {
    if (creatingTopic.current) return;
    creatingTopic.current = true;
    input.setLiveRows([]);
    input.setLoadError(null);
    try {
      const created = await api.createTopic();
      input.resetGatesForNewTopic(created.id);
      input.setDraftRejected(false);
      input.setBooksDrawer(false);
      input.setTab("learn");
      input.setSessionOpen(true);
      await input.refresh();
    } catch (err) {
      input.setLoadError(err instanceof Error ? err.message : input.t("app.error.createTopic"));
      input.setTab("books");
      input.setBooksDrawer(true);
    } finally {
      creatingTopic.current = false;
    }
  }

  async function switchTopic(id: string) {
    input.setLiveRows([]);
    await api.switchTopic(id);
    input.setTab("learn");
    await input.refresh();
  }

  async function selectSection(id: string) {
    const topicId = input.snapshot?.currentTopicId;
    if (!topicId) return;
    await api.selectSection(topicId, id);
    await input.refresh();
  }

  async function requestExport(id: string, format: "md" | "html" | "epub") {
    await api.requestExport(id, format);
    input.setTab("learn");
    input.setSessionOpen(true);
  }

  return {
    pendingBoundary,
    pendingOutline,
    send,
    confirmBoundaryCard,
    createTopic,
    switchTopic,
    selectSection,
    requestExport,
  };
}
