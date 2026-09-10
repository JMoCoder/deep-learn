# Quantum backend baseline — v0.5

> **Superseded.** Contract truth is [`backend-baseline-v0.5.md`](./backend-baseline-v0.5.md), which follows `@quantum/shared` + `packages/server/src/tools/factory.ts`. This file kept for history; do not implement against it. Product name: **Deep Learn** (Quantum = internal packages only).

Server contract. Runtime is **Pi** (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`). Not DeepSeek Harness / DSH.

v0.5 names the **context and outline contracts** the two cores need. Heuristics below are product-lock *shapes*, not finished learning science. Open items stay **TODO (product research)**.

## Invariants

1. Exactly one `current_topic_id` (or none). Switching a topic writes this pointer; it does not clone sessions.
2. Notes are inserted only by tool `append_note`. HTTP has no `POST /notes`.
3. API keys live in settings (and optional env seed). They are never written to tool args, SSE events, or logs.
4. Tools mutate durable state. The UI is a projection of that state plus a live session stream.
5. Stub tools and types ship first. A real LLM is used only when settings/env provide a key. Without a key, a **local coach** still drives the same tool loop.
6. Session packing goes through internal `build_tutor_context`. It is **not** a learner-facing tool.

## Persistence (v0)

SQLite via `node:sqlite` under `QUANTUM_DATA_DIR` (default `./data/quantum.db`).

Tables: `settings`, `app_state`, `topics`, `boundaries`, `outline_nodes`, `sections`, `notes`, `sessions`, `activity_days`.

`outline_nodes` stores `objective`, `depends_on` (JSON id list), `target_chars` in addition to `intent`.  
`notes` stores `reason_code` (see below).

## Phases

```
idle → boundary_interview → outline_draft → learning
                              ↘ export substate: idle | exporting | ready
```

| Phase | Who moves it | Typical tools |
| --- | --- | --- |
| `idle` | 新建主题 | — |
| `boundary_interview` | agent | `ask_boundary`, `finalize_boundary` |
| `outline_draft` | agent | `draft_outline`, `finalize_outline`, `list_outline` |
| `learning` | agent | `generate_section`, `get_section`, `list_outline`, `append_note`, `summarize_notes_for_export`, `export_topic` |

`finalize_boundary` is the only path into `outline_draft`. `finalize_outline` is the only path into `learning`.

## BoundarySnapshot (required fields)

`BoundarySnapshot` is the durable, packed form of the interview. Kinds still flow through `ask_boundary`.

Interview kinds still flow through `ask_boundary`. They map onto snapshot fields:

`goal→goal_outcome` · `prior→prior_level` · `constraint→scope_out` · `time→chunk_budget` · `depth→depth`

| Field | Required to finalize? | Notes |
| --- | --- | --- |
| `goal_outcome` | **yes** | Performance, not a catalog title |
| `prior_level` | **yes** | What they can already do / first stuck point |
| `scope_out` | **yes** | Out of scope (「没有」is a valid answer) |
| `depth` | **yes** | Browse / explain / perform |
| `chunk_budget` | **yes** | Width cap (hours / week or minutes) |
| `success` | field exists; may be empty | UbD evidence. **TODO**: require after first section? |
| `first_gap` | no | 8-step item. **TODO**: own `kind` vs folded into `prior` |
| `scaffold_pref` | no | 8-step item. **TODO**: whether to ask in v0 interview |

`finalize_boundary` returns `{ ok: false, missing }` and **does not** change phase when required fields are absent.

See `docs/core1-onboarding-research-v0.md`.

## OutlineNode (v0.5)

| Field | Role |
| --- | --- |
| `title` | Leaf / branch name |
| `intent` | Why this node exists for *this* learner (kept) |
| `objective` | Observable “I can…” for the leaf (UbD-ish). If empty, packers fall back to `intent` |
| `depends_on` | Outline node ids that should be ready first |
| `target_chars` | Soft cap for `generate_section` body. `0` = unset |
| `status` | `draft` / `finalized` / `generating` / `ready` |

**TODO (product research):** default `target_chars` from `time` × depth; whether `depends_on` is author-time or inferred.

## TutorContext L0–L4

Internal only. Built by `build_tutor_context(store, topicId)` (`packages/server/src/agent/tutor-context.ts`). Never include settings secrets.

| Layer | Name | Contents |
| --- | --- | --- |
| L0 | Session invariants | `current_topic_id`, phase, export substate, coach mode |
| L1 | Boundary snapshot | `BoundarySnapshot` digest |
| L2 | Outline position | current / prev / next, `objective`, `depends_on` |
| L3 | Grounded section | current section body, truncated |
| L4 | Deferred | Not packed on the default learning turn. No vector retrieval. |

`build_tutor_context(store, topicId)` defaults to **L0–L3**. `strategyHint` sits on L0. Pass `{ includeL4: true }` only for explicit post-pass work.

**TODO:** token budget vs always-full outline; whether a later L4 should include notes or embeddings.

## Strategy enums

Closed set for sidebar turns (names stable; firing rules are **not** validated science):

`PROBE` · `SCAFFOLD` · `GROUND` · `ELABORATE` · `CONTRAST` · `CHECK` · `REDIRECT` · `HOLD`

Draft use (see `docs/core2-sidebar-ai-research-v0.md`):

- `PROBE` — reveal the gap before generating
- `SCAFFOLD` — partial structure, not a full new chapter
- `GROUND` — point at the projected section
- `ELABORATE` / `CONTRAST` — expand or compare
- `CHECK` — one observable check, not a quiz engine
- `REDIRECT` — back to the current leaf
- `HOLD` — talk, do not mutate

## `append_note.reason_code` (frozen)

Numeric only. **Do not** replace with an English enum. Body **≤ 300** chars. `ok: false` if over limit or if `reason_code` is not 1–4.

| Code | Meaning | `Note.type` |
| --- | --- | --- |
| 1 | 稳定结论/心得 | 思考 |
| 2 | 可复查误解或未解 | 疑问 |
| 3 | 超 objective 旁支且用户想留 | 拓展 |
| 4 | 同题往返≥2 轮未解 | 疑问 |

Learner UI never picks these. No `POST /notes`. **TODO:** which codes belong in the export preface.

## Session SSE (frozen names)

`GET /api/session/events`. **Client (`packages/web`) subscribes only to this frozen set.** Older aliases (`topic_updated`, `section_updated`, `outline_updated`, `tool_start`, `tool_end`) are ignored.

| Event | Notes |
| --- | --- |
| `phase_changed` | `{ topicId, phase, exportState }` |
| `boundary_finalized` | `{ topic_id, phase }` |
| `outline_finalized` | `{ topic_id, phase }` |
| `section_status` | `{ topic_id, section_id, status, outline_node_id? }` |
| `section_ready` | `{ topic_id, section_id }` |
| `note_appended` | `{ note_id, note_type, reason_code?, section_id? }` — `note_type` is `Note.type`（思考/疑问/拓展）. Wire field is `note_type` because SSE `type` is the event name. |
| `export_ready` | `{ topicId, format, filename, downloadPath }` |

Stream transport (composer only, not domain aliases): `session_start` / `session_end` / `text_delta` / `message` / `error`.
Assistant and tool stream rows read `strategy?` and `citations?: [{ section_id, note_id? }]`.
`note_appended.reason_code` 1–4 is mapped in the UI: 1→思考, 2→疑问, 3→拓展, 4→疑问.

`GET /api/topics/current/projection` shape: `{ topic_title, section_title, outline, phase }`.

## Tool surface

Names are stable in `@quantum/shared`. Schemas live next to Pi `AgentTool` implementations.

| Tool | Side effects |
| --- | --- |
| `ask_boundary` | Records a question; may attach the learner’s previous answer |
| `finalize_boundary` | Writes structured answers / snapshot; phase → `outline_draft` |
| `draft_outline` | Replaces draft outline nodes (incl. objective / depends_on / target_chars) |
| `finalize_outline` | Locks outline; phase → `learning` |
| `generate_section` | Writes section body for an outline node |
| `get_section` | Read |
| `list_outline` | Read |
| `append_note` | Inserts an AI note with `reason_code`; bumps activity |
| `summarize_notes_for_export` | Read + compact notes for export context |
| `export_topic` | Writes `md` / `html` / `epub` artifact; export substate |
| `build_tutor_context` | **Not a tool.** Server-internal packer |

## Session + SSE

- One Pi `Agent` per live topic session (rehydrated from `sessions.messages_json`).
- `POST /api/session/prompt` runs `agent.prompt` (serialized per topic).
- `GET /api/session/events` is SSE.
- System prompt = phase prompt + `renderTutorContext(build_tutor_context(...))`.

## Model proxy

Settings fields: `provider`, `modelId`, `baseUrl`, `apiKey`.

- Known providers use `getModel` when the id is in the Pi registry.
- Otherwise a custom `Model<'openai-completions'>` with `baseUrl`.
- `getApiKey` reads the store. Keys are not placed on objects sent to the client.
- Without a key: `streamFn` is the local coach (same tools).

## Export

`export_topic({ format })` writes under `data/exports/{topicId}/`.
`GET /api/exports/:topicId/:filename` calls `requireTopic`, rejects `..` /
separators, and after resolve/realpath must stay under the exports root.

When `QUANTUM_API_TOKEN` is set, every `/api/*` except `GET /api/health`
requires `Authorization: Bearer` or `X-Quantum-Token`. Compose preview injects
that header in nginx (and the Vite proxy) — not in browser JS.

- `md` — title, boundaries, outline, sections, notes
- `html` — same, wrapped
- `epub` — EPUB 3 zip (mimetype + OPF + chapter XHTML)

## Logging

A redaction helper strips `apiKey`, `authorization`, `token`, `secret`, `password` from any object before `console` or SSE debug fields.
