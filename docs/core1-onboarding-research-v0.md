# Core 1 — Onboarding research draft (v0)

How a new topic should be interviewed and turned into an outline. This is a **product-research draft**, not a validated instructional-design system. Do not present it in-product as finished science.

Parent index: `docs/cores.md`. Acceptance: `docs/two-cores-acceptance-v0.md`.

## Sources we are borrowing (not reviewing)

| Tradition | What we take | What we do **not** claim |
| --- | --- | --- |
| **UbD** (Wiggins & McTighe) | Start from desired performance + acceptable evidence, then plan learning | We have no rubric bank or transfer tasks yet |
| **ADDIE** | Analyze (learner, time, constraints) before Design (outline) | We are not running a full ADDIE loop per topic |
| **Scaffolding** (Wood / Bruner; fading) | First outline should be walkable; support is temporary | We do not fade scaffolds automatically |
| **Andragogy** (Knowles) | Adults need *why* and treat prior experience as material | Not an adult-learning certification |
| **CLT** (Sweller) | Time + depth cap outline width | No measured intrinsic load |

**TODO (product research):** which three interview answers most improve outline usefulness in a 10-minute first session.

## 8-step boundary interview (draft)

v0 UI/coach still asks a **shorter live script** (`goal → prior → time → depth → constraint`). The eight steps are the *target snapshot*, so later prompts and `BoundarySnapshot` have a place to put answers.

| Step | Snapshot field | UbD / ADDIE / scaffold hook | Live v0? |
| --- | --- | --- | --- |
| 1. Performance | `goal` | UbD Stage 1 — “I can…” | yes |
| 2. Evidence | `success` | UbD Stage 2 — how we would know | optional / often empty |
| 3. Prior | `prior` | ADDIE Analyze — what is already usable | yes (mixed with gap) |
| 4. First gap | `first_gap` | Where scaffolding should start | **TODO** own question |
| 5. Time box | `time` | CLT / ADDIE — width cap | yes |
| 6. Depth | `depth` | Stops fake mastery on every leaf | yes |
| 7. Constraints | `constraint` | ADDIE context | yes |
| 8. Support preference | `scaffold_pref` | How much structure they want on day one | **TODO** |

`finalize_boundary` **requires** `goal` and `prior`. `time` is stored even if `"unspecified"`.

## Outline constraints (from the snapshot)

`draft_outline` must obey (heuristic, implemented in coach + prompts):

1. **Orientation first** — map + vocabulary, not a dump (UbD “where are we going”).
2. **Sequence** — prerequisite → core → application → transfer (loose Gagné / fading).
3. **One objective per leaf** (`OutlineNode.objective`). Extra intents ⇒ split the node.
4. **`depends_on`** — a leaf should name prior leaves when the gap requires them. v0 fills this only for the deterministic scaffold.
5. **Width from `time`** — ~25–40 focused minutes / leaf; 3 h/week × 4 weeks ≈ 8–12 leaves, not 30.
6. **`target_chars`** — soft cap so `generate_section` cannot write a textbook into one sitting. `0` = unset.
7. Depth/`success` change *how complete* a leaf pretends to be, not how many decorative chapters appear.

**TODO:** expert templates vs generated trees; whether transfer leaves wait until the first `append_note` cluster.

## What shipping code does today

- Interview kinds + script: `packages/server/src/learning/boundary-interview.ts`
- Deterministic tree: `packages/server/src/learning/outline-from-boundaries.ts`
- Snapshot packing: `packages/server/src/agent/tutor-context.ts` (`build_tutor_context` L1)

Live model still **must** call tools to persist. Chat prose is not the outline.
