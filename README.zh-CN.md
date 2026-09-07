# Quantum

本地终身学习 Agent：从访谈 → 边界卡 → 大纲 → 落地笔记。

架构是 **会话 + 工具 + 持久化**，不是 CRUD 页。运行时：`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`。

两个核心：

1. **Agent 运行时** — 服务端 Pi coding-agent SDK（`packages/server`）。工具、会话、SQLite。
2. **PWA** — Vite + React（`packages/web`）。对话、选项、边界卡、大纲确认、笔记。

共享 TypeScript 契约在 `packages/shared`。

没有云、没有账号、没有遥测。数据只在 Docker volume `quantum-data`。

English: [README.md](./README.md).

## 验收地址

Docker Compose 是唯一支持的预览路径。`docker compose up --build` 之后打开：

**http://127.0.0.1:43127**

| 面 | URL |
| --- | --- |
| PWA | `http://127.0.0.1:43127` |
| API / health | `http://127.0.0.1:43128/api/health` |

不要把 `pnpm --filter @quantum/web dev` 当成验收。

SQLite 和导出在 `quantum-data`（容器内 `QUANTUM_DATA_DIR=/data`）。`Ctrl+C` 或 `docker compose down` 停止。volume 在 `down` 后仍在；要清空用 `docker compose down -v`。

## 安装

需要 Docker Engine 和 Compose 插件。

```bash
git clone <this-repo>
cd deep-learn
docker compose up --build
```

首次启动会拉运行时镜像并创建 `quantum-data`。`:43127` 能打开 PWA、`:43128/api/health` 返回 `{"ok":true,"name":"quantum",...}` 即就绪。

Compose 服务：`server`（Hono `:43128`，同时发布 PWA `:43127` → `:80`）和 `web`（nginx + 构建后的 PWA）。`web` 使用 `network_mode: service:server`，因此 `/api` 与 SSE 在 PWA 同源代理到 `127.0.0.1:43128`。

### 本地开发（可选）

```bash
corepack enable
pnpm install
pnpm --filter @quantum/shared build
pnpm --filter @quantum/server build
pnpm --filter @quantum/server start
# 另一个终端
pnpm --filter @quantum/web dev
```

Web 单测（不调模型、不跑 Docker）：

```bash
pnpm --filter @quantum/web test
pnpm --filter @quantum/web build
```

## 架构

```
packages/shared   工具名、事件、DTO
packages/server   Pi agent、工具、SQLite、SSE、导出
packages/web      PWA（学习 / 书籍 / 我的）
docs/             IA、后端基线、core1/core2、验收
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

### 学习

访谈选项 → **边界卡**（用户确认）→ **大纲确认**（叶子数须落在负荷预算内）→ 对话 + GROUND 笔记。命中 `scope_out` 是 **REFUSE**：该轮不出现笔记卡、不出现 CiteRow。

顶栏：主题·章节。左抽屉 = 大纲。右抽屉 = 会话。正文里没有输入框。

### 书籍

当前主题英雄卡（没有页面大标题）。主题抽屉从右侧打开。第一张卡 = **新建主题**（`POST /api/topics` —— 遮罩不会抢走点击）。历史 = 切换 + 导出（`md | html | epub`，走 `export_topic`）。笔记只读，没有「记一笔」。

### 我的（设置）

模型代理和占位热力图。**界面语言**（`中文` / `English`）只切换 PWA 壳层文案。

- 首次访问：跟随浏览器语言（`en*` → English，`zh*` → 中文）。其它情况回落 zh-CN。
- 选定之后存在 `localStorage`（`quantum.locale`）。

Agent **没有**单独的语言开关。回复跟随用户输入的语言。界面开关不会往模型 prompt 里塞强制 locale。

服务端 API 没有 locale 字段。Stub / 教练话术跟用户输入语种；PWA 空态和壳层由前端翻译。**不需要服务端 locale。**

## 模型代理（密钥）

打开 **我的 → 模型代理**，或在 Compose 里传入：

- `QUANTUM_MODEL_PROVIDER`
- `QUANTUM_MODEL_ID`
- `QUANTUM_MODEL_BASE_URL`（OpenAI 兼容代理）
- `QUANTUM_MODEL_API_KEY`

密钥只在 SQLite（`/data/quantum.db`）。不会写入对话、SSE、日志或工具参数。没有密钥时，本地 stub 教练仍跑真实工具循环。

## 产品规则

- 只在本地。运行时不外呼。
- `scope_in` / `scope_out` 保持用户原文。
- 笔记属于当前主题。该轮越界时 REFUSE 优先于 GROUND。

## 两个核心的简要验收

1. PWA → **书籍** → 右侧抽屉 → **新建主题**。Stub 走满八维（动机 → 终点 → 成功证据 → 先验 → 先修 → scope_in → 排除 → 深度 → 负荷）。
2. `boundary_finalized` 之后，在学习页确认独立边界卡，再确认大纲，进入 `learning`。
3. 会话追问应有 `message.strategy` + `citations[]`。笔记只来自 `append_note`。
4. 书籍导出 `md | html | epub`，应收到 `export_ready`。
5. 学习相位踩 `scope_out`（例如排除「弦论」后再让它讲弦论）→ `REFUSE_OFFSCOPE`，不写笔记。

手点路径：`docs/hand-click-five-steps.md`。IA：`docs/IA-agent-v1.md`。双核：`docs/cores.md`。

## 许可证

[MIT](./LICENSE) — Copyright (c) 2026 Jiamo.

## 变更记录

见 [CHANGELOG.md](./CHANGELOG.md)。
