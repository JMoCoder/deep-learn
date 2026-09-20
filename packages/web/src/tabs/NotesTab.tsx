import type { NoteRecord, TopicSummary } from "@quantum/shared";
import { booksNoteMetaLine } from "@/lib/session-display";
import { useLocale, useT } from "@/i18n";
import { formatTime } from "@/lib/utils";

export function NotesTab({
  topic,
  notes,
}: {
  topic: TopicSummary | null;
  notes: NoteRecord[];
}) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 notes-atmosphere" aria-hidden />
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden" data-testid="notes-stage">
        <div
          data-testid="notes-content-surface"
          className="quantum-scroll h-full min-h-0 overflow-y-auto bg-paper-deep/50 px-5 py-6"
        >
          {!topic ? (
            <p className="mx-auto max-w-md py-10 text-center text-sm text-paper-muted">
              {t("notes.needBook")}
            </p>
          ) : (
            <div data-testid="notes-pane" className="mx-auto w-full max-w-2xl">
              <h1 className="font-serif text-xl tracking-tight">
                {t("notes.titleWithBook", { title: topic.title })}
              </h1>
              <p className="mt-2 text-xs text-paper-muted">{t("notes.hint")}</p>
              {notes.length === 0 ? (
                <p className="mt-4 text-sm text-paper-muted" data-testid="notes-empty">
                  {t("notes.empty")}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
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
