import { useEffect, useState, type ReactNode } from "react";
import type {
  BoundaryRecord,
  ExportFormat,
  NoteRecord,
  OutlineNode,
  SectionRecord,
  TopicSummary,
} from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { booksNoteMetaLine, countProjectedLeaves } from "@/lib/session-display";
import { useWideLayout } from "@/lib/use-outline-rail";
import { phaseText, useLocale, useT, type Locale } from "@/i18n";
import { cn, formatTime } from "@/lib/utils";

export const BOOKS_PANE_KEY = "quantum.booksContentPane";
export type BooksPane = "body" | "notes";

/** Selected chip fill per pane. Wide content reuses the same token. */
export const BOOKS_PANE_SURFACE = {
  body: "bg-paper",
  notes: "bg-paper-deep/70",
} as const;

/** Wide-layout inactive pane: gray fill, full-opacity text. Not ring/border alone. */
export const BOOKS_PANE_INACTIVE = "bg-paper-ink/30";

export function booksActiveSurface(pane: BooksPane): string {
  return BOOKS_PANE_SURFACE[pane];
}

/** Phone main area always matches Body/正文. Notes chip color stays on the tab. */
export function booksNarrowMainSurface(): string {
  return BOOKS_PANE_SURFACE.body;
}

export function booksMainSurface(pane: BooksPane, wide: boolean): string {
  return wide ? booksActiveSurface(pane) : booksNarrowMainSurface();
}

export function booksSpreadPaneSurface(own: BooksPane, active: BooksPane): string {
  return own === active ? booksActiveSurface(own) : BOOKS_PANE_INACTIVE;
}

export function readBooksPane(): BooksPane {
  try {
    return sessionStorage.getItem(BOOKS_PANE_KEY) === "notes" ? "notes" : "body";
  } catch {
    return "body";
  }
}

export function writeBooksPane(pane: BooksPane): void {
  try {
    sessionStorage.setItem(BOOKS_PANE_KEY, pane);
  } catch {
    /* ignore quota / private mode */
  }
}

