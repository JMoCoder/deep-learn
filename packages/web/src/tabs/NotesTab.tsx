import type { NoteRecord, TopicSummary } from "@quantum/shared";
import { booksNoteMetaLine } from "@/lib/session-display";
import { useWideLayout } from "@/lib/use-outline-rail";
import { useLocale, useT } from "@/i18n";
import { cn, formatTime } from "@/lib/utils";

export function NotesTab({
  topic,
  notes,
}: {
  topic: TopicSummary | null;
  notes: NoteRecord[];
}) {
  const t = useT();
  const locale = useLocale();
  const wide = useWideLayout();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 notes-atmosphere" aria-hidden />
      <header className={cn("relative z-10 border-b border-paper-line px-3", wide ? "py-2" : "py-3")}>
        <section
          data-testid="notes-hero"
          className={cn(
            "hero-topic relative overflow-hidden rounded-[1.35rem] border border-paper-line/90 pl-5",
            wide ? "min-h-16 px-4 py-2" : "px-4 py-4",
          )}
        >
          <span aria-hidden className={cn("hero-accent", wide && "hero-accent--wide")} />
          <p className="text-[11px] font-semibold tracking-[0.18em] text-cinnabar">
            {t("notes.kicker")}
          </p>
          <h1 className="mt-1 font-serif text-[1.45rem] leading-tight">
            {topic ? t("notes.titleWithBook", { title: topic.title }) : t("notes.titleEmpty")}
          </h1>
          <p className="mt-1.5 text-sm text-paper-muted">{t("notes.lead")}</p>
        </section>
      </header>

      <div
        className="relative z-10 min-h-0 flex-1 overflow-hidden"
        data-testid="notes-stage"
      >
        <div
          data-testid="notes-content-surface"
          className={cn(
            "quantum-scroll h-full min-h-0 overflow-y-auto px-5 py-6",
            "bg-paper-deep/70",
          )}
        >
          {!topic ? (
            <p className="mx-auto max-w-md py-10 text-center text-sm text-paper-muted">
              {t("notes.needBook")}
            </p>
          ) : (
            <div data-testid="notes-pane" className="mx-auto w-full max-w-2xl">
              <p className="text-xs text-paper-muted">{t("notes.hint")}</p>
              {notes.length === 0 ? (
                <p className="mt-3 text-sm text-paper-muted" data-testid="notes-empty">
                  {t("notes.empty")}
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {notes.map((n, index) => (
                    <li
                      key={n.id}
                      className="notes-card-enter rounded-xl border border-paper-line bg-paper/80 px-3 py-2 text-sm"
                      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                      data-testid="notes-item"
                    >
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-paper-muted" data-testid="notes-item-meta">
                        {booksNoteMetaLine(n.reasonCode, n.type, formatTime(n.createdAt, locale))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
