import type { BoundarySnapshot, OutlineDraftNode } from "@quantum/shared";
import { leafBudget } from "./outline-from-boundaries.js";

export type OutlineConstraintResult = {
  ok: boolean;
  errors: string[];
  leafCount: number;
  leafCap: number;
};

/**
 * draft_outline constraints: orientation first, prereq topology,
 * chunk_budget width, scope_out exclusion.
 */
export function evaluateOutlineDraft(
  nodes: OutlineDraftNode[],
  snapshot: BoundarySnapshot,
): OutlineConstraintResult {
  const errors: string[] = [];
  if (nodes.length === 0) errors.push("大纲不能为空");

  const first = nodes[0]?.title ?? "";
  if (first && !/定向|地图|orient|map/i.test(first)) {
    errors.push("第一节点必须是定向/地图（orientation first）");
  }

  const leaves = collectLeaves(nodes);
  const minutes = parseChunkBudgetMinutes(snapshot.chunk_budget);
  const leafCap = leafBudget(minutes);
  if (leaves.length > leafCap) {
    errors.push(`叶子 ${leaves.length} 超过 chunk_budget 上限 ${leafCap}`);
  }

  const banned = scopeOutTerms(snapshot.scope_out);
  for (const leaf of leaves) {
    const blob = `${leaf.title} ${leaf.intent} ${leaf.objective ?? ""}`;
    for (const term of banned) {
      if (term && blob.includes(term)) {
        errors.push(`叶子「${leaf.title}」落入 scope_out「${term}」`);
      }
    }
  }

  const titles = new Set<string>();
  walk(nodes, (node, earlier) => {
    if (titles.has(node.title)) errors.push(`重复标题「${node.title}」`);
    titles.add(node.title);
    for (const dep of node.depends_on ?? []) {
      if (!earlier.has(dep) && !titles.has(dep)) {
        errors.push(`「${node.title}」的 depends_on「${dep}」不在先修拓扑之前`);
      }
    }
  });

  return { ok: errors.length === 0, errors, leafCount: leaves.length, leafCap };
}

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

export function scopeOutTerms(scopeOut: string): string[] {
  if (!scopeOut.trim() || /^(没有|无|none|n\/a)$/i.test(scopeOut.trim())) return [];
  return scopeOut
    .split(/[,，、;；\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(没有|无|none)$/i.test(s));
}

function collectLeaves(nodes: OutlineDraftNode[]): OutlineDraftNode[] {
  const out: OutlineDraftNode[] = [];
  const walkNodes = (list: OutlineDraftNode[]) => {
    for (const node of list) {
      if (!node.children?.length) out.push(node);
      else walkNodes(node.children);
    }
  };
  walkNodes(nodes);
  return out;
}

function walk(
  nodes: OutlineDraftNode[],
  visit: (node: OutlineDraftNode, earlierTitles: Set<string>) => void,
  earlier = new Set<string>(),
): void {
  for (const node of nodes) {
    visit(node, earlier);
    earlier.add(node.title);
    if (node.children) walk(node.children, visit, earlier);
  }
}
