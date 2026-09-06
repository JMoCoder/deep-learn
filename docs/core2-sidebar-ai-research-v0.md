# Core 2 — Sidebar session research draft (v0)

How the right-side session should see the learner, and when it should write notes. Draft heuristics. Not a tutoring-science release.

Parent index: `docs/cores.md`. Acceptance: `docs/two-cores-acceptance-v0.md`. Contract: `docs/backend-baseline.md` (v0.5).

## Why a packed context (not “the whole book in chat”)

The 学习 canvas stays readable. The sidebar is the only composer. The model should know *where* they are without stuffing other topics, secrets, or an unbounded transcript into every turn.

Internal packer: `build_tutor_context` → `TutorContext` (L0–L4). Rendered into the system prompt. **Not** a tool. **Never** includes API keys or settings.

## TutorContext packing

| Layer | Pack | Truncation (v0) |
| --- | --- | --- |
| L0 | topic id, phase, export substate, stub/live | always |
| L1 | `BoundarySnapshot` | short answers only |
| L2 | current / prev / next + `objective` / `depends_on` + compact tree | titles, not bodies |
| L3 | current section | ~4000 chars |
| L4 | last N notes + `reason_code` + last strategy hint | N = 8 |

**TODO (product research):**

- Token budget vs “always include full outline.”
- Whether L3 should prefer the learner’s last highlighted span (we have no highlight UI).
- Whether L4 strategy is model-output or a server hint only.

## Sidebar interaction strategies

Closed enum. Firing rules are **draft**. The coach/prompts may name a hint; we do not score “correct strategy.”

| Strategy | When (heuristic) | Typical tools |
| --- | --- | --- |
| `PROBE` | Answer is vague; gap unknown | talk only, or `append_note` reason_code 2 |
| `SCAFFOLD` | They asked “怎么开始” | short structure; maybe `generate_section` if leaf empty |
| `GROUND` | They drifted off the projected leaf | point at L3; no new chapter |
| `ELABORATE` | They want more on the same objective | optional section regen; keep `target_chars` |
| `CONTRAST` | Two cases mixed | `append_note` reason_code 1 or 2 |
| `CHECK` | They claim “会了” | one observable check, not a quiz product |
| `REDIRECT` | They asked for another topic | refuse to switch `current_topic_id` from chat |
| `HOLD` | Social / meta / export small talk | no mutation |

Local coach (no key) is **not** a full strategy engine. It covers GROUND-ish generate-first-leaf, HOLD after tools, and a simple `append_note` on a real learner turn.

## Note heuristics (`append_note`)

Notes exist only in the tool loop. The books hero lists them; the learner cannot add one.

Write a note when `reason_code` 1–4 applies:

- **1** 稳定结论/心得 → `Note.type` 思考
- **2** 可复查误解或未解 → 疑问
- **3** 超 objective 旁支且用户想留 → 拓展
- **4** 同题往返≥2 轮未解 → 疑问

Do **not** write a note when:

- they only said「可以」to lock the outline
- the turn is kickoff / system
- the same user text already became a note this turn (coach must stop after `toolResult`)

`reason_code` is required and frozen as **1–4**. Do not invent English aliases.

**TODO:** which codes belong in the export preface; whether notes should bind to `depends_on` leaves.

## Linkage (unchanged)

| Store | Who writes | Who reads |
| --- | --- | --- |
| Section body | `generate_section` | 学习 canvas, TutorContext L3 |
| Notes | `append_note` | 书籍 list, export, L4 |
| Outline | `draft_outline` / `finalize_outline` | left drawer, 学习 top bar, L2 |
