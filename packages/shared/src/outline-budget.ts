import type { OutlineNode } from "./dto.js";

/**
 * Single leaf-budget API. Hard cap — over budget must replan/cut leaves.
 * Do not raise the cap or soft-pass.
 */

export function parseChunkBudgetMinutes(chunk: string): number {
  const hour = chunk.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hour) return Math.round(Number(hour[1]) * 60);
  const minutes = chunk.match(/(\d+)\s*分钟/);
  if (minutes) return Number(minutes[1]);
  const bare = chunk.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Math.round(Number(bare[1]) * 60);
  if (/每天|每日/.test(chunk)) return 5 * 40;
  if (/周末/.test(chunk)) return 120;
  return 90;
}

export function leafBudget(weeklyMinutes: number, weeks = 4): number {
  const sittings = Math.max(4, Math.round((weeklyMinutes * weeks) / 35));
  return Math.min(12, Math.max(6, sittings));
}

export const OVER_BUDGET_COPY = "超负荷预算，请重拟";

export function countOutlineLeaves(nodes: OutlineNode[]): number {
  let n = 0;
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      if (node.children.length === 0) n += 1;
      else walk(node.children);
    }
  };
  walk(nodes);
  return n;
}

export type OutlineLeafBudget = {
  leafCount: number;
  leafCap: number;
  overBudget: boolean;
  canConfirm: boolean;
};

export function evaluateOutlineLeafBudget(
  nodes: OutlineNode[],
  chunkBudget: string,
): OutlineLeafBudget {
  const leafCount = countOutlineLeaves(nodes);
  const leafCap = leafBudget(parseChunkBudgetMinutes(chunkBudget));
  const overBudget = leafCount > leafCap;
  return {
    leafCount,
    leafCap,
    overBudget,
    canConfirm: leafCount > 0 && !overBudget,
  };
}

export function draftToolLooksOverBudget(input: {
  toolName?: string;
  ok?: boolean;
  summary?: string;
}): boolean {
  if (input.toolName !== "draft_outline") return false;
  if (input.ok) return false;
  const summary = input.summary ?? "";
  return /叶子|chunk_budget|上限|超负荷/.test(summary);
}

export function looksLikeLeafRedraft(text: string): boolean {
  return /减叶|重拟|砍叶|减到|少几叶|收一叶/.test(text.trim());
}

export function shouldBlockOverBudgetConfirm(input: {
  text: string;
  overBudget: boolean;
  pendingOutline: boolean;
  isConfirm: boolean;
}): boolean {
  if (!input.pendingOutline || !input.overBudget) return false;
  if (looksLikeLeafRedraft(input.text)) return false;
  return input.isConfirm;
}

/**
 * Red-4: outline confirm / leaf-reduce are web-card gates + @quantum/shared.
 * Chat「可以 / 减叶」must not be a parallel allow path.
 */
export function shouldDeferOutlineActionToCard(input: {
  text: string;
  pendingOutline: boolean;
}): boolean {
  if (!input.pendingOutline) return false;
  return looksLikeOutlineConfirm(input.text) || looksLikeLeafRedraft(input.text);
}

export function outlineComposerPlaceholder(overBudget: boolean): string {
  return overBudget
    ? "超负荷预算，请在学习页大纲卡点重拟，不要在会话里回「可以」或「减叶」"
    : "请在学习页大纲卡确认或重拟，不要在会话里回「可以」或「减叶」";
}

export function outlineSessionHint(overBudget: boolean): string | null {
  return overBudget
    ? `${OVER_BUDGET_COPY}。请在学习页大纲卡点重拟，不要在会话里回「可以」或「减叶」。`
    : null;
}
