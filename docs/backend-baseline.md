# Quantum backend baseline

Server contract for v0. Runtime is **Pi** (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`). Not DeepSeek Harness / DSH.

## Invariants

1. Exactly one `current_topic_id` (or none). Switching a topic writes this pointer; it does not clone sessions.
2. Notes are inserted only by tool `append_note`. HTTP has no `POST /notes`.
3. API keys live in settings (and optional env seed). They are never written to tool args, SSE events, or logs.
4. Tools mutate durable state. The UI is a projection of that state plus a live session stream.
5. Stub tools and types ship first. A real LLM is used only when settings/env provide a key. Without a key, a **local coach** still drives the same tool loop.

## Persistence (v0)

SQLite via `node:sqlite` under `QUANTUM_DATA_DIR` (default `./data/quantum.db`).

Tables: `settings`, `app_state`, `topics`, `boundaries`, `outline_nodes`, `sections`, `notes`, `sessions`, `activity_days`.

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

## Tool surface

Names are stable in `@quantum/shared`. Schemas live next to Pi `AgentTool` implementations.

| Tool | Side effects |
| --- | --- |
| `ask_boundary` | Records a question; may attach the learner’s previous answer |
| `finalize_boundary` | Writes structured answers; phase → `outline_draft` |
| `draft_outline` | Replaces draft outline nodes |
| `finalize_outline` | Locks outline; phase → `learning` |
| `generate_section` | Writes section body for an outline node |
| `get_section` | Read |
| `list_outline` | Read |
| `append_note` | Inserts an AI note; bumps activity |
| `summarize_notes_for_export` | Read + compact notes for export context |
| `export_topic` | Writes `md` / `html` / `epub` artifact; export substate |

## Session + SSE

- One Pi `Agent` per live topic session (rehydrated from `sessions.messages_json`).
- `POST /api/session/prompt` runs `agent.prompt`.
- `GET /api/session/events` is SSE.
- Server maps Pi events → `SessionEvent` DTOs (`text_delta`, `tool_start`, `tool_end`, `phase_changed`, `note_appended`, …).
- `transformContext` packs: topic, phase, boundary digest, outline position, current section (truncated), recent notes. Never settings secrets.

## Model proxy

Settings fields: `provider`, `modelId`, `baseUrl`, `apiKey`.

- Known providers use `getModel` when the id is in the Pi registry.
- Otherwise a custom `Model<'openai-completions'>` (or the selected API) with `baseUrl`.
- `getApiKey` reads the store. Keys are not placed on the `Model` object that is serialized to the client.
- Without a key: `streamFn` is the local coach (same tools).

## Export

`export_topic({ format })` writes under `data/exports/{topicId}/`.

- `md` — title, boundaries, outline, sections, notes
- `html` — same, wrapped
- `epub` — EPUB 3 zip (mimetype + OPF + chapter XHTML)

## Logging

A redaction helper strips `apiKey`, `authorization`, `token`, `secret`, `password` from any object before `console` or SSE debug fields.
