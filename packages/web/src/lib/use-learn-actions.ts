import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AppSnapshot, BoundaryRecord, BoundarySnapshot, OutlineNode } from "@quantum/shared";
import {
  evaluateOutlineLeafBudget,
  looksLikeOutlineConfirm,
  shouldBlockOverBudgetConfirm,
  shouldDeferOutlineActionToCard,
  shouldShowBoundaryCard,
  shouldShowOutlineConfirm,
} from "@quantum/shared";
import type { AppTab } from "@/app/tabs";
import type { TFunction } from "@/i18n";
import { api } from "@/lib/api";
import { exportDownloadPath, triggerExportDownload } from "@/lib/export-download";
import {
  currentUnansweredKind,
  needsTopicAnchor,
  shouldBlockComposerConfirm,
  topicTitleFromUtterance,
} from "@/lib/interview-ui";
import type { LiveSessionRow } from "@/lib/session-display";

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
  setTab: Dispatch<SetStateAction<AppTab>>;
  setSessionOpen: (open: boolean) => void;
}) {
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);
  const generationEnabled = input.snapshot?.generationEnabled ?? false;

  const pendingBoundary =
    generationEnabled &&
    shouldShowBoundaryCard({
      phase: input.snapshot?.topic?.phase ?? "",
      snapshot: input.boundarySnapshot,
      confirmed: input.boundaryConfirmed,
      finalized: input.boundaryFinalized,
    });
  const pendingOutline =
    generationEnabled &&
    shouldShowOutlineConfirm({
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
      generationEnabled &&
      (input.snapshot?.topic?.phase === "boundary_interview" || Boolean(unanswered));
    if (topicId && shouldBlockComposerConfirm({ text, pendingCard: pendingBoundary, interviewing })) {
      input.setError(input.t("app.error.confirmBoundaryFirst"));
      input.setTab("learn");
      input.setSessionOpen(false);
      return;
    }
    const outlineBudget = evaluateOutlineLeafBudget(input.outline, input.boundarySnapshot.chunk_budget);
    const overBudget = outlineBudget.overBudget || (outlineBudget.leafCount === 0 && input.draftRejected);
    if (topicId && generationEnabled && shouldDeferOutlineActionToCard({ text, pendingOutline })) {
      input.setError(overBudget ? input.t("app.error.overBudget") : input.t("app.error.useOutlineCard"));
      input.setTab("learn");
      return;
    }
    if (
      topicId &&
      generationEnabled &&
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
    if (!generationEnabled) return;
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

  async function confirmOutlineCard() {
    if (!generationEnabled) return;
    const topicId = input.snapshot?.currentTopicId;
    if (!topicId) return;
    const budget = evaluateOutlineLeafBudget(input.outline, input.boundarySnapshot.chunk_budget);
    if (!budget.canConfirm || !pendingOutline) {
      input.setError(input.t("app.error.overBudget"));
      return;
    }
    try {
      await api.confirmOutline(topicId);
      await input.refresh();
    } catch (err) {
      input.setError(err instanceof Error ? err.message : input.t("app.error.send"));
      await input.refresh();
    }
  }

  async function reduceOutlineCard() {
    if (!generationEnabled) return;
    const topicId = input.snapshot?.currentTopicId;
    if (!topicId) return;
    try {
      await api.reduceOutline(topicId);
      input.setDraftRejected(false);
      await input.refresh();
    } catch (err) {
      input.setDraftRejected(true);
      input.setError(err instanceof Error ? err.message : input.t("app.error.overBudget"));
      await input.refresh();
    }
  }

  async function importHtml(html: string, title?: string) {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    input.setLiveRows([]);
    input.setLoadError(null);
    try {
      const result = await api.importHtml(html, title);
      input.resetGatesForNewTopic(result.topic.id);
      input.setDraftRejected(false);
      input.setTab("learn");
      input.setSessionOpen(true);
      await input.refresh();
    } catch (err) {
      input.setLoadError(err instanceof Error ? err.message : input.t("app.error.importHtml"));
      input.setTab("shelf");
      throw err;
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  async function archiveTopic(id: string) {
    input.setLiveRows([]);
    const result = await api.archiveTopic(id);
    await input.refresh();
    if (!result.hasActiveTopics) {
      input.setTab("me");
    }
  }

  async function unarchiveTopic(id: string) {
    await api.unarchiveTopic(id);
    await input.refresh();
    input.setTab("shelf");
  }

  async function deleteTopic(id: string) {
    await api.deleteTopic(id);
    await input.refresh();
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
    try {
      const result = await api.requestExport(id, format);
      const path = exportDownloadPath(result);
      if (!path) {
        input.setError(result.error || input.t("app.error.exportFailed"));
        return;
      }
      triggerExportDownload(path, result.filename);
      input.setTab("learn");
      input.setSessionOpen(true);
    } catch (err) {
      input.setError(err instanceof Error ? err.message : input.t("app.error.exportFailed"));
    }
  }

  return {
    pendingBoundary,
    pendingOutline,
    send,
    confirmBoundaryCard,
    confirmOutlineCard,
    reduceOutlineCard,
    importHtml,
    importing,
    archiveTopic,
    unarchiveTopic,
    deleteTopic,
    switchTopic,
    selectSection,
    requestExport,
  };
}
