import type { OutlineNode } from "@quantum/shared";
import { Button } from "@/components/ui/button";

export function OutlineConfirmCard({
  nodes,
  onConfirm,
  onRevise,
}: {
  nodes: OutlineNode[];
  onConfirm: () => void;
  onRevise: () => void;
}) {
  const leaves = flattenLeaves(nodes);

  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-paper-line bg-white/70">
      <header className="border-b border-paper-line px-5 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-cinnabar">OUTLINE</p>
        <h2 className="mt-1 font-serif text-xl">确认大纲</h2>
        <p className="mt-2 text-sm text-paper-muted">
          看每叶的 objective、先修与篇幅。确认后进入学习投影，不再另开计划页。
        </p>
      </header>
      {leaves.length === 0 ? (
        <p className="px-5 py-6 text-sm text-paper-muted">大纲还在起草。稍等，或在右侧会话催一句。</p>
      ) : (
        <ol className="space-y-2 px-5 py-4">
          {leaves.map((leaf, i) => (
            <li key={leaf.id} className="rounded-lg border border-paper-line px-3 py-2">
              <p className="text-sm font-medium">
                {i + 1}. {leaf.title}
              </p>
              <p className="mt-1 text-sm text-paper-ink/85">
                {leaf.objective || leaf.intent || "（无 objective）"}
              </p>
              <p className="mt-1 text-[11px] text-paper-muted">
                先修 {leaf.dependsOn.length ? leaf.dependsOn.join(" → ") : "无"} · 篇幅{" "}
                {leaf.targetChars > 0 ? `${leaf.targetChars} 字` : "未声明"}
              </p>
            </li>
          ))}
        </ol>
      )}
      <footer className="flex flex-wrap gap-2 border-t border-paper-line px-5 py-3">
        <Button type="button" disabled={leaves.length === 0} onClick={onConfirm}>
          确认大纲，开始学习
        </Button>
        <Button type="button" variant="outline" onClick={onRevise}>
          要改结构
        </Button>
      </footer>
    </section>
  );
}

function flattenLeaves(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      if (node.children.length === 0) out.push(node);
      else walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
