import type { FormEvent } from "react";
import type { BoundarySnapshot, SessionMessage, TopicPhase } from "@quantum/shared";
import { isRefuseOffscopeSignal, refuseRedirectCopy } from "@quantum/shared";
import { InterviewGuide, composerPlaceholder } from "@/components/InterviewGuide";
import { CiteRow, NoteSystemRow, RefuseRedirectRow, StrategyChip, ToolSystemRow } from "@/components/SessionRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  citationLabel,
  citationsFromTool,
  isCiteTool,
  lastStrategy,
  messageIsRefuse,
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
  scopeIn,
  scopeOut,
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
  scopeIn?: string;
  scopeOut?: string;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    if (!text || busy) return;
    form.reset();
    onSend(text);
  }

  const strategy = lastStrategy(messages, liveRows);
  const extras = visibleLiveRows(messages, liveRows);
  const hasTrace =
    messages.some((m) => m.role === "tool" || Boolean(m.strategy)) || extras.length > 0;
  const showGuide = phase === "boundary_interview" || pendingBoundary;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-paper-line px-4 py-2">
        <p className="text-xs text-paper-muted">
          {coachMode === "stub"
            ? "本地引导模式：未配置模型代理。工具循环可用，正文是脚手架。"
            : "已连接模型代理。密钥不会出现在对话或工具参数里。"}
        </p>
        <StrategyChip strategy={strategy} lit={hasTrace && strategy !== "HOLD"} />
        {showGuide ? (
          <InterviewGuide
            snapshot={snapshot}
            askedKinds={askedKinds}
            coachMode={coachMode}
            currentKind={currentKind}
          />
        ) : null}
        {pendingBoundary ? (
          <p className="text-xs text-cinnabar">先确认学习页上的边界卡，再进大纲确认。</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !streaming && extras.length === 0 ? (
          <p className="text-sm text-paper-muted">
            从书籍页新建主题后，向导会从这里开始访谈。策略、引用和工具会出现在系统行，不会当成你的笔记。
          </p>
        ) : null}
        {messages.map((m) => {
          if (messageIsRefuse(m)) {
            const copy = refuseRedirectCopy({
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
              />
            );
          }
          return (
            <article key={m.id} className="space-y-2 text-sm">
              <div className="mb-0.5 text-[11px] uppercase tracking-wide text-paper-muted">
                {m.role === "user" ? "你" : "向导"}
                {m.strategy ? ` · ${m.strategy}` : ""} · {formatTime(m.createdAt)}
              </div>
              {m.role === "assistant" && m.strategy ? (
                <StrategyChip strategy={m.strategy} lit />
              ) : null}
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              {m.role === "assistant" && m.citations?.length ? (
                <CiteRow citations={m.citations.map((c) => ({ title: citationLabel(c) }))} />
              ) : null}
            </article>
          );
        })}
        {extras.map((row) => (
          <LiveBundle key={row.id} row={row} scopeIn={scopeIn} scopeOut={scopeOut} />
        ))}
        {streaming ? (
          <article className="text-sm">
            <div className="mb-0.5 text-[11px] text-paper-muted">向导</div>
            <p className="whitespace-pre-wrap leading-relaxed">{streaming}</p>
          </article>
        ) : null}
        {error ? <p className="text-sm text-cinnabar">{error}</p> : null}
      </div>
      <form onSubmit={submit} className="border-t border-paper-line p-3">
        <Textarea
          name="text"
          rows={3}
          placeholder={composerPlaceholder({
            phase,
            currentKind,
            pendingBoundary,
            pendingOutline,
          })}
          disabled={busy}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={busy} size="sm">
            {busy ? "在想…" : "发送"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ToolBundle({
  toolName,
  summary,
  status,
  strategy,
  citations,
}: {
  toolName?: string;
  summary: string;
  status: LiveSessionRow["status"];
  strategy?: SessionMessage["strategy"];
  citations?: SessionMessage["citations"];
}) {
  if (isRefuseOffscopeSignal({ strategy, text: summary, toolName })) {
    const copy = refuseRedirectCopy({ text: summary });
    return <RefuseRedirectRow refuse={copy.refuse} redirect={copy.redirect} />;
  }
  const citeRows = citations?.length
    ? citations.map((c) => ({ title: citationLabel(c) }))
    : isCiteTool(toolName)
      ? citationsFromTool(toolName ?? "", summary)
      : [];
  return (
    <div className="space-y-2">
      {strategy ? <StrategyChip strategy={strategy} lit /> : null}
      <ToolSystemRow toolName={toolName} summary={summary} status={status} />
      {citeRows.length ? <CiteRow citations={citeRows} source={toolName} /> : null}
      {toolName === "append_note" ? <NoteSystemRow summary={summary} /> : null}
    </div>
  );
}

function LiveBundle({
  row,
  scopeIn,
  scopeOut,
}: {
  row: LiveSessionRow;
  scopeIn?: string;
  scopeOut?: string;
}) {
  if (row.kind === "refuse" || isRefuseOffscopeSignal({ strategy: row.strategy, text: row.summary })) {
    const copy = refuseRedirectCopy({ scopeIn, scopeOut, text: row.summary });
    return <RefuseRedirectRow refuse={copy.refuse} redirect={copy.redirect} />;
  }
  if (row.kind === "cite") {
    return <CiteRow citations={row.citations ?? citationsFromTool(row.toolName ?? "", row.summary)} source={row.toolName} />;
  }
  if (row.kind === "note") {
    return <NoteSystemRow summary={row.summary} />;
  }
  return <ToolBundle toolName={row.toolName} summary={row.summary} status={row.status} />;
}

