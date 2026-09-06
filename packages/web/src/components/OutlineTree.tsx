import type { OutlineNode, PrereqEdge } from "@quantum/shared";
import { PrereqEdgeList } from "@/components/PrereqEdgeList";
import { mergePrereqEdges, outlineTitleMap, resolveDependsOnTitles } from "@/lib/prereq-display";
import { cn } from "@/lib/utils";

export function OutlineTree({
  nodes,
  currentId,
  edges,
  onSelect,
}: {
  nodes: OutlineNode[];
  currentId: string | null;
  edges?: PrereqEdge[];
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return <p className="px-4 py-6 text-sm text-paper-muted">还没有大纲。右侧会话会先问边界再起草。</p>;
  }
  const resolved = mergePrereqEdges(edges, nodes);
  const titles = outlineTitleMap(nodes);
  return (
    <div>
      {resolved.length > 0 ? (
        <div className="border-b border-paper-line px-3 py-2">
          <p className="text-[11px] font-semibold tracking-wide text-pine">先修边</p>
          <div className="mt-1">
            <PrereqEdgeList edges={resolved} compact />
          </div>
        </div>
      ) : null}
      <ul className="space-y-1 px-3 py-3">
        {nodes.map((node) => (
          <OutlineItem
            key={node.id}
            node={node}
            currentId={currentId}
            titles={titles}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function OutlineItem({
  node,
  currentId,
  titles,
  onSelect,
}: {
  node: OutlineNode;
  currentId: string | null;
  titles: Map<string, string>;
  onSelect: (id: string) => void;
}) {
  const prereqTitles = resolveDependsOnTitles(node.dependsOn, titles);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "w-full rounded-md px-2 py-1.5 text-left text-sm",
          currentId === node.id ? "bg-paper-deep text-cinnabar" : "hover:bg-paper-deep",
        )}
      >
        <span className="block font-medium">{node.title}</span>
        {node.objective || node.intent ? (
          <span className="block text-xs text-paper-muted">{node.objective || node.intent}</span>
        ) : null}
        {prereqTitles.length ? (
          <span className="mt-0.5 block text-[11px] text-pine">先修 ← {prereqTitles.join("、")}</span>
        ) : null}
      </button>
      {node.children.length > 0 ? (
        <div className="ml-3 border-l border-paper-line">
          <ul className="space-y-1 py-1">
            {node.children.map((child) => (
              <OutlineItem
                key={child.id}
                node={child}
                currentId={currentId}
                titles={titles}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
