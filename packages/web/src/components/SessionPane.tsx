import type { FormEvent } from "react";
import type { BoundarySnapshot, SessionMessage, TopicPhase } from "@quantum/shared";
import { isRefuseOffscopeSignal } from "@quantum/shared";
import { AcceptHint } from "@/components/AcceptHint";
import { InterviewGuide } from "@/components/InterviewGuide";
import { composerShouldLock } from "@/lib/interview-ui";
import { composerPlaceholderText, localizedRefuseCopy, useLocale, useT } from "@/i18n";
import { CiteRow, NoteSystemRow, RefuseRedirectRow, StrategyChip, ToolSystemRow } from "@/components/SessionRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  citationLabel,
  citationsFromTool,
  lastStrategy,
  looksLikeRefuseCopy,
  messageIsRefuse,
  visibleCitations,
  visibleLiveRows,
  type LiveSessionRow,
} from "@/lib/session-display";
import { formatTime } from "@/lib/utils";

export function SessionPane({
  messages,
  liveRows,
  streaming,
  busy,
  coachMode,
  error,
  onSend,
  phase,
  snapshot,
  askedKinds,
  currentKind,
  pendingBoundary,
  pendingOutline,
  overBudget,
  scopeIn,
  scopeOut,
  onCiteSection,
  canOpenCite,
  sectionTitles,
}: {
  messages: SessionMessage[];
  liveRows: LiveSessionRow[];
  streaming: string;
  busy: boolean;
  coachMode: "stub" | "live";
  error: string | null;
  onSend: (text: string) => void;
  phase: TopicPhase | "";
  snapshot: BoundarySnapshot;
  askedKinds: string[];
  currentKind?: string | null;
  pendingBoundary: boolean;
  pendingOutline: boolean;
  overBudget?: boolean;
  scopeIn?: string;
  scopeOut?: string;
  onCiteSection?: (sectionId: string) => void;
  canOpenCite?: (sectionId: string) => boolean;
  sectionTitles?: Map<string, string>;
}) {
  const t = useT();
  const locale = useLocale();
  const lockComposer = composerShouldLock({ busy, phase, currentKind });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text || lockComposer) return;
    form.reset();
    onSend(text);
  }

  const strategy = lastStrategy(messages, liveRows);
  const extras = visibleLiveRows(messages, liveRows);
  const hasTrace =
    messages.some((m) => m.role === "tool" || Boolean(m.strategy)) || extras.length > 0;
  const showGuide = phase === "boundary_interview" || pendingBoundary;
  const citeProps = { onOpenSection: onCiteSection, canOpenSection: canOpenCite };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-paper-line px-4 py-2">
        <p className="text-xs text-paper-muted">
          {coachMode === "stub" ? t("session.stub") : t("session.live")}
        </p>
        <StrategyChip strategy={strategy} lit={hasTrace && strategy !== "HOLD"} />
        <AcceptHint
          phase={phase}
          pendingBoundary={pendingBoundary}
          pendingOutline={pendingOutline}
          hasTopic={Boolean(phase)}
          overBudget={overBudget}
        />
        {showGuide ? (
          <InterviewGuide
            snapshot={snapshot}
            askedKinds={askedKinds}
            coachMode={coachMode}
            currentKind={currentKind}
          />
        ) : null}
        {pendingBoundary ? (
          <p className="text-xs text-cinnabar">{t("session.confirmBoundaryFirst")}</p>
        ) : null}
        {pendingOutline && overBudget ? (
          <p className="text-xs text-cinnabar">{t("session.overBudgetHint")}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !streaming && extras.length === 0 ? (
          <p className="text-sm text-paper-muted">
            {t("session.empty")}
          </p>
        ) : null}
        {messages.map((m) => {
          if (messageIsRefuse(m)) {
            const copy = localizedRefuseCopy(locale, {
              scopeIn,
              scopeOut,
              text: m.role === "assistant" ? m.text : undefined,
            });
            return (
              <RefuseRedirectRow key={m.id} refuse={copy.refuse} redirect={copy.redirect} />
            );
          }
          if (m.role === "tool") {
            return (
              <ToolBundle
                key={m.id}
                toolName={m.toolName}
                summary={m.text}
                status="done"
                strategy={m.strategy}
                citations={m.citations}
                citeProps={citeProps}
                sectionTitles={sectionTitles}
              />
            );
          }
          const cites = visibleCitations(
            m.citations?.map((c) => ({
              title: citationLabel(c, sectionTitles),
              section_id: c.section_id,
              note_id: c.note_id,
            })),
          );
          return (
            <article key={m.id} className="space-y-2 text-sm">
              <div className="mb-0.5 text-[11px] uppercase tracking-wide text-paper-muted">
                {m.role === "user" ? t("session.you") : t("session.guide")}
                {m.strategy ? ` · ${m.strategy}` : ""} · {formatTime(m.createdAt, locale)}
              </div>
              {m.role === "assistant" && m.strategy ? (
                <StrategyChip strategy={m.strategy} lit />
              ) : null}
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              {m.role === "assistant" ? (
                <CiteRow citations={cites} {...citeProps} />
              ) : null}
            </article>
          );
        })}
        {extras.map((row) => (
          <LiveBundle
            key={row.id}
            row={row}
            scopeIn={scopeIn}
            scopeOut={scopeOut}
            citeProps={citeProps}
            sectionTitles={sectionTitles}
          />
        ))}
        {streaming ? (
          <article className="text-sm">
            <div className="mb-0.5 text-[11px] text-paper-muted">{t("session.guide")}</div>
            <p className="whitespace-pre-wrap leading-relaxed">{streaming}</p>
          </article>
        ) : null}
        {error ? <p className="text-sm text-cinnabar">{error}</p> : null}
      </div>
      <form onSubmit={submit} className="border-t border-paper-line p-3">
        <Textarea
          name="text"
          rows={3}
          placeholder={composerPlaceholderText(
            {
              phase,
              currentKind,
              pendingBoundary,
              pendingOutline,
              overBudget,
            },
            t,
          )}
          disabled={lockComposer}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={lockComposer} size="sm">
            {lockComposer ? t("session.thinking") : t("session.send")}
          </Button>
        </div>
      </form>
    </div>
  );
}

