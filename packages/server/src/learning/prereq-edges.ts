import type { OutlineDraftNode, OutlineNode } from "@quantum/shared";

export type PrereqEdge = {
  from_id: string;
  to_id: string;
  from_title: string;
  to_title: string;
};

/** Leaves in document order (DFS). */
export function collectDraftLeaves(nodes: OutlineDraftNode[]): OutlineDraftNode[] {
  const out: OutlineDraftNode[] = [];
  const walk = (list: OutlineDraftNode[]) => {
    for (const node of list) {
      if (!node.children?.length) out.push(node);
      else walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function flattenDraft(nodes: OutlineDraftNode[]): OutlineDraftNode[] {
  const out: OutlineDraftNode[] = [];
  const walk = (list: OutlineDraftNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * If no leaf already declares a prereq, chain each later leaf onto the previous
 * leaf title. Constraint walk treats titles as earlier-in-order refs.
 */
export function ensureDraftPrereqEdges(nodes: OutlineDraftNode[]): OutlineDraftNode[] {
  const leaves = collectDraftLeaves(nodes);
  if (leaves.length < 2) return nodes;
  const already = leaves.some((leaf) => (leaf.depends_on ?? []).length > 0);
  if (already) return nodes;
  for (let i = 1; i < leaves.length; i += 1) {
    const prev = leaves[i - 1]!;
    leaves[i]!.depends_on = [prev.title];
  }
  return nodes;
}

export function collectPrereqEdges(nodes: OutlineNode[]): PrereqEdge[] {
  const byId = new Map<string, OutlineNode>();
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      byId.set(node.id, node);
      walk(node.children);
    }
  };
  walk(nodes);

  const edges: PrereqEdge[] = [];
  for (const node of byId.values()) {
    for (const dep of node.dependsOn) {
      const from = byId.get(dep);
      if (!from) continue;
      edges.push({
        from_id: from.id,
        to_id: node.id,
        from_title: from.title,
        to_title: node.title,
      });
    }
  }
  return edges;
}

/** Resolve title or id refs onto stored node ids (same walk order). */
export function resolveDependsOnIds(
  draft: OutlineDraftNode[],
  stored: OutlineNode[],
): Map<string, string[]> {
  const storedFlat = flattenStored(stored);
  const titleToId = new Map(storedFlat.map((n) => [n.title, n.id]));
  const idSet = new Set(storedFlat.map((n) => n.id));
  const draftFlat = flattenDraft(draft);
  const resolved = new Map<string, string[]>();

  draftFlat.forEach((node, index) => {
    const match = storedFlat.find((s) => s.title === node.title) ?? storedFlat[index];
    if (!match) return;
    const raw = node.depends_on ?? match.dependsOn ?? [];
    const ids = raw
      .map((ref) => (idSet.has(ref) ? ref : titleToId.get(ref)))
      .filter((id): id is string => Boolean(id) && id !== match.id);
    resolved.set(match.id, [...new Set(ids)]);
  });
  return resolved;
}

export function sequentialLeafDependsOn(nodes: OutlineNode[]): Map<string, string[]> {
  const leaves: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      if (node.children.length === 0) leaves.push(node);
      else walk(node.children);
    }
  };
  walk(nodes);
  const map = new Map<string, string[]>();
  for (let i = 1; i < leaves.length; i += 1) {
    map.set(leaves[i]!.id, [leaves[i - 1]!.id]);
  }
  return map;
}

function flattenStored(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
