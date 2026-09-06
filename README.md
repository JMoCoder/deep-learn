# Quantum

Agent-driven lifelong-learning PWA. Architecture is **session + tools + persistence**, not CRUD pages.

Runtime: `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai` (not DeepSeek Harness).

Chinese UI. One `current_topic_id` at a time. Notes exist only via tool `append_note` (`reason_code` 1–4 → 思考/疑问/拓展).

## Packages

```
packages/shared   tool names, events, DTOs
packages/server   Pi agent, tools, SQLite, SSE, export
packages/web      PWA (学习 / 书籍 / 我的)
docs/             IA v1.3.2, backend v0.5, core1/core2 research, acceptance
```

## Run locally

```bash
pnpm install
pnpm --filter @quantum/shared build
pnpm dev
```

- Web: http://127.0.0.1:43127
- API: http://127.0.0.1:43128 (`/api/*` is proxied from Vite)

Copy `.env.example` to `.env` if you want to change ports or seed a model. **Do not commit keys.**

Without a key, the server uses a local coach that still runs the real tool loop (boundary → outline → first section).

## Model proxy (keys)

Open **我的 → 模型代理**, or set env:

- `QUANTUM_MODEL_PROVIDER`
- `QUANTUM_MODEL_ID`
- `QUANTUM_MODEL_BASE_URL` (OpenAI-compatible proxy)
- `QUANTUM_MODEL_API_KEY`

Keys stay in SQLite (`data/quantum.db`). They are never written to chat, SSE, logs, or tool arguments.

## IA

Bottom tabs: **学习 / 书籍 / 我的**.

- 学习: content projection. Top bar `主题·章节`. Left = outline. Right = session. No composer in the body.
- 书籍: **current-topic hero only** (no page title「书籍」). Topic drawer from the RIGHT. First card = 新建主题. History = 切换 + 导出 (`md | html | epub` via `export_topic`).
- 我的: settings + heatmap placeholder.

See `docs/IA-agent-v1.md` (v1.3.2), `docs/backend-baseline.md` (v0.5), `docs/cores.md` → core1 / core2 / acceptance.
Static IA click-through: `packages/web/public/prototype.html`.

## Tests

```bash
pnpm test
pnpm build
```
