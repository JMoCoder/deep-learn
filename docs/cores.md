# Two product cores (v0)

Quantum’s first slice is ~90% of the product: **how a topic starts**, and **how the right-side session stays useful**. Learning-science claims below are **draft heuristics** drawn from well-known instructional-design sources. They are not finished product science. Open questions are marked **TODO (product research)**.

## Core 1 — New-topic guidance

Goal: a learner can start a topic without a syllabus, and end with a study outline that is honest about time and prior knowledge.

### Why interview boundaries first

Adult learners arrive with a job-to-be-done, uneven priors, and a real calendar. Jumping to a table of contents copies textbook structure, not *their* structure.

Draft sources (not a systematic review):

- **Andragogy (Knowles)** — adults need to know *why*, and treat prior experience as material.
- **Backward design (Wiggins & McTighe)** — start from acceptable evidence, not chapter titles.
- **Cognitive load (Sweller)** — one sitting cannot hold an encyclopedia; the interview must surface time and depth.
- **2-sigma / formative pre-assessment (Bloom)** — find the first gap before generating prose.

**TODO (product research):** which three questions predict outline quality in a 10-minute first session? We have not A/B’d this.

### Boundary kinds

The tool `ask_boundary.kind` is a closed set:

| Kind | Interview intent | Heuristic |
| --- | --- | --- |
| `goal` | 这次学完要能做什么 | Performance, not topic name |
| `prior` | 已经会什么 / 卡在哪 | Places the first gap |
| `time` | 每周能投入多久、想覆盖几周 | Caps outline width |
| `depth` | 浏览 / 能讲清 / 能做出来 | Stops fake completeness |
| `constraint` | 语言、工具、必须避开的材料 | Keeps generation legal-and-practical |
| `success` | 怎样算「过关」 | Seeds later checks; not a quiz engine yet |

v0 coach asks **goal → prior → time**, then **depth or constraint**, then offers to finalize. `success` is optional.

`finalize_boundary` should refuse if `goal` and `prior` are missing. Time can be inferred as “unspecified” with a warning node in the outline.

**TODO (product research):** whether `success` belongs in the first interview or after the first generated section.

### From boundaries to outline

`draft_outline` is not “ask the model for 12 chapters.” The prompt requires:

1. **One orientation node first** — map + vocabulary, not a content dump.
2. **Prerequisite → core → application → transfer** (Gagné-ish sequence, loosely applied).
3. **One to three intents per leaf.** If the model wants more, it must split nodes.
4. **Width cap from `time`.** Rough v0 rule: 25–40 focused minutes per leaf. A 3-hour/week × 4-week budget ⇒ about 8–12 leaves, not 30.
5. Each leaf stores `intent` (why this exists given *this* learner’s goal).

This is a **planning scaffold**, not a proven spacing schedule.

**TODO (product research):**

- Auto-derived review intervals (heatmap is a placeholder).
- Whether transfer nodes should be delayed until after the first `append_note` cluster.
- Expert-authored outline templates vs fully generated trees.

### Coach behavior (implemented)

See `packages/server/src/agent/coach.ts` and `prompts.ts`.

- Local (no key): deterministic tool sequence so the IA can be clicked end-to-end.
- With key: same tools + richer Chinese prompts. The model still **must** call tools to mutate state; prose in the drawer is not persistence.

## Core 2 — Right-side AI session

Goal: the 学习 canvas stays readable; the session is the only place the learner talks; the agent can see *where* they are.

### Context packing

`assembleSessionContext` (server) injects a system appendix, not a fake user turn:

1. Topic title + phase + export substate
2. Boundary digest (kinds + short answers)
3. Outline position: current / prev / next titles
4. Current section body, truncated
5. Last N notes (`append_note` only)

Never: API keys, raw settings, other topics’ notes.

**TODO (product research):** token budget vs “always include full outline.” v0 includes a compact tree + full current leaf.

### Effective interaction

- Session drawer opens from the **right** on 学习. Composer is only there.
- Streaming uses Pi events → SSE (`text_delta`, tool chips).
- When the agent `generate_section`s or `append_note`s, the canvas / 书籍 notes refresh from store events, not from parsing chat.
- The learner can ask “这一节太快了” — the agent should `append_note` the friction and optionally regenerate, not silently edit history.

### Linkage

| Store | Who writes | Who reads |
| --- | --- | --- |
| Section body | `generate_section` | 学习 canvas, context pack |
| Notes | `append_note` | 书籍 notes, export, context pack |
| Outline | `draft_outline` / `finalize_outline` | left drawer, top bar `主题·章节` |

## What we are not claiming

- We do not ship a validated forgetting curve.
- We do not label stub section text as peer-reviewed teaching.
- Heatmap on 我的 is a **placeholder** for a future review core.