export function BooksTab({
  topic,
  section,
  notes,
  outline,
  boundaries,
  topics,
  drawerOpen,
  onDrawerOpen,
  onCreate,
  onSwitch,
  onExport,
}: {
  topic: TopicSummary | null;
  section: SectionRecord | null;
  notes: NoteRecord[];
  outline: OutlineNode[];
  boundaries: BoundaryRecord[];
  topics: TopicSummary[];
  drawerOpen: boolean;
  onDrawerOpen: (open: boolean) => void;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const wide = useWideLayout();
  const [exportId, setExportId] = useState<string | null>(null);
  const [pane, setPane] = useState<BooksPane>(readBooksPane);
  const goal =
    boundaries.find((b) => b.kind === "goal_outcome" || b.kind === "goal")?.answer.trim() || "";
  const leaves = countProjectedLeaves(outline);

  useEffect(() => {
    writeBooksPane(pane);
  }, [pane]);

  function selectPane(next: BooksPane) {
    setPane(next);
    writeBooksPane(next);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className={cn("z-20 border-b border-paper-line px-3", wide ? "py-2" : "py-3")}>
        <TopicHero
          topic={topic}
          goal={goal}
          noteCount={notes.length}
          leaves={leaves}
          wide={wide}
          onOpenDrawer={() => onDrawerOpen(true)}
        />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden" data-testid="books-stage">
        <div
          data-testid="books-content-surface"
          data-pane={topic ? pane : undefined}
          className={cn(
            "h-full min-h-0 px-5",
            wide ? "flex flex-col overflow-hidden py-4" : "quantum-scroll overflow-y-auto py-6",
            topic && booksMainSurface(pane, wide),
          )}
        >
          {!topic ? (
            <p className="mx-auto max-w-md py-10 text-center text-sm text-paper-muted">
              {t("books.emptyBody")}
            </p>
          ) : (
            <div
              data-testid="books-body"
              className={cn("w-full", wide ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-6")}
            >
              <div
                role="tablist"
                aria-label={t("books.contentTabs")}
                className="relative z-10 flex shrink-0 gap-1 rounded-full border border-paper-line bg-paper-ink/10 p-1"
              >
                <PaneTab
                  testId="books-tab-body"
                  pane="body"
                  selected={pane === "body"}
                  label={t("books.tabBody")}
                  onSelect={() => selectPane("body")}
                />
                <PaneTab
                  testId="books-tab-notes"
                  pane="notes"
                  selected={pane === "notes"}
                  label={t("books.tabNotes")}
                  onSelect={() => selectPane("notes")}
                />
              </div>

              {wide ? (
                <div
                  data-testid="books-spread"
                  className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden rounded-lg border border-paper-line"
                >
                  <section
                    role="tabpanel"
                    data-testid="books-pane-body"
                    data-active={pane === "body" ? "true" : "false"}
                    className={cn(
                      "quantum-scroll min-h-0 overflow-y-auto px-5 py-5 transition-colors",
                      booksSpreadPaneSurface("body", pane),
                      pane === "body" && "ring-1 ring-inset ring-cinnabar/25",
                    )}
                  >
                    <BodyCopy section={section} />
                  </section>
                  <section
                    role="tabpanel"
                    data-testid="books-pane-notes"
                    data-active={pane === "notes" ? "true" : "false"}
                    className={cn(
                      "quantum-scroll min-h-0 overflow-y-auto border-l border-paper-line px-5 py-5 transition-colors",
                      booksSpreadPaneSurface("notes", pane),
                      pane === "notes" && "ring-1 ring-inset ring-cinnabar/25",
                    )}
                  >
                    <NotesCopy notes={notes} locale={locale} />
                  </section>
                </div>
              ) : pane === "body" ? (
                <section
                  role="tabpanel"
                  data-testid="books-pane-body"
                  className={booksNarrowMainSurface()}
                >
                  <BodyCopy section={section} />
                </section>
              ) : (
                <section
                  role="tabpanel"
                  data-testid="books-pane-notes"
                  className={booksNarrowMainSurface()}
                >
                  <NotesCopy notes={notes} locale={locale} />
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <Drawer
        contained
        open={drawerOpen}
        side="right"
        title={t("books.drawerTitle")}
        onClose={() => onDrawerOpen(false)}
      >
        <div className="space-y-3 p-3">
            <button
              type="button"
              data-testid="create-topic"
              aria-label={t("books.createTopic")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCreate();
              }}
              className="relative z-10 w-full rounded-lg border border-dashed border-cinnabar/40 bg-paper-deep px-3 py-4 text-left"
            >
              <div className="font-serif text-base text-cinnabar">{t("books.createTopic")}</div>
              <p className="mt-1 text-xs text-paper-muted">{t("books.createTopicHint")}</p>
            </button>
            {topics.map((item) => (
              <article key={item.id} className="rounded-lg border border-paper-line p-3">
                <div className="font-medium">{item.title}</div>
                <p className="mt-1 text-xs text-paper-muted">
                  {phaseText(item.phase, t)} · {formatTime(item.updatedAt, locale)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSwitch(item.id);
                      onDrawerOpen(false);
                    }}
                  >
                    {t("books.switch")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExportId(item.id)}>
                    {t("books.export")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Drawer>

      <Dialog open={Boolean(exportId)} onOpenChange={(o) => !o && setExportId(null)}>
        <DialogContent title={t("books.exportTitle")}>
          <p className="text-sm text-paper-muted">{t("books.exportHint")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["md", "html", "epub"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                onClick={() => {
                  if (exportId) onExport(exportId, format);
                  setExportId(null);
                }}
              >
                {format}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaneTab({
  pane,
  selected,
  label,
  onSelect,
  testId,
}: {
  pane: BooksPane;
  selected: boolean;
  label: string;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      data-testid={testId}
      aria-selected={selected}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
      className={cn(
        "relative z-10 min-h-9 flex-1 rounded-full px-3 py-1.5 text-sm transition-colors",
        selected
          ? cn(booksActiveSurface(pane), "text-cinnabar shadow-sm")
          : "text-paper-muted hover:text-paper-ink",
      )}
    >
      {label}
    </button>
  );
}

function BodyCopy({ section }: { section: SectionRecord | null }) {
  const t = useT();
  if (!section) {
    return <p className="text-sm text-paper-muted">{t("books.noProjection")}</p>;
  }
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper-ink/90">
      {section.bodyMd.slice(0, 800)}
      {section.bodyMd.length > 800 ? "…" : ""}
    </p>
  );
}

function NotesCopy({ notes, locale }: { notes: NoteRecord[]; locale: Locale }) {
  const t = useT();
  return (
    <>
      <p className="text-xs text-paper-muted">{t("books.notesHint")}</p>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-paper-muted">{t("books.noNotes")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-paper-line bg-paper-deep/50 px-3 py-2 text-sm"
            >
              <p>{n.body}</p>
              <p className="mt-1 text-[11px] text-paper-muted" data-testid="books-note-meta">
                {booksNoteMetaLine(n.reasonCode, n.type, formatTime(n.createdAt, locale))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TopicHero({
  topic,
  goal,
  noteCount,
  leaves,
  wide,
  onOpenDrawer,
}: {
  topic: TopicSummary | null;
  goal: string;
  noteCount: number;
  leaves: { ready: number; total: number };
  wide: boolean;
  onOpenDrawer: () => void;
}) {
  const t = useT();
  const chips = topic ? (
    <>
      <MetaChip>
        {t("books.sections", { ready: leaves.ready, total: leaves.total || "—" })}
      </MetaChip>
      <MetaChip>{t("books.notesCount", { count: noteCount })}</MetaChip>
      <MetaChip>
        {phaseText(topic.phase, t)}
        {topic.exportState !== "idle"
          ? ` · ${t("books.exportState", { state: topic.exportState })}`
          : ""}
      </MetaChip>
    </>
  ) : (
    <>
      <MetaChip>{t("books.sectionsDash")}</MetaChip>
      <MetaChip>{t("books.notesZero")}</MetaChip>
      <MetaChip>{t("books.notStarted")}</MetaChip>
    </>
  );

  return (
    <section
      data-testid="books-hero"
      data-layout={wide ? "wide" : "narrow"}
      className={cn(
        "hero-topic relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[1.35rem] border border-paper-line/90 pl-5",
        wide ? "min-h-16 px-4 py-2" : "px-4 py-4",
      )}
    >
      <span aria-hidden className={cn("hero-accent", wide && "hero-accent--wide")} />
      {wide ? (
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center self-center gap-x-4">
          <div
            data-testid="books-hero-primary"
            className="flex min-w-0 items-center gap-2"
          >
            <p className="shrink-0 text-[11px] font-semibold tracking-[0.18em] text-cinnabar">
              {t("books.currentTopic")}
            </p>
            <h1 className="min-w-0 truncate font-serif text-[1.15rem] leading-none">
              {topic ? topic.title : t("books.noCurrentTitle")}
            </h1>
          </div>
          <div
            data-testid="books-hero-meta"
            className="flex flex-wrap items-center justify-end self-center gap-1.5"
          >
            {chips}
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-cinnabar">
            {t("books.currentTopic")}
          </p>
          {topic ? (
            <>
              <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">{topic.title}</h1>
              {goal ? (
                <p className="mt-2 line-clamp-2 text-sm text-paper-ink/80">{goal}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>
            </>
          ) : (
            <>
              <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">
                {t("books.noCurrentTitle")}
              </h1>
              <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div>
            </>
          )}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="relative z-10 shrink-0 self-center"
        data-testid="open-topic-drawer"
        aria-label={t("books.openDrawer")}
        onClick={onOpenDrawer}
      >
        {t("books.switch")}
      </Button>
    </section>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="meta-chip inline-flex items-center rounded-full border border-cinnabar/15 bg-white/55 px-2.5 py-0.5 text-[11px] text-paper-ink/80">
      {children}
    </span>
  );
}
