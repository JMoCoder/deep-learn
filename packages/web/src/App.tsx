import { type ReactNode, useState } from "react";
import type { ExportFormat, PublicSettings } from "@quantum/shared";
import type { AppTab } from "@/app/tabs";
import { useLocale, useT } from "@/i18n";
import { BookMarked, GraduationCap, Library, User } from "lucide-react";
import { LearnTab } from "@/tabs/LearnTab";
import { MeTab } from "@/tabs/MeTab";
import { NotesTab } from "@/tabs/NotesTab";
import { ShelfTab } from "@/tabs/ShelfTab";
import { api } from "@/lib/api";
import { currentUnansweredKind, needsTopicAnchor } from "@/lib/interview-ui";
import { useLearnActions } from "@/lib/use-learn-actions";
import { useLearnGates } from "@/lib/use-learn-gates";
import { useLearnRails } from "@/lib/use-learn-rails";
import { useSessionEvents } from "@/lib/use-session-events";
import { useTopicPointer } from "@/lib/use-topic-pointer";
import { cn } from "@/lib/utils";

export type { AppTab } from "@/app/tabs";

const emptySettings: PublicSettings = {
  provider: "openai",
  modelId: "gpt-4o-mini",
  baseUrl: "",
  hasApiKey: false,
};

export default function App() {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<AppTab>("learn");
  const [shelfDrawer, setShelfDrawer] = useState(false);
  const rails = useLearnRails();
  const pointer = useTopicPointer(t);
  const gates = useLearnGates(pointer.snapshot);
  const session = useSessionEvents({
    refresh: pointer.refresh,
    locale,
    t,
    outlineRef: pointer.outlineRef,
    applyBoundaryFinalizedEvent: gates.applyBoundaryFinalizedEvent,
    setBoundarySnapshot: pointer.setBoundarySnapshot,
    setDraftRejected: pointer.setDraftRejected,
    setTab,
    setSessionOpen: rails.setSessionOpen,
  });
  const actions = useLearnActions({
    t,
    snapshot: pointer.snapshot,
    outline: pointer.outline,
    boundaries: pointer.boundaries,
    boundarySnapshot: pointer.boundarySnapshot,
    boundaryConfirmed: gates.boundaryConfirmed,
    boundaryFinalized: gates.boundaryFinalized,
    topicAnchor: gates.topicAnchor,
    setTopicAnchor: gates.setTopicAnchor,
    writeTopicAnchor: gates.writeTopicAnchor,
    draftRejected: pointer.draftRejected,
    setDraftRejected: pointer.setDraftRejected,
    refresh: pointer.refresh,
    confirmBoundary: gates.confirmBoundary,
    resetGatesForNewTopic: gates.resetGatesForNewTopic,
    setLiveRows: session.setLiveRows,
    setError: session.setError,
    setLoadError: pointer.setLoadError,
    setTab,
    setSessionOpen: rails.setSessionOpen,
    setShelfDrawer,
  });

  const awaitingTopicAnchor = needsTopicAnchor({
    phase: pointer.snapshot?.topic?.phase ?? "",
    title: pointer.snapshot?.topic?.title,
    anchored: Boolean(gates.topicAnchor),
  });
  const topic = pointer.snapshot?.topic
    ? { ...pointer.snapshot.topic, title: gates.topicAnchor || pointer.snapshot.topic.title }
    : null;
  const coachMode = pointer.snapshot?.coachMode ?? "stub";
  const settings = pointer.snapshot?.settings ?? emptySettings;
  const generationEnabled = pointer.snapshot?.generationEnabled ?? false;
  const askedKinds = pointer.boundaries.map((b) => b.kind);
  const currentKind = currentUnansweredKind(pointer.boundaries);

  return (
    <div
      data-app-frame
      className="relative flex h-dvh w-full min-w-0 flex-col bg-paper"
    >
      <div className="pointer-events-none absolute inset-0 app-atmosphere" aria-hidden />
      {pointer.loadError ? (
        <p className="relative z-10 border-b border-cinnabar/30 bg-cinnabar/10 px-4 py-2 text-xs text-cinnabar">
          {pointer.loadError} · {t("app.loadErrorSuffix")}
        </p>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {tab === "shelf" ? (
          <ShelfTab
            topic={topic}
            topics={pointer.topics}
            drawerOpen={shelfDrawer}
            onDrawerOpen={setShelfDrawer}
            onImportHtml={(html, title) => actions.importHtml(html, title)}
            onSwitch={(id) => void actions.switchTopic(id)}
            onExport={(id, format: ExportFormat) => void actions.requestExport(id, format)}
            importing={actions.importing}
          />
        ) : null}

        {tab === "learn" ? (
          <LearnTab
            topic={topic}
            section={pointer.section}
            outline={pointer.outline}
            prereqEdges={pointer.prereqEdges}
            currentSectionId={pointer.snapshot?.currentSectionId ?? null}
            outlineOpen={rails.outlineOpen}
            outlinePersistent={rails.persistent}
            sessionOpen={rails.sessionOpen}
            sessionPersistent={rails.persistent}
            onOutlineOpen={rails.setOutlineOpen}
            onSessionOpen={rails.setSessionOpen}
            onSelectSection={(id) => void actions.selectSection(id)}
            messages={session.displayMessages(pointer.messages)}
            liveRows={session.liveRows}
            streaming={session.streaming}
            busy={session.busy}
            coachMode={coachMode}
            error={session.error}
            onSend={(text) => void actions.send(text)}
            snapshot={pointer.boundarySnapshot}
            askedKinds={askedKinds}
            currentKind={currentKind}
            pendingBoundary={actions.pendingBoundary}
            pendingOutline={actions.pendingOutline}
            onConfirmBoundary={() => void actions.confirmBoundaryCard()}
            onConfirmOutline={() => void actions.confirmOutlineCard()}
            onReviseOutline={() => void actions.reduceOutlineCard()}
            topicPointerNote={pointer.topicPointerNote ? t(pointer.topicPointerNote) : null}
            draftRejected={pointer.draftRejected}
            awaitingTopicAnchor={awaitingTopicAnchor}
            generationEnabled={generationEnabled}
          />
        ) : null}

        {tab === "notes" ? <NotesTab topic={topic} notes={pointer.notes} /> : null}

        {tab === "me" ? (
          <MeTab
            settings={settings}
            onSave={async (next) => {
              await api.saveSettings(next);
              await pointer.refresh();
            }}
          />
        ) : null}
      </div>

      <nav className="relative z-10 grid grid-cols-4 border-t border-paper-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <TabButton
          testId="tab-shelf"
          active={tab === "shelf"}
          label={t("tab.shelf")}
          icon={<Library className="h-5 w-5" />}
          onClick={() => setTab("shelf")}
        />
        <TabButton
          testId="tab-learn"
          active={tab === "learn"}
          label={t("tab.learn")}
          icon={<GraduationCap className="h-5 w-5" />}
          onClick={() => setTab("learn")}
        />
        <TabButton
          testId="tab-notes"
          active={tab === "notes"}
          label={t("tab.notes")}
          icon={<BookMarked className="h-5 w-5" />}
          onClick={() => setTab("notes")}
        />
        <TabButton
          testId="tab-me"
          active={tab === "me"}
          label={t("tab.me")}
          icon={<User className="h-5 w-5" />}
          onClick={() => setTab("me")}
        />
      </nav>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
  testId,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-xs transition-colors duration-200",
        active ? "text-cinnabar" : "text-paper-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
