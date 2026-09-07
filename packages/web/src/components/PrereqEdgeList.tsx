import type { PrereqEdge } from "@quantum/shared";
import { useT } from "@/i18n";

export function PrereqEdgeList({
  edges,
  compact = false,
}: {
  edges: PrereqEdge[];
  compact?: boolean;
}) {
  const t = useT();
  if (edges.length === 0) {
    return compact ? null : (
      <p className="text-[11px] text-paper-muted">{t("prereq.empty")}</p>
    );
  }
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"} data-testid="prereq-edges">
      {edges.map((edge) => (
        <li
          key={`${edge.from_id}->${edge.to_id}`}
          className="text-[11px] leading-relaxed text-paper-ink/85"
        >
          <span className="text-pine">{edge.from_title}</span>
          <span className="mx-1 text-paper-muted">→</span>
          <span>{edge.to_title}</span>
        </li>
      ))}
    </ul>
  );
}
