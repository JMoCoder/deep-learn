import { useState } from "react";
import Markdown from "react-markdown";
import { BookMarked, List } from "lucide-react";
import type {
  NoteKind,
  NoteRecord,
  OutlineNode,
  PrereqEdge,
  SectionRecord,
  TopicSummary,
} from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { OutlineTree } from "@/components/OutlineTree";
import { PrereqEdgeList } from "@/components/PrereqEdgeList";
import { Button } from "@/components/ui/button";
import { useLocale, useT, type TFunction } from "@/i18n";
import { filterNotes, type NotesKindFilter, type NotesScope } from "@/lib/notes-filter";
import {
  findOutlineNode,
  mergePrereqEdges,
  prereqsPointingAt,
} from "@/lib/prereq-display";
import { booksNoteMetaLine } from "@/lib/session-display";
import { cn, formatTime } from "@/lib/utils";

const KIND_FILTERS: NotesKindFilter[] = ["all", "formal", "highlight", "thinking"];

export function NotesTab({
  topic,
  section,
  outline,
  prereqEdges,
  currentSectionId,
  notes,
  outlineOpen,
  outlinePersistent,
  notesOpen,
  notesPersistent,
  onOutlineOpen,
  onNotesOpen,
  onSelectSection,
}: {
  topic: TopicSummary | null;
  section: SectionRecord | null;
  outline: OutlineNode[];
  prereqEdges: PrereqEdge[];
  currentSectionId: string | null;
  notes: NoteRecord[];
  outlineOpen: boolean;
  outlinePersistent?: boolean;
  notesOpen: boolean;
  notesPersistent?: boolean;
  onOutlineOpen: (open: boolean) => void;
  onNotesOpen: (open: boolean) => void;
  onSelectSection: (id: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [scope, setScope] = useState<NotesScope>("section");
  const [kind, setKind] = useState<NotesKindFilter>("all");

  const center = topic
    ? `${topic.title}·${section?.title ?? t("learn.sectionFallback")}`
    : t("notes.centerFallback");
  const edges = mergePrereqEdges(prereqEdges, outline);
  const currentNode =
    findOutlineNode(outline, section?.outlineNodeId ?? null) ??
    findOutlineNode(outline, currentSectionId);
  const currentPrereqs = currentNode ? prereqsPointingAt(currentNode.id, edges) : [];
  const sectionKey = section?.id ?? currentSectionId;
  const visible = filterNotes(notes, {
    scope,
    kind,
    sectionId: sectionKey,
  });

  const railOpen = Boolean(outlinePersistent && outlineOpen);
  const outlineDrawerOpen = Boolean(!outlinePersistent && outlineOpen);
  const notesRailOpen = Boolean(notesPersistent && notesOpen);
  const notesDrawerOpen = Boolean(!notesPersistent && notesOpen);

  function notesList() {
    return (
      <NotesListPane
        topic={topic}
        scope={scope}
        kind={kind}
        onScope={setScope}
        onKind={setKind}
        notes={visible}
        totalInBook={notes.length}
        locale={locale}
        t={t}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="notes-stage">
      <div className="flex min-h-0 flex-1">
        <aside
          data-testid="notes-outline-rail"
          data-state={railOpen ? "open" : "closed"}
          data-swipe-dismiss="false"
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
              data-testid="notes-outline-rail-header"
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
            data-testid="notes-top-region"
            className="z-20 grid h-[var(--top-region-height)] grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-paper-line px-2"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("learn.openOutline")}
              aria-expanded={outlineOpen}
              data-testid="notes-outline-toggle"
              onClick={() => onOutlineOpen(!outlineOpen)}
            >
              <List className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-center font-serif text-[15px]">{center}</h1>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("notes.openList")}
              aria-expanded={notesOpen}
              data-testid="notes-list-toggle"
              onClick={() => onNotesOpen(!notesOpen)}
            >
              <BookMarked className="h-5 w-5" />
            </Button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="notes-content-surface">
            <div className="pointer-events-none absolute inset-0 notes-atmosphere" aria-hidden />
            <div className="quantum-scroll relative h-full min-h-0 overflow-y-auto px-5 py-6">
              {!topic ? (
                <Empty title={t("notes.needBook")} body={t("notes.needBookHint")} />
              ) : !section ? (
                <Empty title={t("learn.emptySectionTitle")} body={t("learn.emptySectionBody")} />
              ) : (
                <article data-testid="notes-article" className="prose-quantum learn-article-enter w-full">
                  {currentPrereqs.length ? (
                    <div className="mb-4 rounded-lg border border-paper-line bg-paper-deep/40 px-3 py-2 not-prose">
                      <p className="text-[11px] font-semibold tracking-wide text-pine">{t("learn.prereq")}</p>
                      <PrereqEdgeList edges={currentPrereqs} compact />
                    </div>
                  ) : null}
                  <Markdown>{section.bodyMd}</Markdown>
                </article>
              )}
            </div>
          </div>
        </div>

        <aside
          data-testid="notes-list-rail"
          data-state={notesRailOpen ? "open" : "closed"}
          data-swipe-dismiss="false"
          aria-hidden={!notesRailOpen}
          inert={!notesRailOpen}
          className={cn(
            "flex shrink-0 flex-col overflow-hidden bg-paper",
            "transition-[width] duration-200 ease-out",
            notesRailOpen
              ? "w-[var(--session-rail-width)] border-l border-paper-line"
              : "pointer-events-none w-0 border-l-0",
          )}
        >
          <div className="flex h-full w-[var(--session-rail-width)] min-w-[var(--session-rail-width)] flex-col">
            {notesPersistent ? notesList() : null}
          </div>
        </aside>
      </div>

      <Drawer
        contained
        swipeDismiss
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
        swipeDismiss
        fill
        open={notesDrawerOpen}
        side="right"
        title={t("notes.drawerTitle")}
        onClose={() => onNotesOpen(false)}
      >
        {notesPersistent ? null : notesList()}
      </Drawer>
    </div>
  );
}

function NotesListPane({
  topic,
  scope,
  kind,
  onScope,
  onKind,
  notes,
  totalInBook,
  locale,
  t,
}: {
  topic: TopicSummary | null;
  scope: NotesScope;
  kind: NotesKindFilter;
  onScope: (scope: NotesScope) => void;
  onKind: (kind: NotesKindFilter) => void;
  notes: NoteRecord[];
  totalInBook: number;
  locale: "zh" | "en";
  t: TFunction;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="notes-pane">
      <header
        data-testid="notes-list-header"
        className="border-b border-paper-line px-4 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-base">{t("notes.drawerTitle")}</h2>
          <div
            data-testid="notes-scope-toggle"
            className="inline-flex rounded-md border border-paper-line p-0.5 text-[11px]"
            role="group"
            aria-label={t("notes.scopeLabel")}
          >
            <ScopeChip
              active={scope === "section"}
              testId="notes-scope-section"
              label={t("notes.scopeSection")}
              onClick={() => onScope("section")}
            />
            <ScopeChip
              active={scope === "book"}
              testId="notes-scope-book"
              label={t("notes.scopeBook")}
              onClick={() => onScope("book")}
            />
          </div>
        </div>
        <div
          data-testid="notes-kind-filter"
          className="mt-2.5 flex flex-wrap gap-1.5"
          role="group"
          aria-label={t("notes.kindLabel")}
        >
          {KIND_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              data-testid={`notes-kind-${item}`}
              data-active={kind === item ? "true" : "false"}
              onClick={() => onKind(item)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                kind === item
                  ? "bg-cinnabar/12 text-cinnabar"
                  : "text-paper-muted hover:bg-paper-deep hover:text-paper-ink",
              )}
            >
              {kindLabel(item, t)}
            </button>
          ))}
        </div>
        {topic ? (
          <p className="mt-2 text-[11px] text-paper-muted">
            {scope === "book"
              ? t("notes.scopeBookHint", { title: topic.title })
              : t("notes.scopeSectionHint")}
          </p>
        ) : null}
      </header>

      <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!topic ? (
          <p className="px-1 py-4 text-sm text-paper-muted">{t("notes.needBook")}</p>
        ) : notes.length === 0 ? (
          <div className="px-1 py-4" data-testid="notes-empty">
            <p className="text-sm text-paper-muted">{t("notes.empty")}</p>
            {scope === "section" && totalInBook > 0 ? (
              <button
                type="button"
                data-testid="notes-show-all"
                className="mt-3 text-sm text-cinnabar underline-offset-2 hover:underline"
                onClick={() => onScope("book")}
              >
                {t("notes.showAllInBook", { count: totalInBook })}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((n, index) => (
              <li
                key={n.id}
                className="notes-card-enter rounded-xl border border-paper-line bg-paper/80 px-3 py-2 text-sm"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                data-testid="notes-item"
                data-kind={n.kind}
              >
                <p className="leading-relaxed">{n.body}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-paper-muted">
                  <span data-testid="notes-item-kind">{kindLabel(n.kind, t)}</span>
                  <span aria-hidden>·</span>
                  <span data-testid="notes-item-meta">
                    {booksNoteMetaLine(n.reasonCode, n.type, formatTime(n.createdAt, locale))}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScopeChip({
  active,
  label,
  testId,
  onClick,
}: {
  active: boolean;
  label: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 font-medium transition-colors",
        active ? "bg-cinnabar text-white" : "text-paper-muted hover:text-paper-ink",
      )}
    >
      {label}
    </button>
  );
}

function kindLabel(kind: NotesKindFilter | NoteKind, t: TFunction): string {
  if (kind === "all") return t("notes.kindAll");
  if (kind === "formal") return t("notes.kindFormal");
  if (kind === "highlight") return t("notes.kindHighlight");
  return t("notes.kindThinking");
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-muted">{body}</p>
    </div>
  );
}
