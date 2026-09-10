import type { BoundarySnapshot } from "@quantum/shared";
import {
  BOUNDARY_OPTIONAL_ROWS,
  BOUNDARY_REQUIRED_ROWS,
  canConfirmBoundaryCard,
  missingFinalizeFields,
  snapshotRowValue,
} from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { allInterviewChipsFilled, visibleInterviewChips } from "@/lib/interview-ui";
import { fieldLabel, useLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function BoundaryCard({
  snapshot,
  askedKinds,
  currentKind,
  coachMode,
  onConfirm,
  onNeedMore,
}: {
  snapshot: BoundarySnapshot;
  askedKinds: string[];
  currentKind?: string | null;
  coachMode: "stub" | "live";
  onConfirm: () => void;
  onNeedMore: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const missing = missingFinalizeFields(snapshot);
  const canConfirm = canConfirmBoundaryCard(snapshot);
  const dims = visibleInterviewChips(snapshot, askedKinds, currentKind);
  const askedCount = dims.filter((d) => d.asked || d.filled).length;
  const allAsked = allInterviewChipsFilled(snapshot, askedKinds, currentKind);
  const listSep = locale === "en" ? ", " : "、";

  return (
    <section className="boundary-card mx-auto max-w-2xl overflow-hidden rounded-2xl border border-paper-line bg-white/70">
      <header className="border-b border-paper-line px-5 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-cinnabar">BOUNDARY</p>
        <h2 className="mt-1 font-serif text-xl">{t("boundary.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-muted">
          {t("boundary.lead")}
        </p>
        <p className="mt-2 text-xs text-paper-muted">
          {t("boundary.coverage", { asked: askedCount, total: dims.length })}
          {allAsked ? t("boundary.allAsked") : t("boundary.someUnasked")}
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-paper-muted">{t("boundary.required")}</h3>
          <dl className="mt-2 space-y-2">
            {BOUNDARY_REQUIRED_ROWS.map((row) => (
              <FieldRow
                key={row.key}
                label={fieldLabel(String(row.key), t)}
                hint={row.hint}
                value={snapshotRowValue(snapshot, row.key)}
                required
                missing={missing.includes(row.key as (typeof missing)[number])}
                asked={row.askedBy.some((kind) => askedKinds.includes(kind))}
              />
            ))}
          </dl>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-wide text-paper-muted">{t("boundary.optional")}</h3>
          <dl className="mt-2 space-y-2">
            {BOUNDARY_OPTIONAL_ROWS.map((row) => {
              const value = snapshotRowValue(snapshot, row.key);
              const asked = row.askedBy.some((kind) => askedKinds.includes(kind));
              return (
                <FieldRow
                  key={row.key}
                  label={fieldLabel(String(row.key), t)}
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
            {t("boundary.missingRequired", {
              fields: missing.map((key) => fieldLabel(key, t)).join(listSep),
            })}
          </p>
        ) : dims.some((d) => d.gap) ? (
          <p className="rounded-lg border border-paper-line bg-paper-deep/70 px-3 py-2 text-sm text-paper-ink/80">
            {t("boundary.requiredOkGaps")}
          </p>
        ) : (
          <p className="rounded-lg border border-pine/20 bg-pine/5 px-3 py-2 text-sm text-pine">
            {t("boundary.allReady")}
          </p>
        )}

        {coachMode === "stub" && !allAsked ? (
          <p className="text-xs leading-relaxed text-paper-muted">{t("interview.stub")}</p>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-paper-line px-5 py-3">
        <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
          {t("boundary.confirm")}
        </Button>
        <Button type="button" variant="outline" onClick={onNeedMore}>
          {t("boundary.needMore")}
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
          <FieldStatus missing={missing} required={required} asked={asked} />
        </span>
      </div>
      <dd className="mt-1 text-sm leading-relaxed text-paper-ink/90">
        {value.trim() || "—"}
      </dd>
    </div>
  );
}

function FieldStatus({
  missing,
  required,
  asked,
}: {
  missing: boolean;
  required: boolean;
  asked: boolean;
}) {
  const t = useT();
  if (!missing) return t("boundary.filled");
  if (required) return t("boundary.gapRequired");
  if (asked) return t("boundary.askedUnanswered");
  return t("boundary.unasked");
}
