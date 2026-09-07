import { useState, type ReactNode } from "react";
import { Library } from "lucide-react";
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
import { countOutlineLeaves, uiNoteType } from "@/lib/session-display";
import { phaseText, useLocale, useT } from "@/i18n";
import { formatTime } from "@/lib/utils";

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
  const [exportId, setExportId] = useState<string | null>(null);
  const goal =
    boundaries.find((b) => b.kind === "goal_outcome" || b.kind === "goal")?.answer.trim() || "";
  const leaves = countOutlineLeaves(outline);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-paper-line px-3 py-3">
        <div className="flex items-stretch gap-2">
          <TopicHero topic={topic} goal={goal} noteCount={notes.length} leaves={leaves} />
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0"
            data-testid="open-topic-drawer"
            aria-label={t("books.openDrawer")}
            onClick={() => onDrawerOpen(true)}
          >
            <Library className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {!topic ? (
          <p className="mx-auto max-w-md py-10 text-center text-sm text-paper-muted">
            {t("books.emptyBody")}
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            <section>
              {section ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper-ink/90">
                  {section.bodyMd.slice(0, 800)}
                  {section.bodyMd.length > 800 ? "…" : ""}
                </p>
              ) : (
                <p className="text-sm text-paper-muted">{t("books.noProjection")}</p>
              )}
            </section>
            <section>
              <h2 className="font-serif text-base">{t("books.notes")}</h2>
              <p className="mt-1 text-xs text-paper-muted">
                {t("books.notesHint")}
              </p>
              {notes.length === 0 ? (
                <p className="mt-3 text-sm text-paper-muted">{t("books.noNotes")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-paper-line bg-paper-deep/50 px-3 py-2 text-sm">
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-paper-muted">
                        {uiNoteType(n.reasonCode, n.type)} · {n.reasonCode} · {formatTime(n.createdAt, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} side="right" title={t("books.drawerTitle")} onClose={() => onDrawerOpen(false)}>
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
          <p className="text-sm text-paper-muted">
            {t("books.exportHint")}
          </p>
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

function TopicHero({
  topic,
  goal,
  noteCount,
  leaves,
}: {
  topic: TopicSummary | null;
  goal: string;
  noteCount: number;
  leaves: { ready: number; total: number };
}) {
  const t = useT();
  return (
    <section className="hero-topic relative min-w-0 flex-1 overflow-hidden rounded-[1.35rem] border border-paper-line/90 px-4 py-4 pl-5">
      <span aria-hidden className="hero-accent" />
      <p className="text-[11px] font-semibold tracking-[0.18em] text-cinnabar">{t("books.currentTopic")}</p>
      {topic ? (
        <>
          <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">{topic.title}</h1>
          {goal ? (
            <p className="mt-2 line-clamp-2 text-sm text-paper-ink/80">{goal}</p>
          ) : (
            <p className="mt-2 text-sm text-paper-muted">{t("books.noGoal")}</p>
          )}
          {topic.phase === "outline_draft" ? (
            <p className="mt-2 text-xs text-paper-muted">{t("books.outlineOnLearn")}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaChip>
              {t("books.sections", { ready: leaves.ready, total: leaves.total || "—" })}
            </MetaChip>
            <MetaChip>{t("books.notesCount", { count: noteCount })}</MetaChip>
            <MetaChip>
              {phaseText(topic.phase, t)}
              {topic.exportState !== "idle" ? ` · ${t("books.exportState", { state: topic.exportState })}` : ""}
            </MetaChip>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">{t("books.noCurrentTitle")}</h1>
          <p className="mt-2 text-sm text-paper-muted">{t("books.noCurrentBody")}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaChip>{t("books.sectionsDash")}</MetaChip>
            <MetaChip>{t("books.notesZero")}</MetaChip>
            <MetaChip>{t("books.notStarted")}</MetaChip>
          </div>
        </>
      )}
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
