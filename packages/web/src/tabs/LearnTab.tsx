import Markdown from "react-markdown";
import { List, Sparkles } from "lucide-react";
import type {
  BoundarySnapshot,
  OutlineNode,
  PrereqEdge,
  SectionRecord,
  SessionMessage,
  TopicPhase,
  TopicSummary,
} from "@quantum/shared";
import { AcceptHint } from "@/components/AcceptHint";
import { BoundaryCard } from "@/components/BoundaryCard";
import { Drawer } from "@/components/Drawer";
import { OutlineConfirmCard } from "@/components/OutlineConfirmCard";
import { OutlineTree } from "@/components/OutlineTree";
import { PrereqEdgeList } from "@/components/PrereqEdgeList";
import { SessionPane } from "@/components/SessionPane";
import { Button } from "@/components/ui/button";
import {
  findOutlineNode,
  mergePrereqEdges,
  outlineTitleMap,
  prereqsPointingAt,
  sectionHasProjectedBody,
} from "@/lib/prereq-display";
import { evaluateOutlineLeafBudget } from "@/lib/outline-budget";
import type { LiveSessionRow } from "@/lib/session-display";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export function LearnTab({
  topic,
  section,
  outline,
  prereqEdges,
  currentSectionId,
  outlineOpen,
  outlinePersistent,
  sessionOpen,
  sessionPersistent,
  onOutlineOpen,
  onSessionOpen,
  onSelectSection,
  messages,
  liveRows,
  streaming,
  busy,
  coachMode,
  error,
  onSend,
  snapshot,
  askedKinds,
  currentKind,
  pendingBoundary,
  pendingOutline,
  onConfirmBoundary,
  topicPointerNote,
  draftRejected,
  awaitingTopicAnchor,
}: {
  topic: TopicSummary | null;
  section: SectionRecord | null;
  outline: OutlineNode[];
  prereqEdges: PrereqEdge[];
  currentSectionId: string | null;
  outlineOpen: boolean;
  outlinePersistent?: boolean;
  sessionOpen: boolean;
  sessionPersistent?: boolean;
  onOutlineOpen: (open: boolean) => void;
  onSessionOpen: (open: boolean) => void;
  onSelectSection: (id: string) => void;
  messages: SessionMessage[];
  liveRows: LiveSessionRow[];
  streaming: string;
  busy: boolean;
  coachMode: "stub" | "live";
  error: string | null;
  onSend: (text: string) => void;
  snapshot: BoundarySnapshot;
  askedKinds: string[];
  currentKind?: string | null;
  pendingBoundary: boolean;
  pendingOutline: boolean;
  onConfirmBoundary: () => void;
  topicPointerNote?: string | null;
  draftRejected?: boolean;
  awaitingTopicAnchor?: boolean;
}) {
  const t = useT();
  const center = topic
    ? `${topic.title}·${section?.title ?? t("learn.sectionFallback")}`
    : t("learn.centerFallback");
  const phase: TopicPhase | "" = topic?.phase ?? "";
  const edges = mergePrereqEdges(prereqEdges, outline);
  const titles = outlineTitleMap(outline);
  const currentNode =
    findOutlineNode(outline, section?.outlineNodeId ?? null) ??
    findOutlineNode(outline, currentSectionId);
  const currentPrereqs = currentNode ? prereqsPointingAt(currentNode.id, edges) : [];
  const liveBudget = evaluateOutlineLeafBudget(outline, snapshot.chunk_budget);
  const outlineBudget = {
    ...liveBudget,
    overBudget: liveBudget.overBudget || (liveBudget.leafCount === 0 && Boolean(draftRejected)),
    canConfirm: liveBudget.canConfirm && !(liveBudget.leafCount === 0 && draftRejected),
  };

  const railOpen = Boolean(outlinePersistent && outlineOpen);
  const outlineDrawerOpen = Boolean(!outlinePersistent && outlineOpen);
  const sessionRailOpen = Boolean(sessionPersistent && sessionOpen);
  const sessionDrawerOpen = Boolean(!sessionPersistent && sessionOpen);

  function sessionPane() {
    return (
      <SessionPane
        messages={messages}
        liveRows={liveRows}
        streaming={streaming}
        busy={busy}
        coachMode={coachMode}
        error={error}
        onSend={onSend}
        phase={phase}
        snapshot={snapshot}
        askedKinds={askedKinds}
        currentKind={currentKind}
        pendingBoundary={pendingBoundary}
        pendingOutline={pendingOutline}
        overBudget={outlineBudget.overBudget}
        scopeIn={snapshot.scope_in}
        scopeOut={snapshot.scope_out}
        sectionTitles={titles}
        onCiteSection={onSelectSection}
        canOpenCite={(id) => sectionHasProjectedBody(id, section, outline)}
        awaitingTopicAnchor={awaitingTopicAnchor}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <aside
          data-testid="outline-rail"
          data-state={railOpen ? "open" : "closed"}
          aria-hidden={!railOpen}
          className={cn(
            "flex shrink-0 flex-col overflow-hidden bg-paper",
            "transition-[width] duration-200 ease-out",
            railOpen
              ? "w-[var(--outline-rail-width)] border-r border-paper-line"
              : "pointer-events-none w-0 border-r-0",
          )}
        >
          <div className="flex h-full w-[var(--outline-rail-width)] min-w-[var(--outline-rail-width)] flex-col">
            <header
              data-testid="outline-rail-header"
              className="flex h-[var(--top-region-height)] items-center border-b border-paper-line px-4"
            >
              <h2 className="font-serif text-base">{t("learn.drawerOutline")}</h2>
            </header>
            <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto">
              <OutlineTree
                nodes={outline}
                currentId={currentSectionId}
                edges={edges}
                onSelect={onSelectSection}
              />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            data-testid="learn-top-region"
            className="z-20 grid h-[var(--top-region-height)] grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-paper-line px-2"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("learn.openOutline")}
              aria-expanded={outlineOpen}
              data-testid="learn-outline-toggle"
              onClick={() => onOutlineOpen(!outlineOpen)}
            >
              <List className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-center font-serif text-[15px]">{center}</h1>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("learn.openSession")}
              aria-expanded={sessionOpen}
              data-testid="learn-session-toggle"
              onClick={() => onSessionOpen(!sessionOpen)}
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="learn-stage">
            <div className="quantum-scroll h-full min-h-0 overflow-y-auto px-5 py-6">
              {topicPointerNote ? (
                <p className="mb-4 w-full rounded-lg border border-cinnabar/25 bg-cinnabar/8 px-3 py-2 text-xs leading-relaxed text-cinnabar">
                  {topicPointerNote}
                </p>
              ) : null}
              {!topic ? (
                <Empty
                  title={t("learn.emptyTopicTitle")}
                  body={t("learn.emptyTopicBody")}
                />
              ) : pendingBoundary ? (
                <BoundaryCard
                  snapshot={snapshot}
                  askedKinds={askedKinds}
                  currentKind={currentKind}
                  coachMode={coachMode}
                  onConfirm={onConfirmBoundary}
                  onNeedMore={() => onSessionOpen(true)}
                />
              ) : pendingOutline ? (
                <OutlineConfirmCard
                  nodes={outline}
                  edges={edges}
                  chunkBudget={snapshot.chunk_budget}
                  draftRejected={draftRejected}
                  onConfirm={() => onSend("可以")}
                  onRevise={() => onSessionOpen(true)}
                />
              ) : !section ? (
                <Empty
                  title={t("learn.emptySectionTitle")}
                  body={t("learn.emptySectionBody")}
                />
              ) : (
                <article data-testid="learn-article" className="prose-quantum w-full">
                  {currentPrereqs.length ? (
                    <div className="mb-4 rounded-lg border border-paper-line bg-paper-deep/40 px-3 py-2 not-prose">
                      <p className="text-[11px] font-semibold tracking-wide text-pine">{t("learn.prereq")}</p>
                      <PrereqEdgeList edges={currentPrereqs} compact />
                    </div>
                  ) : null}
                  <Markdown>{section.bodyMd}</Markdown>
                </article>
              )}
              {topic && !pendingBoundary ? (
                <div className="mt-6 w-full">
                  <AcceptHint
                    phase={phase}
                    pendingBoundary={pendingBoundary}
                    pendingOutline={pendingOutline}
                    hasTopic
                    overBudget={outlineBudget.overBudget}
                    awaitingTopicAnchor={awaitingTopicAnchor}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside
          data-testid="session-rail"
          data-state={sessionRailOpen ? "open" : "closed"}
          aria-hidden={!sessionRailOpen}
          className={cn(
            "flex shrink-0 flex-col overflow-hidden bg-paper",
            "transition-[width] duration-200 ease-out",
            sessionRailOpen
              ? "w-[var(--session-rail-width)] border-l border-paper-line"
              : "pointer-events-none w-0 border-l-0",
          )}
        >
          <div className="flex h-full w-[var(--session-rail-width)] min-w-[var(--session-rail-width)] flex-col">
            <header
              data-testid="session-rail-header"
              className="flex h-[var(--top-region-height)] items-center border-b border-paper-line px-4"
            >
              <h2 className="font-serif text-base">{t("learn.drawerSession")}</h2>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden">{sessionPane()}</div>
          </div>
        </aside>
      </div>

      <Drawer
        contained
        open={outlineDrawerOpen}
        side="left"
        title={t("learn.drawerOutline")}
        onClose={() => onOutlineOpen(false)}
      >
        <OutlineTree
          nodes={outline}
          currentId={currentSectionId}
          edges={edges}
          onSelect={(id) => {
            onSelectSection(id);
            onOutlineOpen(false);
          }}
        />
      </Drawer>

      <Drawer
        contained
        open={sessionDrawerOpen}
        side="right"
        title={t("learn.drawerSession")}
        onClose={() => onSessionOpen(false)}
      >
        {sessionPane()}
      </Drawer>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-muted">{body}</p>
    </div>
  );
}
