import type { TopicPhase } from "@quantum/shared";

export function AcceptHint({
  phase,
  pendingBoundary,
  pendingOutline,
  hasTopic,
}: {
  phase: TopicPhase | "";
  pendingBoundary: boolean;
  pendingOutline: boolean;
  hasTopic: boolean;
}) {
  const step = hintFor({ phase, pendingBoundary, pendingOutline, hasTopic });
  return (
    <aside
      data-testid="accept-hint"
      className="rounded-lg border border-dashed border-paper-line bg-paper-deep/40 px-3 py-2 text-[11px] leading-relaxed text-paper-muted"
    >
      <p className="font-semibold tracking-wide text-paper-ink/70">银时手点 · {step.label}</p>
      <p className="mt-1">{step.body}</p>
    </aside>
  );
}

function hintFor(input: {
  phase: TopicPhase | "";
  pendingBoundary: boolean;
  pendingOutline: boolean;
  hasTopic: boolean;
}): { label: string; body: string } {
  if (!input.hasTopic) {
    return {
      label: "① 新建",
      body: "书籍 → 右侧抽屉 → 新建主题。不要走表单页。",
    };
  }
  if (input.phase === "boundary_interview" || input.pendingBoundary) {
    return {
      label: "① 边界",
      body: "答齐 8 维后等边界卡；点「确认边界，看大纲」。未确认时不要回「可以」。",
    };
  }
  if (input.pendingOutline) {
    return {
      label: "② 大纲",
      body: "核对每叶 objective、先修「A → B」、篇幅，再确认进入学习。",
    };
  }
  if (input.phase === "learning") {
    return {
      label: "③–⑤ + 抽测",
      body: "右栏追问应见策略行（SCAFFOLD/ADVANCE/GROUND）与 CiteRow；说「下一节」推进；踩排除词（如弦论）应 REFUSE_OFFSCOPE 且不记笔记。书籍导出 html。",
    };
  }
  return {
    label: "引导",
    body: "从书籍右侧新建主题开始五步联调。",
  };
}
