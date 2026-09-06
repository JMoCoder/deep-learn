import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  AppSnapshot,
  BoundaryRecord,
  ExportFormat,
  HeatmapDay,
  NoteRecord,
  OutlineNode,
  PublicSettings,
  SectionRecord,
  SessionEvent,
  SessionMessage,
  TopicSummary,
} from "@quantum/shared";
import { BookOpen, GraduationCap, User } from "lucide-react";
import { BooksTab } from "@/tabs/BooksTab";
import { LearnTab } from "@/tabs/LearnTab";
import { MeTab } from "@/tabs/MeTab";
import { api, connectEvents } from "@/lib/api";
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
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [booksDrawer, setBooksDrawer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const state = await api.state();
      setSnapshot(state);
      setTopics(await api.topics());
      setHeatmap(await api.heatmap());
      setMessages(await api.messages());
      if (state.currentTopicId) {
        const detail = await api.topic(state.currentTopicId);
        setOutline(detail.outline);
        setSection(detail.currentSection);
        setNotes(detail.notes);
        setBoundaries(detail.boundaries);
      } else {
        setOutline([]);
        setSection(null);
        setNotes([]);
        setBoundaries([]);
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
        case "phase_changed":
        case "topic_updated":
        case "section_updated":
        case "note_appended":
        case "outline_updated":
          void refresh();
          break;
        default:
          break;
      }
    });
  }, [refresh]);

  async function send(text: string) {
    setError(null);
    try {
      await api.prompt(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function createTopic() {
    await api.createTopic();
    setTab("learn");
    setSessionOpen(true);
    await refresh();
  }

  async function switchTopic(id: string) {
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

  const topic = snapshot?.topic ?? null;
  const coachMode = snapshot?.coachMode ?? "stub";
  const settings = snapshot?.settings ?? emptySettings;

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
          currentSectionId={snapshot?.currentSectionId ?? null}
          outlineOpen={outlineOpen}
          sessionOpen={sessionOpen}
          onOutlineOpen={setOutlineOpen}
          onSessionOpen={setSessionOpen}
          onSelectSection={(id) => void selectSection(id)}
          messages={messages}
          streaming={streaming}
          busy={busy}
          coachMode={coachMode}
          error={error}
          onSend={(text) => void send(text)}
        />
      ) : null}

      {tab === "books" ? (
        <BooksTab
          topic={topic}
          section={section}
          notes={notes}
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
