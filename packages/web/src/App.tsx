import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AppSnapshot,
  BoundaryRecord,
  BoundarySnapshot,
  ExportFormat,
  HeatmapDay,
  NoteRecord,
  OutlineNode,
  PrereqEdge,
  PublicSettings,
  SectionRecord,
  SessionCitation,
  SessionEvent,
  SessionMessage,
  TopicSummary,
  TutorStrategy,
} from "@quantum/shared";
import {
  emptyBoundarySnapshot,
  isRefuseOffscopeSignal,
  refuseRedirectCopy,
  shouldShowOutlineConfirm,
  snapshotFromAnswers,
} from "@quantum/shared";
import { BookOpen, GraduationCap, User } from "lucide-react";
import { BooksTab } from "@/tabs/BooksTab";
import { LearnTab } from "@/tabs/LearnTab";
import { MeTab } from "@/tabs/MeTab";
import { api, connectEvents } from "@/lib/api";
import {
  readBoundaryConfirmed,
  readBoundaryFinalized,
  readCachedTopicId,
  writeBoundaryConfirmed,
  writeBoundaryFinalized,
  writeCachedTopicId,
} from "@/lib/boundary-session";
import {
  currentUnansweredKind,
  isChatOutlineConfirm,
  shouldBlockComposerConfirm,
  shouldShowLearnBoundaryCard,
} from "@/lib/interview-ui";
import {
  draftToolLooksOverBudget,
  evaluateOutlineLeafBudget,
  shouldBlockOverBudgetConfirm,
} from "@/lib/outline-budget";
import { mergePrereqEdges, outlineTitleMap } from "@/lib/prereq-display";
import type { LiveSessionRow } from "@/lib/session-display";
import { citationsFromWire, uiNoteType } from "@/lib/session-display";
import { cn } from "@/lib/utils";

type Tab = "learn" | "books" | "me";

const emptySettings: PublicSettings = {
  provider: "openai",
  modelId: "gpt-4o-mini",
  baseUrl: "",
  hasApiKey: false,
};