type CiteProps = {
  onOpenSection?: (sectionId: string) => void;
  canOpenSection?: (sectionId: string) => boolean;
};

function ToolBundle({
  toolName,
  summary,
  status,
  strategy,
  citations,
  citeProps,
  sectionTitles,
}: {
  toolName?: string;
  summary: string;
  status: LiveSessionRow["status"];
  strategy?: SessionMessage["strategy"];
  citations?: SessionMessage["citations"];
  citeProps: CiteProps;
  sectionTitles?: Map<string, string>;
}) {
  const locale = useLocale();
  if (
    isRefuseOffscopeSignal({ strategy, text: summary, toolName }) ||
    looksLikeRefuseCopy(summary)
  ) {
    const copy = localizedRefuseCopy(locale, { text: summary });
    return <RefuseRedirectRow refuse={copy.refuse} redirect={copy.redirect} />;
  }
  const fromWire = visibleCitations(
    citations?.map((c) => ({
      title: citationLabel(c, sectionTitles),
      section_id: c.section_id,
      note_id: c.note_id,
    })),
  );
  const citeRows = fromWire.length ? fromWire : citationsFromTool(toolName ?? "", summary);
  return (
    <div className="space-y-2">
      {strategy ? <StrategyChip strategy={strategy} lit /> : null}
      {summary || status === "running" ? (
        <ToolSystemRow toolName={toolName} summary={summary} status={status} />
      ) : null}
      <CiteRow citations={citeRows} source={toolName} {...citeProps} />
      {toolName === "append_note" ? <NoteSystemRow summary={summary} /> : null}
    </div>
  );
}

function LiveBundle({
  row,
  scopeIn,
  scopeOut,
  citeProps,
  sectionTitles,
}: {
  row: LiveSessionRow;
  scopeIn?: string;
  scopeOut?: string;
  citeProps: CiteProps;
  sectionTitles?: Map<string, string>;
}) {
  const locale = useLocale();
  if (
    row.kind === "refuse" ||
    isRefuseOffscopeSignal({ strategy: row.strategy, text: row.summary }) ||
    looksLikeRefuseCopy(row.summary)
  ) {
    const copy = localizedRefuseCopy(locale, { scopeIn, scopeOut, text: row.summary });
    return <RefuseRedirectRow refuse={copy.refuse} redirect={copy.redirect} />;
  }
  if (row.kind === "cite") {
    return (
      <CiteRow
        citations={visibleCitations(row.citations)}
        source={row.toolName}
        {...citeProps}
      />
    );
  }
  if (row.kind === "note") {
    return <NoteSystemRow summary={row.summary} />;
  }
  if (!row.summary && row.strategy && row.status === "done") {
    return <StrategyChip strategy={row.strategy} lit />;
  }
  return (
    <ToolBundle
      toolName={row.toolName}
      summary={row.summary}
      status={row.status}
      strategy={row.strategy}
      citeProps={citeProps}
      sectionTitles={sectionTitles}
    />
  );
}
