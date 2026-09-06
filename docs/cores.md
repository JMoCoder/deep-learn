# Two product cores (v0 index)

Quantum’s first slice is ~90% of the product: **how a topic starts**, and **how the right-side session stays useful**.

Learning-science language in this repo is **draft heuristic**, not finished product science. Keep TODOs visible.

| Core | Research draft | What to implement against |
| --- | --- | --- |
| 1 New-topic guidance | [`core1-onboarding-research-v0.md`](./core1-onboarding-research-v0.md) | 8-step snapshot, outline constraints, `finalize_boundary` / `draft_outline` |
| 2 Right-side session | [`core2-sidebar-ai-research-v0.md`](./core2-sidebar-ai-research-v0.md) | TutorContext L0–L4, strategies, `append_note.reason_code` |

**Acceptance checklist:** [`two-cores-acceptance-v0.md`](./two-cores-acceptance-v0.md)

**Contracts:** [`IA-agent-v1.md`](./IA-agent-v1.md) (chrome v1.3.2) · [`backend-baseline.md`](./backend-baseline.md) (v0.5)

## Code map

- Interview script: `packages/server/src/learning/boundary-interview.ts`
- Outline scaffold: `packages/server/src/learning/outline-from-boundaries.ts`
- Packer: `packages/server/src/agent/tutor-context.ts` (`build_tutor_context`)
- Coach: `packages/server/src/agent/coach.ts`
- Shared enums/DTOs: `packages/shared/src/tutor.ts`

## What we are not claiming

- No validated forgetting curve.
- Stub section text is not peer-reviewed teaching.
- Heatmap on 我的 is a placeholder for a future review core.
