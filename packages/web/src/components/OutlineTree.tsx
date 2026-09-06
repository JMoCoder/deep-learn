import type { OutlineNode } from "@quantum/shared";
import { cn } from "@/lib/utils";

export function OutlineTree({
  nodes,
  currentId,
  onSelect,
}: {
  nodes: OutlineNode[];
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return <p className="px-4 py-6 text-sm text-paper-muted">还没有大纲。右侧会话会先问边界再起草。</p>;
  }
  return (
    <ul className="space-y-1 px-3 py-3">
      {nodes.map((node) => (
        <li key={node.id}>
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
          </button>
          {node.children.length > 0 ? (
            <div className="ml-3 border-l border-paper-line">
              <OutlineTree nodes={node.children} currentId={currentId} onSelect={onSelect} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