export default function App() {
  const [tab, setTab] = useState<Tab>("learn");
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [section, setSection] = useState<SectionRecord | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [boundaries, setBoundaries] = useState<BoundaryRecord[]>([]);
  const [boundarySnapshot, setBoundarySnapshot] = useState<BoundarySnapshot>(emptyBoundarySnapshot());
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const [boundaryFinalized, setBoundaryFinalized] = useState(false);
  const [topicPointerNote, setTopicPointerNote] = useState<string | null>(null);
  const [draftRejected, setDraftRejected] = useState(false);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const refuseTurnRef = useRef(false);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [booksDrawer, setBooksDrawer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveRows, setLiveRows] = useState<LiveSessionRow[]>([]);
  const [prereqEdges, setPrereqEdges] = useState<PrereqEdge[]>([]);
  const [overlays, setOverlays] = useState<
    Array<{ text: string; strategy?: TutorStrategy; citations?: SessionCitation[] }>
  >([]);
  const outlineRef = useRef<OutlineNode[]>([]);
  const creatingTopic = useRef(false);

  const refresh = useCallback(async () => {
    try {
      let state = await api.state();
      const listed = await api.topics();
      setTopics(listed);
      setHeatmap(await api.heatmap());
      setMessages(await api.messages());

      let topicId = state.currentTopicId;
      let topic = state.topic;
      let pointerNote: string | null = null;

      if (!topicId) {
        const cached = readCachedTopicId();
        if (cached && listed.some((item) => item.id === cached)) {
          try {
            await api.switchTopic(cached);
            state = await api.state();
            topicId = state.currentTopicId ?? cached;
            topic = state.topic ?? listed.find((item) => item.id === cached) ?? null;
            if (!state.currentTopicId) {
              pointerNote =
                "接口 /api/state 未带回 currentTopicId。学习页已用本地记录打开主题。指针若持久化丢失，交后端 app_state。";
            }
          } catch {
            topicId = cached;
            topic = listed.find((item) => item.id === cached) ?? null;
            pointerNote =
              "接口未带回当前主题，切换指针也失败。学习页按本地记录显示。current_topic_id 交后端。";
          }
        } else if (cached && listed.length > 0) {
          pointerNote = "本地主题记录对不上已有主题。current_topic_id 丢在后端，交全藏查 app_state。";
        }
      }

      if (topicId) {
        writeCachedTopicId(topicId);
        let detail;
        try {
          detail = await api.topic(topicId);
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : "主题详情拉取失败");
          setSnapshot({
            ...state,
            currentTopicId: topicId,
            topic: topic ?? listed.find((item) => item.id === topicId) ?? null,
          });
          setTopicPointerNote(
            pointerNote ??
              "主题详情拉取失败。若刷新后回到「还没有当前主题」，先看这条；指针本身以 /api/state.currentTopicId 为准。",
          );
          return;
        }
        const resolved = topic ?? detail.topic;
        setSnapshot({
          ...state,
          currentTopicId: topicId,
          topic: resolved,
        });
        setOutline(detail.outline);
        outlineRef.current = detail.outline;
        setSection(detail.currentSection);
        try {
          const proj = await api.projection();
          setPrereqEdges(mergePrereqEdges(proj.prereq_edges, detail.outline));
        } catch {
          setPrereqEdges(mergePrereqEdges(undefined, detail.outline));
          if (!pointerNote) {
            pointerNote = "当前投影 /api/topics/current/projection 拉取失败，先修边改用大纲 depends_on。";
          }
        }
        setNotes(detail.notes);
        setBoundaries(detail.boundaries);
        const packed = detail.boundary_snapshot ?? snapshotFromAnswers(detail.boundaries);
        setBoundarySnapshot(packed);
        if (evaluateOutlineLeafBudget(detail.outline, packed.chunk_budget).canConfirm) {
          setDraftRejected(false);
        }
        const phase = resolved?.phase ?? "";
        const pastGate = phase === "learning";
        setBoundaryConfirmed(pastGate || readBoundaryConfirmed(topicId));
        setBoundaryFinalized(
          phase === "outline_draft" || phase === "learning" || readBoundaryFinalized(topicId),
        );
        setTopicPointerNote(pointerNote);
      } else {
        const cached = readCachedTopicId();
        if (cached && !listed.some((item) => item.id === cached)) writeCachedTopicId(null);
        setSnapshot(state);
        setOutline([]);
        outlineRef.current = [];
        setPrereqEdges([]);
        setSection(null);
        setNotes([]);
        setBoundaries([]);
        setBoundarySnapshot(emptyBoundarySnapshot());
        setBoundaryConfirmed(false);
        setBoundaryFinalized(false);
        setTopicPointerNote(pointerNote);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "无法连接服务器");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          const refuse = isRefuseOffscopeSignal({ strategy, text: event.text });
          if (refuse) {
            refuseTurnRef.current = true;
            const copy = refuseRedirectCopy({
              text: event.text,
            });
            setLiveRows((rows) => [
              ...rows.filter((r) => r.kind !== "cite" && r.kind !== "note" && r.id !== "tutor-refuse"),
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
                title: "引用",
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
          writeCachedTopicId(event.topic_id);
          writeBoundaryFinalized(event.topic_id, true);
          writeBoundaryConfirmed(event.topic_id, false);
          setBoundaryFinalized(true);
          setBoundaryConfirmed(false);
          setTab("learn");
          setSessionOpen(false);
          setOutlineOpen(false);
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
  }, [refresh]);

  async function send(text: string) {
    setError(null);
    const topicId = snapshot?.currentTopicId;
    const unanswered = currentUnansweredKind(boundaries);
    const interviewing =
      snapshot?.topic?.phase === "boundary_interview" || Boolean(unanswered);
    const pendingCard = shouldShowLearnBoundaryCard({
      phase: snapshot?.topic?.phase ?? "",
      snapshot: boundarySnapshot,
      confirmed: boundaryConfirmed,
      finalized: boundaryFinalized,
    });
    if (
      topicId &&
      shouldBlockComposerConfirm({ text, pendingCard, interviewing })
    ) {
      setError("先确认学习页上的边界卡，再进大纲确认。");
      setTab("learn");
      setSessionOpen(false);
      return;
    }
    const outlineBudget = evaluateOutlineLeafBudget(outline, boundarySnapshot.chunk_budget);
    const overBudget = outlineBudget.overBudget || (outlineBudget.leafCount === 0 && draftRejected);
    if (
      topicId &&
      shouldBlockOverBudgetConfirm({
        text,
        overBudget,
        pendingOutline: shouldShowOutlineConfirm({
          phase: snapshot?.topic?.phase ?? "",
          boundaryConfirmed,
          hasOutline: outline.length > 0,
        }),
        isConfirm: isChatOutlineConfirm(text),
      })
    ) {
      setError("超负荷预算，请重拟。在会话里说「减叶」或「重拟」，不要回「可以」。");
      setTab("learn");
      return;
    }
    try {
      await api.prompt(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    }
  }

  function confirmBoundaryCard() {
    const topicId = snapshot?.currentTopicId;
    if (!topicId) return;
    writeBoundaryConfirmed(topicId, true);
    setBoundaryConfirmed(true);
    setSessionOpen(true);
  }

  async function createTopic() {
    if (creatingTopic.current) return;
    creatingTopic.current = true;
    setLiveRows([]);
    setLoadError(null);
    try {
      const created = await api.createTopic();
      writeCachedTopicId(created.id);
      writeBoundaryConfirmed(created.id, false);
      writeBoundaryFinalized(created.id, false);
      setBoundaryConfirmed(false);
      setBoundaryFinalized(false);
      setTopicPointerNote(null);
      setDraftRejected(false);
      setBooksDrawer(false);
      setTab("learn");
      setSessionOpen(true);
      await refresh();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "新建主题失败");
      setTab("books");
      setBooksDrawer(true);
    } finally {
      creatingTopic.current = false;
    }
  }

  async function switchTopic(id: string) {
    setLiveRows([]);
    writeCachedTopicId(id);
    await api.switchTopic(id);
    setTab("learn");
    await refresh();
  }

  async function selectSection(id: string) {
    const topicId = snapshot?.currentTopicId;
    if (!topicId) return;
    await api.selectSection(topicId, id);
    await refresh();
  }

  async function requestExport(id: string, format: ExportFormat) {
    await api.requestExport(id, format);
    setTab("learn");
    setSessionOpen(true);
  }

  const displayMessages = messages.map((m) => {
    if (m.role !== "assistant") return m;
    const hit = overlays.find((o) => o.text === m.text);
    if (!hit) return m;
    return {
      ...m,
      strategy: m.strategy ?? hit.strategy,
      citations: m.citations?.length ? m.citations : hit.citations,
    };
  });

  const topic = snapshot?.topic ?? null;
  const coachMode = snapshot?.coachMode ?? "stub";
  const settings = snapshot?.settings ?? emptySettings;
  const askedKinds = boundaries.map((b) => b.kind);
  const currentKind = currentUnansweredKind(boundaries);
  const pendingBoundary = shouldShowLearnBoundaryCard({
    phase: topic?.phase ?? "",
    snapshot: boundarySnapshot,
    confirmed: boundaryConfirmed,
    finalized: boundaryFinalized,
  });
  const pendingOutline = shouldShowOutlineConfirm({
    phase: topic?.phase ?? "",
    boundaryConfirmed,
    hasOutline: outline.length > 0,
  });

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col bg-paper shadow-[0_0_0_1px_var(--color-paper-line)] md:max-w-3xl">
      {loadError ? (
        <p className="border-b border-cinnabar/30 bg-cinnabar/10 px-4 py-2 text-xs text-cinnabar">
          {loadError} · 确认 `pnpm dev` 已同时拉起 web 与 server
        </p>
      ) : null}

      {tab === "learn" ? (
        <LearnTab
          topic={topic}
          section={section}
          outline={outline}
          prereqEdges={prereqEdges}
          currentSectionId={snapshot?.currentSectionId ?? null}
          outlineOpen={outlineOpen}
          sessionOpen={sessionOpen}
          onOutlineOpen={setOutlineOpen}
          onSessionOpen={setSessionOpen}
          onSelectSection={(id) => void selectSection(id)}
          messages={displayMessages}
          liveRows={liveRows}
          streaming={streaming}
          busy={busy}
          coachMode={coachMode}
          error={error}
          onSend={(text) => void send(text)}
          snapshot={boundarySnapshot}
          askedKinds={askedKinds}
          currentKind={currentKind}
          pendingBoundary={pendingBoundary}
          pendingOutline={pendingOutline}
          onConfirmBoundary={confirmBoundaryCard}
          topicPointerNote={topicPointerNote}
          draftRejected={draftRejected}
        />
      ) : null}

      {tab === "books" ? (
        <BooksTab
          topic={topic}
          section={section}
          notes={notes}
          outline={outline}
          boundaries={boundaries}
          topics={topics}
          drawerOpen={booksDrawer}
          onDrawerOpen={setBooksDrawer}
          onCreate={() => void createTopic()}
          onSwitch={(id) => void switchTopic(id)}
          onExport={(id, format) => void requestExport(id, format)}
        />
      ) : null}

      {tab === "me" ? (
        <MeTab
          settings={settings}
          heatmap={heatmap}
          onSave={async (next) => {
            await api.saveSettings(next);
            await refresh();
          }}
        />
      ) : null}

      <nav className="grid grid-cols-3 border-t border-paper-line bg-paper pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === "learn"} label="学习" icon={<GraduationCap className="h-5 w-5" />} onClick={() => setTab("learn")} />
        <TabButton active={tab === "books"} label="书籍" icon={<BookOpen className="h-5 w-5" />} onClick={() => setTab("books")} />
        <TabButton active={tab === "me"} label="我的" icon={<User className="h-5 w-5" />} onClick={() => setTab("me")} />
      </nav>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-xs",
        active ? "text-cinnabar" : "text-paper-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
