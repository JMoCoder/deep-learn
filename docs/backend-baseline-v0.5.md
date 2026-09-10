# Deep Learn — 后端基线 v0.5

> 用户可见名：**Deep Learn**。内部包名 / 路径仍为 Quantum（`@quantum/shared`、`packages/server`、`QUANTUM_*`），**不改包名**。  
> **契约真源**：`packages/shared`（`src/tools.ts` · `src/tutor.ts` · `src/boundary.ts` · `src/events.ts` · `src/dto.ts` · `src/phases.ts`）+ `packages/server/src/tools/factory.ts`。  
> **冲突以 shared / factory 为准。** 本文是对照说明，不得另发明工具入参、闸门字段或策略名。  
> 装配器：`packages/server/src/agent/tutor-context.ts`（`build_tutor_context`，**不是** AgentTool）。  
> 旧英文稿 [`backend-baseline.md`](./backend-baseline.md) 已 superseded。core1 / core2 调研稿已标 historical。

核对日：2026-09-10 · 对照 `main` 实现，不另开合同。

---

## 0. 目标

把 Pi agent 主路径钉在**已实现**的工具入参、五必填闸、策略闭集与 `reason_code` 上，给前端事件订阅与产品验收同一份接口面。

非目标：黄包 UI 改动、改包名、新造 HTTP/工具字段。

---

## 1. 目录（现状，不是建仓草案）

```
packages/
  shared/src/          # 工具名、入参类型、TutorContext、事件、DTO
  server/src/
    tools/factory.ts   # Pi AgentTool 实现（入参 TypeBox = shared 类型）
    agent/tutor-context.ts
    learning/          # 五必填闸、笔记策略、大纲约束
  web/                 # PWA 投影（只订 CLIENT_SSE_EVENTS）
```

密钥只出现在 Settings 存储与 model 代理层，永不写入 Session 消息或工具参数。

---

## 2. 运行时不变量

| ID | 不变量 |
|----|--------|
| R1 | 同时仅一个 `current_topic_id`；学习投影与书籍正文/笔记共同绑定该 id |
| R2 | 主路径 = agent 会话 + tool-loop + 落盘；页面不直写正文 CRUD |
| R3 | 主页渲染优先读盘（`get_section` / `list_outline`），不依赖模型短期记忆 |
| R4 | Note 仅来自 AI `append_note`；导出不倾倒 Session 原文 |
| R5 | 模型 key 只经 Settings → model proxy |
| R6 | `build_tutor_context` 是内部装配，**不是**学习者工具 |

相位（`TOPIC_PHASES`）：

```
idle → boundary_interview → outline_draft → learning
         导出子态 EXPORT_SUBSTATES: idle | exporting | ready
```

`finalize_boundary` 是进入 `outline_draft` 的唯一工具路径。`finalize_outline` 是进入 `learning` 的唯一工具路径。缺五必填时 `finalize_boundary` **不改相位**。

---

## 3. 工具契约（`@quantum/shared` + factory）

错误细节走工具 `details`（如 `{ ok: false, missing }`）。成功落盘后发可订阅事件（§6）。下表入参与 `packages/shared/src/tools.ts` / `factory.ts` **逐字段对齐**。

### 3.1 `ask_boundary`

| | |
|--|--|
| 相位 | `boundary_interview` |
| 入参 | `{ kind: BoundaryKind, question: string, record_previous?: { kind: BoundaryKind, answer: string } }` |
| `BoundaryKind` | `goal` · `prior` · `time` · `depth` · `constraint` · `success` · `goal_outcome` · `prior_level` · `scope_out` · `chunk_budget` · `motivation` · `success_evidence` · `prior_known` · `prior_gaps` · `scope_in` · `time_budget` · `modality` |
| 副作用 | 记录问题；可写入上一问回答。**不**写边界终态 |

不是 `{ question_id, prompt, input_kind, choices }`。

### 3.2 `finalize_boundary`

| | |
|--|--|
| 相位 | `boundary_interview` → `outline_draft` |
| 入参 | `{ answers: Array<{ kind: BoundaryKind, question: string, answer: string }> }` |
| 成功 | `{ ok: true, snapshot: BoundarySnapshot }`；发 `boundary_finalized` + `phase_changed` |
| 拒绝 | 五必填缺任一 → `ok: false` + `missing`；**不改相位**。覆盖缺口 `unasked` 只作提示，**不是闸** |

不是 `{ answers: BoundarySnapshot, summary? }`。

#### 五必填闸（`FINALIZE_REQUIRED_FIELDS`）

`goal_outcome` · `prior_level` · `scope_out` · `depth` · `chunk_budget`

