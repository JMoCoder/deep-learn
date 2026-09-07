/** Default title written by POST /topics when the learner has not named it yet. */
export const DEFAULT_TOPIC_TITLE = "未命名主题";

export const TOPIC_ANCHOR_QUESTION =
  "想学哪个主题？一句话说清就行，比如「测量入门」或「我想把线性代数补起来」。说完再问动机和终点，不会只凭主题名和难度出大纲。";

export function isDefaultTopicTitle(title?: string | null): boolean {
  const trimmed = title?.trim() ?? "";
  return !trimmed || trimmed === DEFAULT_TOPIC_TITLE;
}

/** One open utterance → topic title. Not a form; do not treat as difficulty/outline. */
export function topicTitleFromUtterance(text: string): string {
  const trimmed = text.trim().replace(/[。.!！]+$/u, "").trim();
  const stripped = trimmed.replace(/^(我想要学|我想学|想学的是|想学|学一下|学的是|学)\s*/u, "").trim();
  return (stripped || trimmed).slice(0, 40);
}
