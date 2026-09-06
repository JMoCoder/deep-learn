# Two cores — acceptance checklist (v0)

Manual + automated checks for Core 1 (onboarding) and Core 2 (sidebar). Pedagogy items are **behavior** checks, not science claims.

## Core 1 — New-topic guidance

- [ ] 书籍 hero has **no** page title「书籍」; tab label「书籍」remains in the bottom nav.
- [ ] Topic drawer opens from the **RIGHT**. First card = 新建主题.
- [ ] 新建主题 sets the only `current_topic_id` and starts `boundary_interview`.
- [ ] Coach/live agent asks boundaries via `ask_boundary` (not a form).
- [ ] `finalize_boundary` refused (`ok: false`) without `goal_outcome`, `prior_level`, `scope_out`, `depth`, `chunk_budget`.
- [ ] After finalize, phase is `outline_draft`; `draft_outline` produces orientation-first tree with `objective` / `depends_on` / `target_chars` fields present (values may be scaffolded).
- [ ] Confirm「可以」→ `finalize_outline` → `learning` → first leaf `generate_section`.
- [ ] Docs name the 8-step snapshot and mark steps 4 / 8 as TODO (`docs/core1-onboarding-research-v0.md`).
- [ ] Automated: `pnpm test` store phase helpers + coach interview/outline tests.

## Core 2 — Right-side session

- [ ] 学习 body has **no** session composer; right drawer does.
- [ ] System prompt is packed by internal `build_tutor_context` (L0–L3; L4 deferred), not by pasting keys or other topics.
- [ ] A real learner line in `learning` can become exactly one `append_note` with frozen `reason_code` 1–4 → Note.type 思考/疑问/拓展; no user「记一笔」.
- [ ] After `append_note` tool result, the stub coach **stops** (no loop).
- [ ] 书籍 notes list shows AI notes only; export modal offers `md | html | epub` via `export_topic`.
- [ ] Strategy enum exists in shared types; live firing policy remains TODO (`docs/core2-sidebar-ai-research-v0.md`).
- [ ] Automated: coach “does not repeat append_note”; `build_tutor_context` exposes L0–L4.

## Cross-cutting

- [ ] `pnpm test` and `pnpm build` pass.
- [ ] Settings key never appears in SSE, logs, or tool args (`hasApiKey` only on the client).
- [ ] No invented “mastery %” or forgetting-curve UI.
