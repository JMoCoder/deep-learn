import type { TutorContext, TutorStrategy } from "@quantum/shared";
import { flattenOutline, type Store } from "../store/repos.js";
import { snapshotFromRecords } from "../learning/boundary-snapshot.js";

const SECTION_CHARS = 2400;

export type TutorPackOptions = {
  /** Default false: L4 deferred (no note dump / no vector retrieval). */
  includeL4?: boolean;
};

/**
 * Internal packer. Not a tool. Never include settings secrets,
 * other topics, or the whole session transcript.
 */
export function build_tutor_context(
  store: Store,
  topicId: string,
  options: TutorPackOptions = {},
): TutorContext | null {
  const topic = store.getTopic(topicId);
  if (!topic) return null;

  const boundaries = store.listBoundaries(topicId);
  const snapshot = snapshotFromRecords(boundaries);
  const outline = store.getOutline(topicId);
  const flat = flattenOutline(outline);
  const currentId = store.getCurrentSectionId();
  const current =
    (currentId ? store.getSection(currentId) : null) ??
    (currentId ? store.getSectionByOutline(currentId) : null);
  const node =
    (current ? flat.find((n) => n.id === current.outlineNodeId) : undefined) ??
    (currentId ? flat.find((n) => n.id === currentId) : undefined) ??
    flat[0];
  const currentIndex = Math.max(0, node ? flat.findIndex((n) => n.id === node.id) : 0);
  const body = current?.bodyMd ?? "";
  const excerpt = body.slice(0, SECTION_CHARS);
  const truncated = body.length > SECTION_CHARS;
  const compactTree = flat.slice(0, 16).map((n) => ({
    id: n.id,
    title: n.title,
    objective: n.objective || n.intent,
    status: n.status,
  }));

  const ctx: TutorContext = {
    L0: {
      topicId: topic.id,
      title: topic.title,
      phase: topic.phase,
      exportState: topic.exportState,
      coachMode: store.hasLiveModel() ? "live" : "stub",
      strategyHint: hintStrategy(topic.phase, Boolean(current?.bodyMd.trim())),
    },
    L1: {
      snapshot,
      body: excerpt,
      sectionId: current?.id ?? null,
      title: current?.title ?? node?.title ?? null,
      truncated,
    },
    L2: {
      currentId: node?.id ?? null,
      currentTitle: node?.title ?? null,
      currentObjective: node?.objective || node?.intent || null,
      dependsOn: node?.dependsOn ?? [],
      prevTitle: flat[currentIndex - 1]?.title ?? null,
      nextTitle: flat[currentIndex + 1]?.title ?? null,
      tree: compactTree,
    },
    L3: {
      sectionId: current?.id ?? null,
      title: current?.title ?? null,
      body: excerpt,
      truncated,
    },
  };

  if (options.includeL4) {
    ctx.L4 = {
      recentNotes: store.listNotes(topicId).slice(-4).map((n) => ({
        body: n.body,
        reasonCode: n.reasonCode,
        type: n.type,
        createdAt: n.createdAt,
      })),
    };
  }

  return ctx;
}

export function renderTutorContext(ctx: TutorContext): string {
  const s = ctx.L1.snapshot;
  const tree =
    ctx.L2.tree
      .map((n) => `${n.id === ctx.L2.currentId ? "→" : " "} ${n.title} {${n.status}} — ${n.objective}`)
      .join("\n") || "（无大纲）";

  const lines = [
    "## TutorContext（服务器装配 L0–L3；L4 后置。勿复读密钥或整本 Session）",
    `L0 主题：${ctx.L0.title} (${ctx.L0.topicId}) 阶段：${ctx.L0.phase} 导出：${ctx.L0.exportState} 模式：${ctx.L0.coachMode} 策略提示：${ctx.L0.strategyHint}`,
    "",
    "L1 读盘正文 + BoundarySnapshot",
    ctx.L1.body
      ? `节「${ctx.L1.title ?? "未命名"}」摘录：\n${ctx.L1.body}`
      : "（当前叶子尚无正文）",
    ctx.L1.truncated ? "…(truncated)" : "",
    `- goal_outcome: ${s.goal_outcome || "（空）"}`,
    `- prior_level: ${s.prior_level || "（空）"}`,
    `- scope_out: ${s.scope_out || "（空）"}`,
    `- depth: ${s.depth || "（空）"}`,
    `- chunk_budget: ${s.chunk_budget || "（空）"}`,
    `- motivation: ${s.motivation || "（空）"}`,
    `- success_evidence: ${s.success_evidence || s.success || "（空）"}`,
    `- prior_known: ${s.prior_known || "（空）"}`,
    `- prior_gaps: ${s.prior_gaps || s.first_gap || "（空）"}`,
    `- scope_in: ${s.scope_in || "（空）"}`,
    "",
    "L2 大纲位置（压缩树，不是全书）",
    `当前：${ctx.L2.currentTitle ?? "未选中"}  objective：${ctx.L2.currentObjective ?? "—"}`,
    `depends_on：${ctx.L2.dependsOn.join(", ") || "—"}`,
    `上一：${ctx.L2.prevTitle ?? "—"}  下一：${ctx.L2.nextTitle ?? "—"}`,
    tree,
    "",
    "L3 当前章节（截断）",
    ctx.L3.body || "（当前叶子尚无正文）",
    ctx.L3.truncated ? "…(truncated)" : "",
  ];

  if (ctx.L4) {
    lines.push("", "L4（后置，仅显式请求）");
    lines.push(
      ctx.L4.recentNotes.length === 0
        ? "（无）"
        : ctx.L4.recentNotes.map((n) => `- [${n.type}/${n.reasonCode}] ${n.body}`).join("\n"),
    );
  }

  return lines.join("\n");
}

function hintStrategy(phase: string, hasSection: boolean): TutorStrategy {
  if (phase === "boundary_interview") return "PROBE";
  if (phase === "outline_draft") return "SCAFFOLD";
  if (phase === "learning") return hasSection ? "GROUND" : "SCAFFOLD";
  return "HOLD";
}
