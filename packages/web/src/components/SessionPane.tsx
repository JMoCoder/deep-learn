import type { FormEvent } from "react";
import type { SessionMessage } from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/utils";

export function SessionPane({
  messages,
  streaming,
  busy,
  coachMode,
  error,
  onSend,
}: {
  messages: SessionMessage[];
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="border-b border-paper-line px-4 py-2 text-xs text-paper-muted">
        {coachMode === "stub"
          ? "本地引导模式：未配置模型代理。工具循环可用，正文是脚手架。"
          : "已连接模型代理。密钥不会出现在对话或工具参数里。"}
      </p>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !streaming ? (
          <p className="text-sm text-paper-muted">从书籍页新建主题后，向导会从这里开始访谈。</p>
        ) : null}
        {messages.map((m) => (
          <article key={m.id} className="text-sm">
            <div className="mb-0.5 text-[11px] uppercase tracking-wide text-paper-muted">
              {m.role === "user" ? "你" : m.role === "tool" ? `工具 · ${m.toolName}` : "向导"} ·{" "}
              {formatTime(m.createdAt)}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
          </article>
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
