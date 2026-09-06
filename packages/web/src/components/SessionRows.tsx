import type { TutorStrategy } from "@quantum/shared";
import type { Citation, LiveSessionRow } from "@/lib/session-display";
import { strategyLabel, toolLabel } from "@/lib/session-display";
import { cn } from "@/lib/utils";

export function StrategyChip({
  strategy,
  lit,
}: {
  strategy: TutorStrategy;
  lit: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-wide",
        lit
          ? "border-cinnabar/35 bg-cinnabar/10 text-cinnabar"
          : "border-paper-line bg-paper-deep/80 text-paper-muted",
      )}
    >
      <span className="font-semibold">策略</span>
      <span>{strategy}</span>
      <span>· {strategyLabel(strategy)}</span>
    </div>
  );
}

export function CiteRow({ citations, source }: { citations: Citation[]; source?: string }) {
  return (
    <article className="rounded-lg border border-pine/20 bg-pine/5 px-3 py-2 text-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-pine">
        引用{source ? ` · ${toolLabel(source)}` : ""}
      </div>
      <ul className="mt-1.5 space-y-1">
        {citations.map((c, i) => (
          <li key={`${c.title}-${i}`} className="leading-relaxed text-paper-ink/90">
            {c.url ? (
              <a href={c.url} className="underline decoration-pine/40 underline-offset-2" target="_blank" rel="noreferrer">
                {c.title}
              </a>
            ) : (
              c.title
            )}
          </li>
        ))}
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
  return (
    <article className="rounded-lg border border-dashed border-paper-line bg-paper-deep/60 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2 text-[11px] tracking-wide text-paper-muted">
        <span>系统 · 工具 · {toolLabel(toolName)}</span>
        <span>
          {status === "running" ? "进行中" : status === "error" ? "失败" : "完成"}
        </span>
      </div>
      {summary ? (
        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-paper-ink/85">{summary}</p>
      ) : status === "running" ? (
        <p className="mt-1 text-paper-muted">正在调用…</p>
      ) : null}
    </article>
  );
}

export function NoteSystemRow({ summary }: { summary: string }) {
  return (
    <article className="rounded-lg border border-cinnabar/20 bg-cinnabar/5 px-3 py-2 text-sm">
      <div className="text-[11px] font-semibold tracking-wide text-cinnabar">
        系统 · append_note
      </div>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
        {summary || "已写入一条学习笔记。不会出现在用户气泡里。"}
      </p>
    </article>
  );
}
