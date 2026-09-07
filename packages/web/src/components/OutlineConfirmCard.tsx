import type { OutlineNode, PrereqEdge } from "@quantum/shared";
import { PrereqEdgeList } from "@/components/PrereqEdgeList";
import { Button } from "@/components/ui/button";
import { evaluateOutlineLeafBudget } from "@/lib/outline-budget";
import { mergePrereqEdges, outlineTitleMap, resolveDependsOnTitles } from "@/lib/prereq-display";
import { useT } from "@/i18n";

export function OutlineConfirmCard({
  nodes,
  edges,
  chunkBudget,
  draftRejected,
  onConfirm,
  onRevise,
}: {
  nodes: OutlineNode[];
  edges?: PrereqEdge[];
  chunkBudget: string;
  draftRejected?: boolean;
  onConfirm: () => void;
  onRevise: () => void;
}) {
  const t = useT();
  const overBudgetCopy = t("outline.overBudget");
  const leaves = flattenLeaves(nodes);
  const titles = outlineTitleMap(nodes);
  const resolved = mergePrereqEdges(edges, nodes);
  const live = evaluateOutlineLeafBudget(nodes, chunkBudget);
  const overBudget = live.overBudget || (live.leafCount === 0 && Boolean(draftRejected));
  const budget = {
    ...live,
    overBudget,
    canConfirm: live.canConfirm && !overBudget,
  };

  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-paper-line bg-white/70">
      <header className="border-b border-paper-line px-5 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-cinnabar">OUTLINE</p>
        <h2 className="mt-1 font-serif text-xl">{t("outline.title")}</h2>
        <p className="mt-2 text-sm text-paper-muted">
          {t("outline.lead")}
        </p>
        {budget.overBudget ? (
          <p data-testid="outline-over-budget" className="mt-2 text-sm text-cinnabar">
            {overBudgetCopy}
          </p>
        ) : null}
      </header>
      {resolved.length > 0 ? (
        <div className="border-b border-paper-line px-5 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-pine">{t("outline.prereqOrder")}</p>
          <div className="mt-1.5">
            <PrereqEdgeList edges={resolved} />
          </div>
        </div>
      ) : null}
      {leaves.length === 0 ? (
        <p className="px-5 py-6 text-sm text-paper-muted">
          {budget.overBudget ? overBudgetCopy : t("outline.empty")}
        </p>
      ) : (
        <ol className="space-y-2 px-5 py-4">
          {leaves.map((leaf, i) => {
            const prereqTitles = resolveDependsOnTitles(leaf.dependsOn, titles);
            return (
              <li key={leaf.id} className="rounded-lg border border-paper-line px-3 py-2">
                <p className="text-sm font-medium">
                  {i + 1}. {leaf.title}
                </p>
                <p className="mt-1 text-sm text-paper-ink/85">
                  {leaf.objective || leaf.intent || t("outline.noObjective")}
                </p>
                <p className="mt-1 text-[11px] text-paper-muted">
                  {t("outline.prereqLine", {
                    titles: prereqTitles.length ? prereqTitles.join(" → ") : t("outline.prereqNone"),
                    length:
                      leaf.targetChars > 0
                        ? t("outline.lengthChars", { chars: leaf.targetChars })
                        : t("outline.lengthUnset"),
                  })}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <footer className="flex flex-wrap items-center gap-2 border-t border-paper-line px-5 py-3">
        <Button type="button" disabled={!budget.canConfirm} onClick={onConfirm}>
          {t("outline.confirm")}
        </Button>
        <Button type="button" variant="outline" onClick={onRevise}>
          {t("outline.revise")}
        </Button>
        {!budget.canConfirm ? (
          <p className="w-full text-[11px] text-cinnabar">
            {budget.overBudget ? overBudgetCopy : t("outline.notReady")}
          </p>
        ) : null}
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
