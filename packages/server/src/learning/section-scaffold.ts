import type { BoundaryRecord, OutlineNode } from "@quantum/shared";

/**
 * Stub section bodies so the 学习 canvas is usable without a model key.
 * Clearly labeled as scaffold — not finished instructional design.
 */

export function scaffoldSectionBody(
  node: { title: string; intent: string },
  topicTitle: string,
  boundaries: BoundaryRecord[],
  siblings: OutlineNode[],
): string {
  const goal = boundaries.find((b) => b.kind === "goal")?.answer ?? "（未写目标）";
  const prior = boundaries.find((b) => b.kind === "prior")?.answer ?? "（未写先验）";
  const nearby = siblings
    .slice(0, 6)
    .map((s) => `- ${s.title}`)
    .join("\n");

  return `# ${node.title}

> 本地引导稿。配置「我的 → 模型代理」后，助手会按同一大纲重写这一节。这不是审定过的教学法。

**这一节为什么存在：** ${node.intent}

## 接到你的边界

- 主题：${topicTitle}
- 目标：${goal}
- 先验：${prior}

## 这一坐可以做什么

1. 用自己的话重述这一节意图（两句以内）。
2. 对照目标，标出「已经会 / 还不会」各一点。
3. 若卡住，在右侧会话里直接说卡在哪一步——助手只会通过 \`append_note\` 记下，不会要你自己点「记一笔」。

## 附近的章节

${nearby || "- （大纲很短）"}

## 开放问题

- 过关证据还要不要再收窄？（product research）
- 这一节是否应拆成更短的叶子？
`;
}
