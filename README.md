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
pnpm --filter @quantum/web build
```

### Retest 1.2 / 1.3 / 2.7 (UI)

Stub still asks 5 dims. The UI must not claim the other dims were asked.

1. **1.2 提问维**：书籍 → 右侧抽屉 → 新建主题 → 打开学习页会话。会话顶应看到 8 个引导维芯片（动机 / 终点表现 / 成功证据 / 先验 / 先修轻探 / 范围 / 深度 / 负荷）。stub 路径上动机、成功证据、先修、scope_in 标「未问」。占位符跟当前 `ask_boundary.kind` 对齐，不写「已问齐」。
2. **1.3 边界卡**：走完 5 问后等 `boundary_finalized`。学习页正文出现**独立边界卡**（不是书籍英雄卡 goal 行）。必填五行：`goal_outcome` / `prior_level` / `scope_out` / `depth` / `chunk_budget`；有值才展示动机、成功证据、先修、scope_in，缺则标缺口。未点「确认边界，看大纲」时回复「可以」会被拦住，不进大纲确认。确认后才出现大纲卡（objective / 先修 / 篇幅）。
3. **2.7 拒回流**：学习相位说一句踩 `scope_out` 的话（如排除「弦论」时说「顺便把弦论也讲一遍」）。应收到短拒 + 拉回当前节，`message.strategy=REFUSE_OFFSCOPE`，书籍笔记不增加。问当前节卡点则仍可 `append_note`。密钥只在「我的 → 模型代理」。客户端仍只订 7 个域名 SSE。

约定：不新增 `topic_updated` 等订阅。拒答信号走现有 `message.strategy`，不另开 domain event。
