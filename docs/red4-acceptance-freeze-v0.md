# Deep Learn — 红 4 验收冻结 v0

> 作者：结野主税（产品）  
> 日期：2026-09-10  
> 基线：`main` @ `19ea37261588f29cef12a33534b6c0dc73433cb5`（红 3 已合）  
> 用户可见名：Deep Learn。Quantum 仅内部包名 / 路径。

本文件冻结红 4 三条，后写实现必须对准，不得用黄项稀释。

---

## 过线（必须）

### 1. Coach 不抢闸、不抢投影

- 相位 / 定稿 / 大纲 / 笔记 **只经工具** 落盘：`ask_boundary` / `finalize_boundary` / `draft_outline` / `finalize_outline` / `generate_section` / `append_note` 等。Coach 不得先写 store 再假装走了工具。
- **边界卡确认**、**大纲确认 / 减叶** 只走 **学习页闸 + `@quantum/shared`**（`shouldShowBoundaryCard` / `shouldShowOutlineConfirm` / `evaluateOutlineLeafBudget` / `shouldDeferOutlineActionToCard`）。
- 真源仍是 **GET `/api/state`**（红 3）。Coach 不得把 storage 当确认真相。
- Coach **不得**另开一条会话「可以 / 减叶」旁路去 `finalize_outline` 或砍叶重拟，也不得覆盖 UI 闸。

HTTP 闸（与工具同 execute）：

| 闸 | 入口 | 工具 |
|---|---|---|
| 边界卡确认 | `POST /api/topics/:id/confirm-boundary` | 写 `boundaryConfirmed`（红 3） |
| 大纲确认 | `POST /api/topics/:id/confirm-outline` | `finalize_outline` |
| 减叶重拟 | `POST /api/topics/:id/reduce-outline` | `draft_outline` |

### 2. 导出不许假绿

- `md` **必须**写出文件，且 `GET /api/exports/:topicId/:filename` 能下载。
- `html` / `epub` 必须是可识别的真文件（html 含 doctype+body；epub 为 zip）。做不到则 **`ok: false`**，不得半成品成功 / 空壳。
- `POST /api/topics/:id/export` 在文件落盘前不得 `ok: true`。
- 红 1 路径安全保持：`requireTopic`、拒绝 `..` / 分隔符、realpath 不出 exports 根；token / loopback / CORS 不动。无 `VITE_` 密钥。

### 3. 根测试跑满包

根目录 `pnpm test` 必须覆盖 **`@quantum/shared` + `@quantum/server` + `@quantum/web`**，不得只跑 server。

---

## 黄（本闸不要折进来）

live/stub 双脑、`toClientMessages` 字段裁剪、docs v0.5 重写、热力图、大挪 App、产品改名。

---

## 仍为桩（明示）

- 无模型密钥时仍走 **本地 stub coach**（真工具循环；正文是脚手架，不是成书）。
- Me 页热力图文案键仍在，UI 已摘（红闸外）。
- live 模型提示词仍可能提到会话「可以」——本闸只锁 stub coach + web 闸，不改双脑提示。
