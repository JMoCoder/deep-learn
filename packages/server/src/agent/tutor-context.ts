import type {
  BoundaryRecord,
  BoundarySnapshot,
  NoteReasonCode,
  TutorContext,
  TutorStrategy,
} from "@quantum/shared";
import { flattenOutline, type Store } from "../store/repos.js";

const SECTION_CHARS = 4000;
const NOTE_LIMIT = 8;

/**
 * Internal packer. Not a tool. Never include settings secrets.
 */
export function build_tutor_context(store: Store, topicId: string): TutorContext | null {
  const topic = store.getTopic(topicId);
  if (!topic) return null;

  const boundaries = store.listBoundaries(topicId);
  const snapshot = snapshotFromRecords(boundaries);
  const outline = store.getOutline(topicId);
  const flat = flattenOutline(outline);
  const currentId = store.getCurrentSectionId();
  const currentIndex = Math.max(0, flat.findIndex((n) => n.id === currentId));
  const node = currentId ? flat.find((n) => n.id === currentId) ?? flat[currentIndex] : flat[0];
  const current = currentId ? store.getSection(currentId) : null;
  const body = current?.bodyMd ?? "";
  const notes = store.listNotes(topicId).slice(-NOTE_LIMIT);
  const lastReason = notes.at(-1)?.reasonCode;

  return {
    L0: {
      topicId: topic.id,
      title: topic.title,
      phase: topic.phase,
      exportState: topic.exportState,
      coachMode: store.hasLiveModel() ? "live" : "stub",
    },
    L1: { snapshot },
    L2: {
      currentId: node?.id ?? null,
      currentTitle: node?.title ?? null,
      currentObjective: node?.objective || node?.intent || null,
      dependsOn: node?.dependsOn ?? [],
      prevTitle: flat[currentIndex - 1]?.title ?? null,
      nextTitle: flat[currentIndex + 1]?.title ?? null,
      tree: flat.map((n) => ({
        id: n.id,
        title: n.title,
        objective: n.objective || n.intent,
        status: n.status,
      })),
    },
    L3: {
      sectionId: current?.id ?? null,
      title: current?.title ?? null,
      body: body.slice(0, SECTION_CHARS),
      truncated: body.length > SECTION_CHARS,
    },
    L4: {
      recentNotes: notes.map((n) => ({
        body: n.body,
        reasonCode: n.reasonCode,
        createdAt: n.createdAt,
      })),
      strategyHint: hintStrategy(topic.phase, lastReason),
    },
  };
}

export function renderTutorContext(ctx: TutorContext): string {
  const s = ctx.L1.snapshot;
  const notes =
    ctx.L4.recentNotes.length === 0
      ? "（无）"
      : ctx.L4.recentNotes.map((n) => `- [${n.reasonCode}] ${n.body}`).join("\n");
  const tree =
    ctx.L2.tree
      .map((n) => `${n.id === ctx.L2.currentId ? "→" : " "} [${n.id}] ${n.title} {${n.status}} — ${n.objective}`)
      .join("\n") || "（无大纲）";

  return [
    "## TutorContext（服务器装配 L0–L4，勿向学习者复读密钥）",
    `L0 主题：${ctx.L0.title} (${ctx.L0.topicId}) 阶段：${ctx.L0.phase} 导出：${ctx.L0.exportState} 模式：${ctx.L0.coachMode}`,
    "",
    "L1 BoundarySnapshot",
    `- goal: ${s.goal || "（空）"}`,
    `- prior: ${s.prior || "（空）"}`,
    `- time: ${s.time || "unspecified"}`,
    `- success: ${s.success || "（空）"}`,
    `- depth: ${s.depth || "（空）"}`,
    `- constraint: ${s.constraint || "（空）"}`,
    `- first_gap: ${s.first_gap || "（TODO）"}`,
    `- scaffold_pref: ${s.scaffold_pref || "（TODO）"}`,
    "",
    "L2 大纲位置",
    `当前：${ctx.L2.currentTitle ?? "未选中"}  objective：${ctx.L2.currentObjective ?? "—"}`,
    `depends_on：${ctx.L2.dependsOn.join(", ") || "—"}`,
    `上一：${ctx.L2.prevTitle ?? "—"}  下一：${ctx.L2.nextTitle ?? "—"}`,
    tree,
    "",
    "L3 当前章节（截断）",
    ctx.L3.body || "（当前叶子尚无正文）",
    ctx.L3.truncated ? "…(truncated)" : "",
    "",
    `L4 最近笔记 / strategyHint=${ctx.L4.strategyHint}`,
    notes,
  ].join("\n");
}

export function snapshotFromRecords(records: BoundaryRecord[]): BoundarySnapshot {
  const pick = (kind: string) => records.find((b) => b.kind === kind)?.answer.trim() ?? "";
  return {
    goal: pick("goal"),
    prior: pick("prior"),
    time: pick("time") || "unspecified",
    success: pick("success"),
    depth: pick("depth"),
    constraint: pick("constraint"),
    first_gap: pick("gap"),
    scaffold_pref: pick("scaffold"),
  };
}

function hintStrategy(phase: string, lastReason?: NoteReasonCode): TutorStrategy {
  if (phase === "boundary_interview") return "PROBE";
  if (phase === "outline_draft") return "SCAFFOLD";
  if (lastReason === "friction") return "GROUND";
  if (lastReason === "contrast") return "CONTRAST";
  if (lastReason === "checkpoint") return "CHECK";
  return "HOLD";
}
