# Deep Learn — 红 4 验收冻结 v0

> 作者：结野主税（产品）  
> 日期：2026-09-10  
> 基线：`main` @ `19ea37261588f29cef12a33534b6c0dc73433cb5`（红 3 已合）  
> 用户可见名：Deep Learn。Quantum 仅内部包名 / 路径。  
> 口径：Quantum 技术房 **FINAL**（覆盖此前 html/epub「至少一个真文件」的含糊说法）。

本文件冻结红 4 三条。后写实现必须对准，不得用黄项稀释。

---

## 过线（必须）

### 1. Coach：工具为真，不与 web 双写闸

- 相位 / 定稿 / 大纲 / 笔记 **只经工具** 落盘。Coach 不得先写 store 再假装走了工具。
- **确认 / 减叶不得与 web 双写**，也不得绕过与工具相同的闸，包括：
  - `@quantum/shared` 叶预算（`evaluateOutlineLeafBudget`）
  - 确认话术（`looksLikeOutlineConfirm` / `shouldDeferOutlineActionToCard`）
  - 定稿五必填（`goal_outcome` / `prior_level` / `scope_out` / `depth` / `chunk_budget`）
- 边界卡确认、大纲确认 / 减叶只走 **学习页闸 + shared**。真源仍是 **GET `/api/state`**（红 3）。
- Coach **不得**用会话「可以 / 减叶」旁路 `finalize_outline` 或砍叶。

| 闸 | 入口 | 工具 / 写入 |
|---|---|---|
| 边界卡确认 | `POST /api/topics/:id/confirm-boundary` | `boundaryConfirmed`（红 3） |
| 大纲确认 | `POST /api/topics/:id/confirm-outline` | `finalize_outline` |
| 减叶重拟 | `POST /api/topics/:id/reduce-outline` | `draft_outline` |

### 2. 导出不许假绿

- `md` **保持真下载**（写出文件 + `GET /api/exports/:topicId/:filename`）。
- **本闸 `html` 必须真正导出可用内容**：可打开，不是空壳（doctype + body + 主题/正文）。
- **`epub` 允许诚实桩 / 入口禁用**（灰掉或明确「未就绪」）。若仍提供入口，必须是可识别的真 zip，**不得假绿 / 空壳成功**；做不到则 `ok: false`。
- 当前实现：html 与 epub 都写真文件。epub **不是桩**。
- 红 1 路径安全保持：`requireTopic`、拒绝 `..` / 分隔符、realpath 不出 exports 根。无 `VITE_` 密钥。

### 3. 根测试

根目录 `pnpm test` 至少跑 **server + web**；本仓库同时跑 **shared**（便宜）。

---

## 本晚核对

- html 真文件能打开（GET 200，含标题与落盘正文）
- epub 入口诚实（真 zip，或灰掉 / 「未就绪」；当前为真 zip）
- 确认 / 减叶只有一条路：学习页卡 + 工具

---

## 黄（本闸不要折进来）

live/stub 双脑、`toClientMessages` 字段裁剪、docs v0.5 重写、热力图、大挪 App、产品改名。

---

## 仍为桩（明示）

- 无模型密钥时仍走 **本地 stub coach**（真工具循环；正文是脚手架，不是成书）。
- Me 页热力图文案键仍在，UI 已摘（红闸外）。
- live 模型提示词仍可能提到会话「可以」——本闸只锁 stub coach + web 闸。
- **`epub` 本闸不是桩**（冻结允许改成诚实禁用，未做）。
