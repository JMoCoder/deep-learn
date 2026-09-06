import type { BoundarySnapshot } from "@quantum/shared";
import {
  STUB_INTERVIEW_NOTE,
  allInterviewDimensionsAsked,
  canConfirmBoundaryCard,
  interviewDimensionStatus,
  missingFinalizeFields,
} from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REQUIRED_ROWS: Array<{
  key: keyof BoundarySnapshot;
  label: string;
  hint: string;
  askedBy: string[];
}> = [
  { key: "goal_outcome", label: "终点表现", hint: "goal_outcome", askedBy: ["goal", "goal_outcome"] },
  { key: "prior_level", label: "先验", hint: "prior_level", askedBy: ["prior", "prior_level"] },
  { key: "scope_out", label: "排除", hint: "scope_out", askedBy: ["constraint", "scope_out"] },
  { key: "depth", label: "深度", hint: "depth", askedBy: ["depth"] },
  { key: "chunk_budget", label: "负荷", hint: "chunk_budget", askedBy: ["time", "chunk_budget"] },
];

const OPTIONAL_ROWS: Array<{
  key: keyof BoundarySnapshot;
  label: string;
  hint: string;
  askedBy: string[];
}> = [
  { key: "motivation", label: "动机", hint: "motivation", askedBy: ["motivation"] },
  { key: "success_evidence", label: "成功证据", hint: "success_evidence", askedBy: ["success", "success_evidence"] },
  { key: "prior_known", label: "已知先修", hint: "prior_known", askedBy: ["prior_known", "prior_gaps", "gap"] },
  { key: "prior_gaps", label: "先修缺口", hint: "prior_gaps", askedBy: ["prior_known", "prior_gaps", "gap", "first_gap"] },
  { key: "scope_in", label: "必须包含", hint: "scope_in", askedBy: ["scope_in", "constraint", "scope_out"] },
];

export function BoundaryCard({
  snapshot,
  askedKinds,
  coachMode,
  onConfirm,
  onNeedMore,
}: {
  snapshot: BoundarySnapshot;
  askedKinds: string[];
  coachMode: "stub" | "live";
  onConfirm: () => void;
  onNeedMore: () => void;
}) {
  const missing = missingFinalizeFields(snapshot);
  const canConfirm = canConfirmBoundaryCard(snapshot);
  const dims = interviewDimensionStatus(snapshot, askedKinds);
  const askedCount = dims.filter((d) => d.asked || d.filled).length;
  const allAsked = allInterviewDimensionsAsked(askedKinds);

  return (
    <section className="boundary-card mx-auto max-w-2xl overflow-hidden rounded-2xl border border-paper-line bg-white/70">
      <header className="border-b border-paper-line px-5 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-cinnabar">BOUNDARY</p>
        <h2 className="mt-1 font-serif text-xl">学习边界卡</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-muted">
          独立确认这一张，再进大纲。书籍页英雄卡上的目标行不是边界卡。
        </p>
        <p className="mt-2 text-xs text-paper-muted">
          已覆盖 {askedCount}/{dims.length} 维
          {allAsked ? " · 8 维都已问到" : " · 未问到的维不会标成已齐"}
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-paper-muted">必填</h3>
          <dl className="mt-2 space-y-2">
            {REQUIRED_ROWS.map((row) => (
              <FieldRow
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={snapshot[row.key]}
                required
                missing={missing.includes(row.key as (typeof missing)[number])}
                asked={row.askedBy.some((kind) => askedKinds.includes(kind))}
              />
            ))}
          </dl>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-wide text-paper-muted">有则展示</h3>
          <dl className="mt-2 space-y-2">
            {OPTIONAL_ROWS.map((row) => {
              const value =
                row.key === "success_evidence"
                  ? snapshot.success_evidence || snapshot.success
                  : row.key === "prior_gaps"
                    ? snapshot.prior_gaps || snapshot.first_gap
                    : snapshot[row.key];
              const asked = row.askedBy.some((kind) => askedKinds.includes(kind));
              return (
                <FieldRow
                  key={row.key}
                  label={row.label}
                  hint={row.hint}
                  value={value}
                  required={false}
                  missing={!value.trim()}
                  asked={asked}
                />
              );
            })}
          </dl>
        </div>

        {!canConfirm ? (
          <p className="rounded-lg border border-cinnabar/25 bg-cinnabar/5 px-3 py-2 text-sm text-cinnabar">
            必填未齐：{missing.join("、")}。缺口可见，不会静默进大纲。
          </p>
        ) : dims.some((d) => d.gap) ? (
          <p className="rounded-lg border border-paper-line bg-paper-deep/70 px-3 py-2 text-sm text-paper-ink/80">
            必填已齐，仍有未答维。确认后进大纲；未问到的维不会被当成已经问过。
          </p>
        ) : (
          <p className="rounded-lg border border-pine/20 bg-pine/5 px-3 py-2 text-sm text-pine">
            8 维都已落到卡上，可以确认后看大纲。
          </p>
        )}

        {coachMode === "stub" && !allAsked ? (
          <p className="text-xs leading-relaxed text-paper-muted">{STUB_INTERVIEW_NOTE}</p>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-paper-line px-5 py-3">
        <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
          确认边界，看大纲
        </Button>
        <Button type="button" variant="outline" onClick={onNeedMore}>
          还要补一维
        </Button>
      </footer>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  value,
  required,
  missing,
  asked = false,
}: {
  label: string;
  hint: string;
  value: string;
  required: boolean;
  missing: boolean;
  asked?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        missing
          ? required
            ? "border-cinnabar/30 bg-cinnabar/5"
            : "border-dashed border-paper-line bg-paper-deep/40"
          : "border-paper-line bg-paper",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm font-medium">
          {label}{" "}
          <span className="font-mono text-[11px] text-paper-muted">{hint}</span>
        </dt>
        <span
          className={cn(
            "text-[11px]",
            missing ? "text-cinnabar" : "text-pine",
          )}
        >
          {missing ? (required ? "必填缺口" : asked ? "已问未答" : "未问") : "已填"}
        </span>
      </div>
      <dd className="mt-1 text-sm leading-relaxed text-paper-ink/90">
        {value.trim() || "—"}
      </dd>
    </div>
  );
}