同一句（`FINALIZE_GATE_SENTENCE`）：`finalize_boundary 必填 goal_outcome / prior_level / scope_out / depth / chunk_budget；缺则 ok:false。`

八维（动机 / 终点 / 成功证据 / 先验 / 先修轻探 / 范围 / 深度 / 负荷）是**提问覆盖**，不是定稿硬门。kind 映射：`goal→goal_outcome` · `prior→prior_level` · `constraint→scope_out` · `time→chunk_budget`。

`BoundarySnapshot` 字段以 `packages/shared/src/tutor.ts` 为准（含 compat 别名 `success` / `first_gap` / `scaffold_pref`）。卡片必填行 / 可选行见 `BOUNDARY_REQUIRED_ROWS` / `BOUNDARY_OPTIONAL_ROWS`。

### 3.3 `draft_outline`

| | |
|--|--|
| 相位 | `outline_draft` 或 `learning` |
| 入参 | `{ title: string, nodes: OutlineDraftNode[] }` |
| `OutlineDraftNode` | `{ title, intent, objective?, depends_on?, target_chars?, children? }` |
| 拒绝 | `evaluateOutlineDraft` 失败（含叶预算）；超叶可先 trim 再评 |

不是 `{ based_on_boundary_version }`。

### 3.4 `finalize_outline`

| | |
|--|--|
| 相位 | `outline_draft` → `learning` |
| 入参 | `{ title?: string }` |
| 副作用 | 锁定**已落盘草稿**；发 `outline_finalized` |

不是 `{ outline, draft_version? }`。大纲确认走学习页卡 → `POST /api/topics/:id/confirm-outline` → 本工具。会话「可以」不是旁路。

### 3.5 `generate_section`

| | |
|--|--|
| 相位 | `learning` |
| 入参 | `{ outline_node_id: string, title: string, body_md: string }` |
| 拒绝 | 非 learning；踩排除区（本轮拒写无关节） |

不是 `{ section_id, regenerate? }`。

### 3.6 `get_section`

| | |
|--|--|
| 入参 | `{ outline_node_id: string }` |
| 副作用 | 无写盘；成功可读盘并挂本轮 citation |

不是 `{ section_id }`。

### 3.7 `list_outline`

| | |
|--|--|
| 入参 | `{}`（当前主题，无 `topic_id`） |
| 出参 | 大纲树 JSON（含 id，供 `generate_section`） |

### 3.8 `append_note`

| | |
|--|--|
| 入参 | `{ body: string, section_id?: string, reason_code: 1\|2\|3\|4 }` |
| 调用方 | **仅** agent tool-loop；无 UI「记一笔」 |
| 拒绝 | `reason_code` 非 1–4；空 body；`body` > `APPEND_NOTE_MAX_CHARS`（300）；踩排除区不记 |

`type`（思考 / 疑问 / 拓展）由 `reason_code` **派生**，不是入参。

#### `reason_code`（冻，数值不改名）

| Code | `NOTE_REASON_MEANING` | `Note.type` |
|------|------------------------|-------------|
| 1 | 稳定结论/心得 | 思考 |
| 2 | 可复查误解或未解 | 疑问 |
| 3 | 超 objective 旁支且用户想留 | 拓展 |
| 4 | 同题往返≥2 轮未解 | 疑问 |

`note_appended` 线上字段是 `note_type`（SSE `type` 已被事件名占用）+ 可选 `reason_code`。

### 3.9 `summarize_notes_for_export`

| | |
|--|--|
| 入参 | `{ max_chars?: number }`（默认 2000） |
| 副作用 | 只读压缩；不改原始 Note |

不是 `{ topic_id? }`。

### 3.10 `export_topic`

| | |
|--|--|
| 入参 | `{ format: "md" \| "html" \| "epub" }` |
| 触发 | 书籍历史卡导出弹窗 → `POST /api/topics/:id/export`（同工具写盘） |
| 拒绝 | `format` 不在闭集 |

不是 `{ topic_id, include_note_digest? }`。主题取当前会话主题。

---

## 3A. TutorContext（packer，非工具）

类型：`packages/shared/src/tutor.ts`。装配：`build_tutor_context(store, topicId, { includeL4? })`。默认 **L0–L3**；`includeL4: true` 才带近期笔记。禁止：整本 Session、全书 Section、API key、非 current 主题。

