# Two product cores (v0 index)

**Deep Learn**’s first slice is ~90% of the product: **how a topic starts**, and **how the right-side session stays useful**. Quantum is the internal package / path name only — do not rename packages.

Learning-science language in this repo is **draft heuristic**, not finished product science. Keep TODOs visible.

| Core | Status | What to implement against |
| --- | --- | --- |
| 1 New-topic guidance | Research draft **historical**: [`core1-onboarding-research-v0.md`](./core1-onboarding-research-v0.md) | Five-required finalize gate, outline constraints, `finalize_boundary` / `draft_outline` in `@quantum/shared` + factory |
| 2 Right-side session | Research draft **historical**: [`core2-sidebar-ai-research-v0.md`](./core2-sidebar-ai-research-v0.md) | Packer `TutorContext` L0–L4, strategy closed set, `append_note.reason_code` |

**Acceptance checklist:** [`two-cores-acceptance-v0.md`](./two-cores-acceptance-v0.md)

**Contracts:** [`IA-agent-v1.md`](./IA-agent-v1.md) (chrome v1.3.2) · [`backend-baseline-v0.5.md`](./backend-baseline-v0.5.md) (aligned). Old [`backend-baseline.md`](./backend-baseline.md) is superseded.

**Hand-click:** [`hand-click-five-steps.md`](./hand-click-five-steps.md) (behavior: reject+reflow / citations / outline card — no strategy enum drill).

## Code map

- Interview script: `packages/server/src/learning/boundary-interview.ts`
- Outline scaffold: `packages/server/src/learning/outline-from-boundaries.ts`
- Packer: `packages/server/src/agent/tutor-context.ts` (`build_tutor_context`)
- Tools: `packages/server/src/tools/factory.ts`
- Shared enums/DTOs: `packages/shared/src/tutor.ts` · `packages/shared/src/tools.ts`

## What we are not claiming

- No validated forgetting curve.
- Stub section text is not peer-reviewed teaching.
- Heatmap on 我的 is a placeholder for a future review core.
