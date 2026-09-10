import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  BoundarySnapshot,
  OutlineNode,
  SessionCitation,
  SessionEvent,
  SessionMessage,
  TutorStrategy,
} from "@quantum/shared";
import { draftToolLooksOverBudget, isRefuseOffscopeSignal } from "@quantum/shared";
import { localizedRefuseCopy, type Locale, type TFunction } from "@/i18n";
import { connectEvents } from "@/lib/api";
import { outlineTitleMap } from "@/lib/prereq-display";
import type { LiveSessionRow } from "@/lib/session-display";
import { citationsFromWire, decorateAssistantMessage, looksLikeRefuseCopy, uiNoteType } from "@/lib/session-display";

type Tab = "learn" | "books" | "me";

export function useSessionEvents(input: {
  refresh: () => Promise<void>;
  locale: Locale;
  t: TFunction;
  outlineRef: { current: OutlineNode[] };
  applyBoundaryFinalizedEvent: (topicId: string) => void;
  setBoundarySnapshot: Dispatch<SetStateAction<BoundarySnapshot>>;
  setDraftRejected: (rejected: boolean) => void;
  setTab: Dispatch<SetStateAction<Tab>>;
  setSessionOpen: (open: boolean) => void;
}) {
  const {
    refresh,
    locale,
    t,
    outlineRef,
    applyBoundaryFinalizedEvent,
    setBoundarySnapshot,
    setDraftRejected,
    setTab,
    setSessionOpen,
  } = input;
  const [liveRows, setLiveRows] = useState<LiveSessionRow[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<
    Array<{ text: string; strategy?: TutorStrategy; citations?: SessionCitation[] }>
  >([]);
  const refuseTurnRef = useRef(false);

  useEffect(() => {
    return connectEvents((event: SessionEvent) => {
      switch (event.type) {
        case "session_start":
          setBusy(true);
          setStreaming("");
          setError(null);
          setLiveRows([]);
          refuseTurnRef.current = false;
          break;
        case "session_end":
          setBusy(false);
          setStreaming("");
          void refresh();
          break;
        case "text_delta":
          setStreaming((s) => s + event.text);
          break;
        case "error":
          setError(event.message);
          setBusy(false);
          break;
        case "export_ready":
          window.open(event.downloadPath, "_blank");
          void refresh();
          break;
        case "message": {
          if (event.role !== "assistant") break;
          const cites = event.citations ?? [];
          const strategy = event.strategy;
          const refuse =
            isRefuseOffscopeSignal({ strategy, text: event.text }) || looksLikeRefuseCopy(event.text);
          if (refuse) {
            refuseTurnRef.current = true;
            const copy = localizedRefuseCopy(locale, {
              text: event.text,
            });
            setOverlays((prev) => {
              const next = prev.filter((o) => o.text !== event.text);
              next.push({ text: event.text, strategy: "REFUSE_OFFSCOPE", citations: [] });
              return next.slice(-40);
            });
            setLiveRows((rows) => [
              ...rows.filter(
                (r) => r.kind !== "cite" && r.kind !== "note" && r.id !== "tutor-refuse" && r.id !== "tutor-meta",
              ),
              {
                id: "tutor-refuse",
                kind: "refuse",
                title: copy.title,
                summary: event.text,
                status: "done",
                strategy: "REFUSE_OFFSCOPE",
                createdAt: Date.now(),
              },
            ]);
            break;
          }
          if (!strategy && cites.length === 0) break;
          const titles = outlineTitleMap(outlineRef.current);
          const labeled = citationsFromWire(cites, titles);
          setOverlays((prev) => {
            const next = prev.filter((o) => o.text !== event.text);
            next.push({ text: event.text, strategy, citations: cites });
            return next.slice(-40);
          });
          setLiveRows((rows) => {
            const next = rows.filter((r) => r.id !== "tutor-meta" && r.id !== "tutor-cites");
            if (strategy) {
              next.push({
                id: "tutor-meta",
                kind: "tool",
                title: strategy,
                summary: "",
                status: "done",
                strategy,
                createdAt: Date.now(),
              });
            }
            if (labeled.length) {
              next.push({
                id: "tutor-cites",
                kind: "cite",
                title: t("live.cite"),
                summary: labeled.map((c) => c.title).join(" · "),
                status: "done",
                strategy,
                citations: labeled,
                createdAt: Date.now(),
              });
            }
            return next;
          });
          break;
        }
        case "note_appended": {
          if (refuseTurnRef.current) break;
          const mapped = uiNoteType(event.reason_code, event.note_type);
          setLiveRows((rows) => {
            if (rows.some((r) => r.kind === "refuse")) return rows;
            if (rows.some((r) => r.kind === "note" && r.id === `note-${event.note_id}`)) return rows;
            return [
              ...rows,
              {
                id: `note-${event.note_id}`,
                kind: "note",
                toolName: "append_note",
                title: mapped,
                summary: mapped,
                status: "done",
                createdAt: Date.now(),
              },
            ];
          });
          void refresh();
          break;
        }
        case "boundary_finalized": {
          if (event.boundary_snapshot) setBoundarySnapshot(event.boundary_snapshot);
          applyBoundaryFinalizedEvent(event.topic_id);
          setTab("learn");
          setSessionOpen(false);
          void refresh();
          break;
        }
        case "tool_end": {
          if (event.toolName === "draft_outline") {
            setDraftRejected(draftToolLooksOverBudget(event));
            void refresh();
          }
          break;
        }
        case "phase_changed":
        case "outline_finalized":
        case "section_status":
        case "section_ready":
          void refresh();
          break;
        default:
          break;
      }
    });
  }, [
    applyBoundaryFinalizedEvent,
    locale,
    outlineRef,
    refresh,
    setBoundarySnapshot,
    setDraftRejected,
    setSessionOpen,
    setTab,
    t,
  ]);

  function displayMessages(messages: SessionMessage[]) {
    return messages.map((m) => {
      if (m.role !== "assistant") return m;
      const hit = overlays.find((o) => o.text === m.text);
      return decorateAssistantMessage(m, hit);
    });
  }

  return {
    liveRows,
    setLiveRows,
    streaming,
    busy,
    error,
    setError,
    displayMessages,
  };
}