| 层 | 字段（shared） | 装配内容 |
|----|----------------|----------|
| L0 | `topicId`, `title`, `phase`, `exportState`, `coachMode`, `strategyHint` | 会话不变量 + 学习相位提示 |
| L1 | `snapshot`, `body`, `sectionId`, `title`, `truncated` | **BoundarySnapshot + 当前节读盘摘录**（无正文则 body 空） |
| L2 | `currentId`, `currentTitle`, `currentObjective`, `dependsOn`, `prevTitle`, `nextTitle`, `tree` | 大纲位置（压缩树，不是全书） |
| L3 | `sectionId`, `title`, `body`, `truncated` | 当前节再截一刀（与 L1.body 同源摘录） |
| L4 | `recentNotes[]` | **后置**；默认不装。无向量检索 |

产品旧口径「L0 = 边界摘要 + objective / L1 = 读盘」见 [`two-cores-acceptance-v0.md`](./two-cores-acceptance-v0.md) 对照表。以本表 / packer 为准。

### 策略闭集（`TUTOR_STRATEGIES`）

`PROBE` · `SCAFFOLD` · `GROUND` · `ELABORATE` · `CONTRAST` · `CHECK` · `REDIRECT` · `HOLD` · `ADVANCE` · `NOTEWORTHY` · `REFUSE_OFFSCOPE`

闭集在 shared；**开火规则不是验收科学**。拒 + 回流骑 `message.strategy`，**不新开** SSE 域名。手点文档不教枚举名。

默认 hint（packer `hintStrategy`，不是评分引擎）：访谈 `PROBE`；大纲起草 `SCAFFOLD`；学习有正文 `GROUND`，无正文 `SCAFFOLD`；其余 `HOLD`。

---

## 4. 落盘对象（DTO 最小集）

以 `packages/shared/src/dto.ts` / `phases.ts` 为准。

- **Topic**：`id`, `title`, `phase` ∈ `TOPIC_PHASES`, `exportState` ∈ `EXPORT_SUBSTATES`
- **OutlineNode**：`intent` + `objective` + `dependsOn` + `targetChars`；`status` ∈ `draft | finalized | generating | ready`
- **Section**：`outlineNodeId`, `bodyMd`
- **Note**：`body`, `reasonCode` 1–4, `type` 思考\|疑问\|拓展；`source` 仅 AI 工具
- **Settings**：`provider`, `modelId`, `baseUrl`, `hasApiKey`（公钥形状）；密钥不进聊天

全局：`AppSnapshot.currentTopicId`。学习闸：`boundaryConfirmed` / `boundaryFinalized`。

---

## 5. 事件流

`GET /api/session/events`。客户端**只订** `CLIENT_SSE_EVENTS`（7 个域名）：

`phase_changed` · `boundary_finalized` · `outline_finalized` · `section_status` · `section_ready` · `note_appended` · `export_ready`

运输层（非域名）：`session_start` / `session_end` / `text_delta` / `message` / `error`。  
`message` 可带 `strategy?` 与 `citations?: [{ section_id, note_id? }]`。  
`topic_updated` / `section_updated` / `outline_updated` / `tool_start` / `tool_end` 是服务端别名，**web 忽略**。

---

## 6. 前端投影（已实现，不另发明参）

对齐 IA 底栏：学习 / 书籍 / 我的。路径以 `packages/server/src/app.ts` 为准。

| 通道 | 作用 |
|------|------|
| `GET /api/state` | `AppSnapshot`（含 `currentTopicId`、闸） |
| `GET /api/topics/current/projection` | `TopicProjection`：`{ topic_title, section_title, section_id, outline, prereq_edges, phase }` |
| `POST /api/topics/:id/confirm-boundary` | 学习页边界卡确认（`boundaryConfirmed`） |
| `POST /api/topics/:id/confirm-outline` | 大纲卡确认 → `finalize_outline` |
| `POST /api/topics/:id/reduce-outline` | 大纲卡重拟 → `draft_outline` |
| `POST /api/topics/:id/export` | body `{ format?: "md"\|"html"\|"epub" }`（默认 md） |
| `POST /api/session/prompt` | `{ text }` |
| `GET/PUT /api/settings` | 模型偏好；响应脱敏 |

无 `POST /notes`。

---

## 7. 导出与模型代理

- `export_topic({ format })` 写盘后 `export_ready`：`{ topicId, format, filename, downloadPath }`
- `GET /api/exports/:topicId/:filename`：`requireTopic`，拒绝 `..` / 分隔符，realpath 不出 exports 根
- 设了 `QUANTUM_API_TOKEN` 时，除 `GET /api/health` 外 `/api/*` 要 Bearer 或 `X-Quantum-Token`
- 无 key：本地 coach 仍走**同一工具循环**

---

## 8. 本文不管

热力图统计口径、导出版式微调、向量 L4、大纲细粒度编辑交互、黄包 UI、改包名。
