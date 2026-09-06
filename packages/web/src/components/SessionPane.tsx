import type { FormEvent } from "react";
import type { SessionMessage } from "@quantum/shared";
import { CiteRow, NoteSystemRow, StrategyChip, ToolSystemRow } from "@/components/SessionRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  citationsFromTool,
  isCiteTool,
  lastStrategy,
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
}: {
  messages: SessionMessage[];
  liveRows: LiveSessionRow[];
  streaming: string;
  busy: boolean;
  coachMode: "stub" | "live";
  error: string | null;
  onSend: (text: string) => void;
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
  const hasTrace = messages.some((m) => m.role === "tool") || extras.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-paper-line px-4 py-2">
        <p className="text-xs text-paper-muted">
          {coachMode === "stub"
            ? "本地引导模式：未配置模型代理。工具循环可用，正文是脚手架。"
            : "已连接模型代理。密钥不会出现在对话或工具参数里。"}
        </p>
        <StrategyChip strategy={strategy} lit={hasTrace && strategy !== "HOLD"} />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !streaming && extras.length === 0 ? (
          <p className="text-sm text-paper-muted">
            从书籍页新建主题后，向导会从这里开始访谈。策略、引用和工具会出现在系统行，不会当成你的笔记。
          </p>
        ) : null}
        {messages.map((m) =>
          m.role === "tool" ? (
            <ToolBundle key={m.id} toolName={m.toolName} summary={m.text} status="done" />
          ) : (
            <article key={m.id} className="text-sm">
              <div className="mb-0.5 text-[11px] uppercase tracking-wide text-paper-muted">
                {m.role === "user" ? "你" : "向导"} · {formatTime(m.createdAt)}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            </article>
          ),
        )}
        {extras.map((row) => (
          <LiveBundle key={row.id} row={row} />
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
        <Textarea name="text" rows={3} placeholder="直接回答，或说卡住了哪里" disabled={busy} />
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
}: {
  toolName?: string;
  summary: string;
  status: LiveSessionRow["status"];
}) {
  if (toolName === "append_note") {
    return (
      <div className="space-y-2">
        <ToolSystemRow toolName={toolName} summary={summary} status={status} />
        <NoteSystemRow summary={summary} />
      </div>
    );
  }
  if (isCiteTool(toolName)) {
    return (
      <div className="space-y-2">
        <ToolSystemRow toolName={toolName} summary={summary} status={status} />
        <CiteRow citations={citationsFromTool(toolName ?? "", summary)} source={toolName} />
      </div>
    );
  }
  return <ToolSystemRow toolName={toolName} summary={summary} status={status} />;
}

function LiveBundle({ row }: { row: LiveSessionRow }) {
  if (row.kind === "cite") {
    return <CiteRow citations={row.citations ?? citationsFromTool(row.toolName ?? "", row.summary)} source={row.toolName} />;
  }
  if (row.kind === "note") {
    return <NoteSystemRow summary={row.summary} />;
  }
  return <ToolBundle toolName={row.toolName} summary={row.summary} status={row.status} />;
}
