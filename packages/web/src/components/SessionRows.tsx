import type { TutorStrategy } from "@quantum/shared";
import type { Citation, LiveSessionRow } from "@/lib/session-display";
import { strategyChipView } from "@/lib/session-display";
import { strategyText, toolText, useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function StrategyChip({
  strategy,
  lit,
  text,
}: {
  strategy: TutorStrategy;
  lit: boolean;
  text?: string;
}) {
  const t = useT();
  const view = strategyChipView(strategy, { text });
  return (
    <div
      data-testid="strategy-chip"
      data-strategy={view.strategy}
      data-strategy-code={view.code}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-wide",
        lit
          ? "border-cinnabar/35 bg-cinnabar/10 text-cinnabar"
          : "border-paper-line bg-paper-deep/80 text-paper-muted",
      )}
    >
      <span className="font-semibold">{t("chip.strategy")}</span>
      <span>{view.code}</span>
      <span>· {strategyText(view.strategy, t)}</span>
    </div>
  );
}

export function CiteRow({
  citations,
  source,
  onOpenSection,
  canOpenSection,
}: {
  citations: Citation[];
  source?: string;
  onOpenSection?: (sectionId: string) => void;
  canOpenSection?: (sectionId: string) => boolean;
}) {
  const t = useT();
  if (citations.length === 0) return null;
  return (
    <article className="rounded-lg border border-pine/20 bg-pine/5 px-3 py-2 text-sm" data-testid="cite-row">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-pine">
        {t("cite")}
        {source ? ` · ${toolText(source, t)}` : ""}
      </div>
      <ul className="mt-1.5 space-y-1">
        {citations.map((c, i) => {
          const open =
            Boolean(c.section_id) &&
            Boolean(onOpenSection) &&
            (canOpenSection?.(c.section_id!) ?? false);
          return (
            <li key={`${c.section_id ?? c.title}-${i}`} className="leading-relaxed text-paper-ink/90">
              {open ? (
                <button
                  type="button"
                  className="text-left underline decoration-pine/40 underline-offset-2"
                  onClick={() => onOpenSection?.(c.section_id!)}
                >
                  {c.title}
                </button>
              ) : c.url ? (
                <a
                  href={c.url}
                  className="underline decoration-pine/40 underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.title}
                </a>
              ) : (
                c.title
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function ToolSystemRow({
  toolName,
  summary,
  status,
}: {
  toolName?: string;
  summary: string;
  status: LiveSessionRow["status"];
}) {
  const t = useT();
  const statusLabel =
    status === "running" ? t("status.running") : status === "error" ? t("status.error") : t("status.done");
  return (
    <article className="rounded-lg border border-dashed border-paper-line bg-paper-deep/60 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2 text-[11px] tracking-wide text-paper-muted">
        <span>{t("system.tool", { tool: toolText(toolName, t) })}</span>
        <span>{statusLabel}</span>
      </div>
      {summary ? (
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-paper-ink/85">{summary}</p>
      ) : status === "running" ? (
        <p className="mt-1 text-paper-muted">{t("tool.calling")}</p>
      ) : null}
    </article>
  );
}

export function RefuseRedirectRow({
  refuse,
  redirect,
}: {
  refuse: string;
  redirect: string;
}) {
  const t = useT();
  return (
    <article className="rounded-lg border border-cinnabar/35 bg-cinnabar/8 px-3 py-2 text-sm">
      <div className="text-[11px] font-semibold tracking-wide text-cinnabar">{t("refuse.kicker")}</div>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{refuse}</p>
      <p className="mt-2 text-sm leading-relaxed text-pine">{redirect}</p>
      <p className="mt-2 text-[11px] text-paper-muted">{t("refuse.noNote")}</p>
    </article>
  );
}

export function NoteSystemRow({ summary }: { summary: string }) {
  const t = useT();
  return (
    <article className="rounded-lg border border-cinnabar/20 bg-cinnabar/5 px-3 py-2 text-sm">
      <div className="text-[11px] font-semibold tracking-wide text-cinnabar">
        {t("note.system")}
      </div>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
        {summary || t("note.fallback")}
      </p>
    </article>
  );
}
