import type { OutlineNode, PrereqEdge } from "@quantum/shared";

export function flattenOutlineNodes(nodes: OutlineNode[]): OutlineNode[] {
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

export function outlineTitleMap(nodes: OutlineNode[]): Map<string, string> {
  return new Map(flattenOutlineNodes(nodes).map((n) => [n.id, n.title]));
}

/** Derive readable edges from `outline[].dependsOn` when projection omitted them. */
export function edgesFromOutline(nodes: OutlineNode[]): PrereqEdge[] {
  const titles = outlineTitleMap(nodes);
  const edges: PrereqEdge[] = [];
  for (const node of flattenOutlineNodes(nodes)) {
    for (const dep of node.dependsOn ?? []) {
      if (!dep) continue;
      edges.push({
        from_id: dep,
        to_id: node.id,
        from_title: titles.get(dep) ?? dep,
        to_title: node.title,
      });
    }
  }
  return edges;
}

export function mergePrereqEdges(api: PrereqEdge[] | undefined, nodes: OutlineNode[]): PrereqEdge[] {
  if (api && api.length > 0) return api;
  return edgesFromOutline(nodes);
}

export function resolveDependsOnTitles(dependsOn: string[], titles: Map<string, string>): string[] {
  return dependsOn.map((id) => titles.get(id) ?? id).filter(Boolean);
}

export function prereqsPointingAt(nodeId: string, edges: PrereqEdge[]): PrereqEdge[] {
  return edges.filter((e) => e.to_id === nodeId);
}

export function findOutlineNode(nodes: OutlineNode[], id: string | null): OutlineNode | undefined {
  if (!id) return undefined;
  return flattenOutlineNodes(nodes).find((n) => n.id === id);
}

export function sectionHasProjectedBody(
  sectionId: string,
  section: { id: string; outlineNodeId: string; bodyMd: string } | null,
  nodes: OutlineNode[],
): boolean {
  if (
    section &&
    (section.id === sectionId || section.outlineNodeId === sectionId) &&
    section.bodyMd.trim()
  ) {
    return true;
  }
  const node = findOutlineNode(nodes, sectionId);
  return node?.status === "ready";
}
