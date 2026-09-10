# Deep Learn

Local-only agent that walks a topic from interview → boundary card → outline → grounded notes.

Architecture is **session + tools + persistence**, not CRUD pages. Runtime: `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`.

Two cores:

1. **Agent runtime** — Pi coding-agent SDK on the server (`packages/server`). Tools, sessions, SQLite.
2. **PWA** — Vite + React (`packages/web`). Talk, chips, boundary card, outline confirm, notes.

Shared TypeScript contracts live in `packages/shared`.

No cloud, no account, no telemetry. Data stays in the Docker volume `quantum-data`.

Chinese translation: [README.zh-CN.md](./README.zh-CN.md).

## Acceptance URL

Docker Compose is the only supported preview path. After `docker compose up --build`, open:

**http://127.0.0.1:43127**

| Surface | URL |
| --- | --- |
| PWA | `http://127.0.0.1:43127` |
| API / health | `http://127.0.0.1:43127/api/health` or `http://127.0.0.1:43128/api/health` |

Do not treat `pnpm --filter @quantum/web dev` as acceptance.

Compose publishes **loopback only**: `127.0.0.1:43127:80` and `127.0.0.1:43128:43128`. `QUANTUM_HOST` defaults to `127.0.0.1`. Do not publish a bare `:43128` (that would listen on all interfaces and skip nginx). Intentional LAN/public bind must set `QUANTUM_HOST` and rewrite `ports:` explicitly.

SQLite and exports live in `quantum-data` (`QUANTUM_DATA_DIR=/data` in the server container). Stop with `Ctrl+C` or `docker compose down`. The volume survives `down`; wipe it with `docker compose down -v`.

### Preview token (loopback-only weak secret)

Compose sets `QUANTUM_API_TOKEN=local-preview` on **server + nginx** only. That default is a **weak password for loopback preview**. Change it before any LAN or public bind (`QUANTUM_API_TOKEN=… docker compose up --build`). An empty/unset token leaves the HTTP gate off — treat that the same way: loopback only.

When the token is set, **every** `/api/*` except `GET /api/health` needs a matching `Authorization: Bearer <token>` or `X-Quantum-Token: <token>` (reads, writes, SSE, exports). Health stays open and does not dump config.

The browser must **not** hold the token. There is no `VITE_*` bake-in and no login UI. Nginx injects `X-Quantum-Token` when proxying `/api` to `:43128`. The Vite dev/preview proxy does the same from `process.env.QUANTUM_API_TOKEN`. Hitting `:43128` directly bypasses nginx, so you must send the header yourself.

## Install

Needs Docker Engine and the Compose plugin.

```bash
git clone <this-repo>
cd deep-learn
docker compose up --build
```

First boot pulls the runtime image and creates `quantum-data`. Ready when `:43127` serves the PWA and `/api/health` returns `{"ok":true,"name":"quantum",...}`.

Compose services: `server` (Hono on `127.0.0.1:43128`, also publishes PWA `127.0.0.1:43127` → `:80`) and `web` (nginx + built PWA). `web` uses `network_mode: service:server` so `/api` and SSE proxy to `127.0.0.1:43128` on the PWA origin, with nginx injecting the preview token.

### Local development (optional)

```bash
corepack enable
pnpm install
pnpm --filter @quantum/shared build
pnpm --filter @quantum/server build
pnpm --filter @quantum/server start
# other terminal
pnpm --filter @quantum/web dev
```

Web unit tests (no model, no Docker):

```bash
pnpm --filter @quantum/web test
pnpm --filter @quantum/web build
```

## Architecture

```
packages/shared   tool names, events, DTOs
packages/server   Pi agent, tools, SQLite, SSE, export
packages/web      PWA (Learn / Books / Me)
docs/             IA, backend-baseline-v0.5, two-cores acceptance, hand-click
```

```
browser  :43127  →  nginx / vite (PWA)
                →  /api proxy  →  hono :43128
                                     ├─ GET  /api/health
                                     ├─ GET|POST /api/topics
                                     ├─ GET|POST /api/session …
                                     ├─ tools: append_note, cite, …
                                     └─ better-sqlite3 → /data/quantum.db
```

### Learn

Interview chips → **boundary card** (user confirms) → **outline card** (leaf count must fit the load budget) → talk + grounded notes. A `scope_out` hit is **refuse + reflow**: no note card and no citation row on that turn.

Header: topic · section. Left drawer = outline. Right drawer = session. No composer in the article body.

### Books

Current-topic hero (no page title). Topic drawer from the right. First card = **New topic** (`POST /api/topics` — the dimmer does not steal the click). History = switch + export (`md | html | epub` via `export_topic`). Notes are read-only; there is no “jot a note” control.

### Settings (Me)

Model proxy and a placeholder heatmap. **Interface language** (Chinese / English) switches PWA chrome only.

- First visit: follow the browser language (`en*` → English, `zh*` → Chinese). Anything else falls back to zh-CN.
- After you pick a language, it is stored in `localStorage` (`quantum.locale`).

The agent does **not** have a separate language switch. Replies follow the language of the user's message. The UI toggle does not inject a forced locale into model prompts.

Server APIs have no locale field. Stub/coach copy follows the user's input language; PWA empty states and chrome are translated on the client. **No server locale is needed.**

## Model proxy (keys)

Open **Me → Model proxy**, or pass through Compose:

- `QUANTUM_MODEL_PROVIDER`
- `QUANTUM_MODEL_ID`
- `QUANTUM_MODEL_BASE_URL` (OpenAI-compatible proxy)
- `QUANTUM_MODEL_API_KEY`

Keys stay in SQLite (`/data/quantum.db`). They are never written to chat, SSE, logs, or tool arguments. Without a key, the local stub coach still runs the real tool loop.

## Product rules

- Local-only. The runtime never phones home.
- `scope_in` / `scope_out` stay as the user wrote them.
- Notes belong to the current topic. Refuse + reflow beats grounding when the turn is out of scope.

## Verify two cores (brief)

1. PWA → **Books** → right drawer → **New topic**. Stub walks eight dimensions (motivation → outcome → success evidence → prior → prereqs → scope_in → exclude → depth → load).
2. After `boundary_finalized`, confirm the independent boundary card on Learn, then the outline, then enter `learning`.
3. Follow-ups in the session should show a citation row when the section has body. Notes come only from `append_note`.
4. Export `md | html | epub` from Books; expect a real download (`export_ready`).
5. In learning, hit `scope_out` (for example exclude “string theory”, then ask to cover it) → short refuse + pull back to the current leaf, no note.

Hand-click path: `docs/hand-click-five-steps.md`. Contract: `docs/backend-baseline-v0.5.md`. Cores: `docs/cores.md`.

## License

[MIT](./LICENSE) — Copyright (c) 2026 Jiamo.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
