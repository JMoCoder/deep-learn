# Quantum

Agent-driven lifelong-learning PWA. Architecture is **session + tools + persistence**, not CRUD pages.

Runtime: `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai` (not DeepSeek Harness).

Chinese UI. One `current_topic_id` at a time. Notes exist only via tool `append_note` (`reason_code` 1–4 → 思考/疑问/拓展).

## v1 acceptance (Docker only)

Requires a working Docker Engine + Compose plugin. This is the only supported way to start the preview.

```bash
docker compose up --build
```

- PWA: http://127.0.0.1:43127
- API (health): http://127.0.0.1:43128/api/health

SQLite and exports live in the named volume `quantum-data` (`QUANTUM_DATA_DIR=/data` in the server container). Stop with `Ctrl+C` or `docker compose down`. The volume survives `down`; wipe it with `docker compose down -v`.

Optional model proxy: set `QUANTUM_MODEL_*` in a compose `environment:` block, or use **我的 → 模型代理** after start. **Do not commit keys.** Without a key, the local coach still runs the real tool loop.

### Verify two cores (brief)

1. Open the PWA → **书籍** → 右侧抽屉 → **新建主题**. Stub walks 8 维（动机 → 终点 → 成功证据 → 先验 → 先修 → scope_in → 排除 → 深度 → 负荷）.
2. After `boundary_finalized`，学习页确认独立边界卡，再确认大纲，进入 `learning`。
3. 右栏追问：应有 `message.strategy` + `citations[]`；笔记只来自 `append_note`（书籍页只读，无「记一笔」）。
4. 书籍导出 `md | html | epub` 之一；应收到 `export_ready`。
5. 学习相位踩 `scope_out`（如排除「弦论」时说「顺便把弦论也讲一遍」）→ `REFUSE_OFFSCOPE`，不写笔记。

`curl -sS http://127.0.0.1:43128/api/health` should return `{"ok":true,"name":"quantum",...}`.

Compose services: `web` (nginx + built PWA, `:43127` → container `:80`) and `server` (Hono, `:43128`). `/api` is proxied from the PWA origin. Tailscale is out of scope.

## Packages

```
packages/shared   tool names, events, DTOs
packages/server   Pi agent, tools, SQLite, SSE, export
packages/web      PWA (学习 / 书籍 / 我的)
docs/             IA v1.3.2, backend v0.5, core1/core2 research, acceptance
```

## Model proxy (keys)

Open **我的 → 模型代理**, or pass through compose:

- `QUANTUM_MODEL_PROVIDER`
- `QUANTUM_MODEL_ID`
- `QUANTUM_MODEL_BASE_URL` (OpenAI-compatible proxy)
- `QUANTUM_MODEL_API_KEY`

Keys stay in SQLite (`/data/quantum.db` in the volume). They are never written to chat, SSE, logs, or tool arguments.

## IA

Bottom tabs: **学习 / 书籍 / 我的**.

- 学习: content projection. Top bar `主题·章节`. Left = outline. Right = session. No composer in the body.
- 书籍: **current-topic hero only** (no page title「书籍」). Topic drawer from the RIGHT. First card = 新建主题. History = 切换 + 导出 (`md | html | epub` via `export_topic`).
- 我的: settings + heatmap placeholder.

See `docs/IA-agent-v1.md` (v1.3.2), `docs/backend-baseline.md` (v0.5), `docs/cores.md` → core1 / core2 / acceptance.
Static IA click-through: `packages/web/public/prototype.html`.

## Tests (repo / CI)

Not the v1 start path. Inside a checkout or CI job:

```bash
pnpm test
pnpm --filter @quantum/web build
```

### Retest 1.2 / 1.3 / 2.7 (UI)

Stub walks the 8 interview dims. The UI must not claim unasked dims are complete.

1. **1.2 提问维**：书籍 → 右侧抽屉 → 新建主题 → 打开学习页会话。会话顶 8 个引导维芯片。stub 题序：动机 → 终点 → 成功证据 → 先验 → 先修 → scope_in → 排除 → 深度 → 负荷。每问一维，对应芯片从「未问」变为「在问」，答完变「已答」。走完后 8 维都能到「已问 / 已答」；没问到的维保持未问。边界卡上已问到的缺维会随作答消失。
2. **1.3 边界卡**：走完访谈后等 `boundary_finalized`。学习页正文出现**独立边界卡**（不是书籍英雄卡 goal 行）。必填五行：`goal_outcome` / `prior_level` / `scope_out` / `depth` / `chunk_budget`；有值才展示动机、成功证据、先修、scope_in，缺则标缺口。未点「确认边界，看大纲」时回复「可以」会被拦住，不进大纲确认。确认后才出现大纲卡（objective / 先修 / 篇幅）。
3. **2.7 拒回流**：学习相位说一句踩 `scope_out` 的话（如排除「弦论」时说「顺便把弦论也讲一遍」）。应收到短拒 + 拉回当前节，`message.strategy=REFUSE_OFFSCOPE`，书籍笔记不增加。问当前节卡点则仍可 `append_note`。密钥只在「我的 → 模型代理」。客户端仍只订 7 个域名 SSE。

约定：不新增 `topic_updated` 等订阅。拒答信号走现有 `message.strategy`，不另开 domain event。
