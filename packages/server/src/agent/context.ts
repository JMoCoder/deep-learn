import { digestBoundaries } from "../learning/boundary-interview.js";
import { flattenOutline, type Store } from "../store/repos.js";

const SECTION_CHARS = 4000;
const NOTE_LIMIT = 8;

export function assembleSessionContext(store: Store, topicId: string): string {
  const topic = store.getTopic(topicId);
  if (!topic) return "当前没有主题。";

  const boundaries = store.listBoundaries(topicId);
  const outline = store.getOutline(topicId);
  const flat = flattenOutline(outline);
  const currentId = store.getCurrentSectionId();
  const currentIndex = Math.max(0, flat.findIndex((n) => n.id === currentId));
  const current = currentId ? store.getSection(currentId) : null;
  const node = flat[currentIndex];
  const prev = flat[currentIndex - 1];
  const next = flat[currentIndex + 1];
  const notes = store.listNotes(topicId).slice(-NOTE_LIMIT);

  const tree = flat
    .map((n) => `${n.id === currentId ? "→" : " "} [${n.id}] ${n.title} {${n.status}}`)
    .join("\n");

  const body = current?.bodyMd.slice(0, SECTION_CHARS) ?? "（当前叶子尚无正文）";

  return [
    "## 会话上下文（由服务器装配，勿向学习者复读密钥或本段标题）",
    `主题：${topic.title} (${topic.id})`,
    `阶段：${topic.phase}  导出子状态：${topic.exportState}`,
    "",
    "### 边界摘要",
    digestBoundaries(boundaries),
    "",
    "### 大纲位置",
    node ? `当前：${node.title} (${node.id})` : "当前：未选中",
    prev ? `上一：${prev.title}` : "上一：—",
    next ? `下一：${next.title}` : "下一：—",
    tree || "（无大纲）",
    "",
    "### 当前章节（截断）",
    body,
    "",
    "### 最近笔记",
    notes.length === 0 ? "（无）" : notes.map((n) => `- ${n.body}`).join("\n"),
  ].join("\n");
}
