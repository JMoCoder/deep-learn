# Quantum — 后端基线草稿 v0.5

> 依据：`IA-agent-v1.md`（**v1.3.1** + core1/core2 调研草稿）  
> 约束（CTO 2026-09-06）：全栈闸过后再建仓；本阶段**只定契约/目录草案**，不写业务代码、不接真模型密钥。  
> 作者：服部全藏（后端）  
> 修订（2026-09-06）：对齐 IA v1.1——底栏学习/书籍/我的；`append_note` **仅 AI 会话 tool-loop 调用**，取消用户/UI「记一笔」入口。  
> 修订（2026-09-06 v0.2）：对齐 IA v1.2——学习投影顶栏左大纲/中「主题·章节」/右会话抽屉；内容区无会话入口；书籍页管切换·新建·历史，正文/笔记只跟 `current_topic_id`。  
> 修订（2026-09-06 v0.3）：对齐 IA v1.3——书籍主题操作收进侧栏卡（首卡新建，历史卡切换/导出）；`export_topic(format∈{md,html,epub})` 取代单一 epub；`summarize_notes_for_export` 泛化。
> 修订（2026-09-06 v0.4）：收核心①——`boundary_snapshot` 字段 schema、必填校验、`OutlineNode.objective/depends_on/target_chars`、`boundary_finalized` 后边界卡闸。
> 修订（2026-09-06 v0.5）：收核心②——`TutorContext` L0–L4、策略枚举、`append_note.reason_code`、读盘锚定；内部 `build_tutor_context`。

---

## 0. 目标与非目标

**目标**
- 把 Pi agent 主路径落到可对接的工具契约与落盘边界
- 给前端（事件流订阅）与产品（闸门验收）一份可拍板的接口面

**非目标（本阶段不做）**
- 建 Git/Origin 仓、clone、脚手架业务实现
- 接入真实 provider key / 真实计费
- 定死 SQL 表结构或 ORM
- 替代产品对问卷题库、大纲编辑粒度、热力图、EPUB 样式的拍板

---

## 1. 目录草案（建仓后建议布局）

单仓 monorepo 倾向（前后端同仓，便于事件类型共享）：

```
quantum/
  packages/
    shared/                 # 工具名、事件名、落盘 DTO（前后端共用类型）
      src/
        tools.ts            # 工具名常量 + JSON Schema / Zod
        events.ts           # Pi 事件与 UI 投影事件
        models.ts           # Topic/Section/Note/Session/Settings 逻辑类型
    server/                 # 后端运行时
      src/
        runtime/            # Pi AgentSession 壳、单路 current_topic
        tools/              # 各 AgentTool 实现（闸后）
        store/              # 落盘适配（fs / sqlite 等，闸后选型）
        model/              # 模型代理：读 Settings，禁 key 进会话
        api/                # HTTP/SSE：会话、设置、导出触发
        export/             # md/html/epub 装配（闸后）
    web/                    # PWA（前端条线）
  docs/
    IA-agent-v1.md
    backend-baseline-v0.md  # 本文件
```

说明：
- `shared` 先冻结工具名与 DTO，避免前后端各说各话
- `server/runtime` 强制：全局至多一个 `current_topic_id` 活跃会话
- 密钥只出现在 `Settings` 存储与 `model` 代理层，永不写入 Session 消息

---

## 2. 运行时不变量

| ID | 不变量 |
|----|--------|
| R1 | 同时仅一个 `current_topic_id`；切换 = 暂停/卸载旧会话上下文，加载新主题；**学习投影与书籍正文/笔记共同绑定该 id** |
| R2 | 主路径 = agent 会话 + tool-loop + 落盘；页面不直写正文 CRUD |
| R3 | 主页渲染优先读盘（`get_section` / `list_outline`），不依赖模型短期记忆 |
| R4 | 聊天轨迹（Session）与笔记（Note）分流；Note 仅来自 AI `append_note`；EPUB 不倾倒 Session 原文 |
| R5 | 模型 key 只经 Settings → model proxy；禁止出现在聊天、日志明文、工具参数 |

会话相位（建议显式状态机，便于 UI 闸）：

```
idle
  → boundary_interview   (ask_boundary* → finalize_boundary)
  → outline_draft        (draft_outline* → finalize_outline)
  → learning             (generate_section / get_* / append_note / chat)
  → exporting            (summarize_notes_for_export → export_topic)  # 可与 learning 重叠为子态；由书籍主题卡 UI 触发
```

非法跳转（如未 finalize_boundary 就 generate_section）由 runtime 拒绝，工具返回结构化错误。

---

## 3. 工具契约（Pi AgentTool）

约定：
- 名称先锁示意名（与 IA 一致）；实现闸后再动
- 入参/出参为 JSON 对象；错误统一 `{ ok: false, code, message }`
- 凡「落盘」工具成功后，必须发出可订阅事件（见 §5），便于 UI 刷新

### 3.1 `ask_boundary`

| | |
|--|--|
| 相位 | `boundary_interview` |
| 入参 | `{ question_id?: string, prompt: string, input_kind?: "text"\|"choice"\|"multi", choices?: string[] }` |
| 出参 | `{ ok: true, turn_id: string, presented: {...} }` |
| 副作用 | 可选：问卷轮次写入 Session；**不**写 Topic.boundary 终态 |
| 备注 | 默认题序见 core1 §3.1（动机→终点→证据→先验→先修轻探→范围→深度负荷→确认）；可增删但不得缺维度 |

### 3.2 `finalize_boundary`

| | |
|--|--|
| 相位 | `boundary_interview` → `outline_draft` |
| 入参 | `{ answers: BoundarySnapshot, summary?: string }` |
| 出参 | `{ ok: true, topic_id: string, boundary_version: number, boundary_snapshot: BoundarySnapshot }` |
| 副作用 | 落盘 `Topic.boundary_snapshot`；相位推进；发 `boundary_finalized`（UI 先展边界卡再进大纲） |
| 拒绝 | 缺必填：`goal_outcome`, `prior_level`, `scope_out`, `depth`, `chunk_budget` |

#### `BoundarySnapshot`（核心①锁字段）

| 字段 | 必填(首迭代) | 含义 |
|------|-------------|------|
| `goal_outcome` | ✓ | 学完能做什么（1–3 条可观察表现） |
| `success_evidence` | | 怎么自证学会 |
| `prior_level` | ✓ | 零基础 / 听说过 / 用过皮毛 / 能独立做 |
| `prior_known` | | 已知概念清单 |
| `prior_gaps` | | 已知缺口 |
| `scope_in` / `scope_out` | `scope_out`✓ | 包含 / 排除硬边界 |
| `depth` | ✓ | 直觉 / 能讲清 / 能动手 / 能教人 |
| `time_budget` | | 总时长或周投入 |
| `chunk_budget` | ✓ | 单节字数或单次分钟（认知负荷） |
| `modality` | | 叙述/例题/对照/伪代码… |
| `motivation` | | 场景动机 |

### 3.3 `draft_outline`

| | |
|--|--|
| 相位 | `outline_draft` |
| 入参 | `{ based_on_boundary_version: number }` |
| 出参 | `{ ok: true, outline_draft: OutlineNode[], draft_version: number }` |
| 副作用 | 可暂存草稿到 Topic（未确认）；不进「已确认大纲」 |
| 生成约束 | 叶节点对齐 goal_outcome；`depends_on` 先修拓扑；难度梯度；`target_chars`≤chunk_budget；硬过滤 scope_out（core1 §4） |
| 反模式 | 无先修边、无视负荷、先列章节再倒推目标 → 产品验收拦 |
| OutlineNode | `{ id, title, children?, objective?, depends_on?: string[], target_chars? }`；生成须尊重边界先修/深度/scope_out/chunk_budget（见 core1 §4） |

### 3.4 `finalize_outline`

| | |
|--|--|
| 相位 | `outline_draft` → `learning` |
| 入参 | `{ outline: OutlineNode[], draft_version?: number }` |
| 出参 | `{ ok: true, outline_version: number, section_ids: string[] }` |
| 副作用 | 落盘 `Topic.outline_snapshot`；为每叶节点创建 `Section`（status=`pending`） |

### 3.5 `generate_section`

| | |
|--|--|
| 相位 | `learning` |
| 入参 | `{ section_id: string, regenerate?: boolean }` |
| 出参 | `{ ok: true, section_id: string, status: "ready", char_count: number }` |
| 副作用 | Section.status: `pending`→`generating`→`ready`（失败→`failed`）；正文落盘 |
| 事件 | 生成过程可流式 `message_update`；落盘完成发 `section_ready` |
| 拒绝 | 非 current topic；outline 未 finalize；并发双节生成（v0 建议串行） |

### 3.6 `get_section`

| | |
|--|--|
| 入参 | `{ section_id: string }` |
| 出参 | `{ ok: true, section: { id, title, status, body_md?, char_count? } }` |
| 副作用 | 无（纯读）；书籍侧调用须落在 `current_topic_id` 下 |

### 3.7 `list_outline`

| | |
|--|--|
| 入参 | `{ topic_id?: string }`（默认 current） |
| 出参 | `{ ok: true, outline_version, nodes: Array<OutlineNode & { section_id?, status? }> }` |
| 副作用 | 无；供学习顶栏左抽屉与书籍当前主题过滤；进度以此为准 |

### 3.8 `append_note`

| | |
|--|--|
| 相位 | `learning`（导出前也可） |
| 入参 | `{ type: "疑问"\|"思考"\|"拓展", body: string, section_id?: string }` |
| 出参 | `{ ok: true, note_id: string, reason_code?: 1\|2\|3\|4 }` |
| 调用方 | **仅** Pi agent 在**右侧会话抽屉** tool-loop 中调用；**禁止** UI/用户直触发同工具 |
| 副作用 | 落盘 Note（来源=AI tool call）；**不是**把整段聊天贴进笔记；建议 body ≤300 字 |
| 启发式 reason_code | 1=稳定结论/心得；2=可复查误解或未解；3=超 objective 旁支且用户想留；4=同题往返≥2 轮未解 |
| 拒绝 | 非 agent tool-loop；整段对话拷贝 |

### 3.9 `summarize_notes_for_export`

| | |
|--|--|
| 入参 | `{ topic_id?: string }`（默认导出目标主题；可非 current） |
| 出参 | `{ ok: true, digest_md: string, note_ids: string[] }` |
| 副作用 | 可选缓存 digest；不改原始 Note；**禁止**直接拷贝 Session 原文 |
| 备注 | 由 `export_topic` 内部调用或先行调用；原名 `summarize_notes_for_epub` 已废止 |

### 3.10 `export_topic`

| | |
|--|--|
| 触发 | **书籍侧栏历史主题卡「导出」** → UI 弹窗三选一后调用（非学习内容区、非顶栏独立按钮） |
| 入参 | `{ topic_id: string, format: "md"|"html"|"epub", include_note_digest?: boolean }` |
| 出参 | `{ ok: true, format, artifact_path: string, mime: string, bytes: number }` |
| 副作用 | 生成对应格式产物（正文 sections + 笔记 digest）；版式细节产品待定 |
| 拒绝 | `format` 不在 `{md,html,epub}`；主题不存在 |
| 备注 | 取代原 `export_epub`；三格式共用同一工具入口 |

---

## 3A. 学习辅导运行时（核心② · TutorContext）

内部装配（**可不暴露为 AgentTool**）：每次用户在学习会话发言前由 runtime 调用 `build_tutor_context`。

### TutorContext

```
{
  topic_id, section_id, phase,
  boundary_digest,          // BoundarySnapshot 压缩
  section_objective,
  section_excerpts[],       // 读盘片段（可截断并标注）
  recent_notes[],           // 默认本节约 5 条
  dialog_tail[],            // 最近 K 轮，默认 8
  dialog_summary?,          // 更早轮摘要
  learner_state?            // understood|confused|asking_answer|wants_example…
}
```

### 上下文分层（强制）

| 层 | 内容 | 何时 |
|----|------|------|
| L0 | topic/phase/边界摘要/section_id+objective | 每轮必带 |
| L1 | 当前节读盘片段 + 前后叶标题 | 学习相位；超长截断 |
| L2 | 近期 Note | 有笔记时 |
| L3 | dialog_tail + summary | 每轮 |
| L4 | 他节点查 / 向量 | 首迭代可后置 |

**禁止**：整本 Session、全书 Section、API key、非 current 主题进窗。

### 对话策略枚举（系统提示契约）

`PROBE` | `SCAFFOLD` | `GROUND` | `ADVANCE` | `NOTEWORTHY` | `REFUSE_OFFSCOPE`

- `GROUND`：优先 L1 读盘再答；可带 `citations: [{section_id, note_id?}]`
- `NOTEWORTHY`：答的同时 `append_note`
- `REFUSE_OFFSCOPE`：踩 `scope_out` 拒并回流
- 未生成节：不假装已读盘；引导 `generate_section`
- 首迭代闲聊**不默改大纲**；改计划引导回边界/大纲流

### UI 运行时备注

学习会话抽屉与书籍主题侧栏均为右侧；**同时只开一个右抽屉**（实现互斥即可）。

---

## 4. 落盘对象（逻辑模型）

仍非表定稿；字段为契约最小集。

### Topic
```
id, title?,
status: idle|boundary|outline|learning|done,
boundary_snapshot?: BoundarySnapshot, boundary_version?,
outline_snapshot?, outline_version?,
created_at, updated_at
```

### Section
```
id, topic_id, outline_node_id, title,
status: pending|generating|ready|failed,
body_md?, char_count?,
error_message?, updated_at
```

### Note
```
id, topic_id, section_id?,
type: 疑问|思考|拓展,
body, created_at,
source: "ai_tool"   # 仅 AI append_note；无 user_manual
```

### Session
```
id, topic_id, phase,
messages[] | pi_transcript_ref,  # 实现闸后选型
updated_at
```

### Settings
```
provider, model,
api_key_ref,          # 引用/密槽位，不进聊天
prefs...
```

全局：`AppState.current_topic_id: string | null`

---

## 5. 事件流（UI 订阅）

对齐 Pi：`message_update` / `tool_execution_*`。另建议投影事件（可由 server 转发）：

| 事件 | 何时 | UI 用途 |
|------|------|---------|
| `phase_changed` | 相位迁移 | 换引导文案/控件 |
| `boundary_finalized` | finalize_boundary 成功 | 先展边界卡，用户确认后再进大纲确认 |
| `outline_finalized` | finalize_outline 成功 | 侧栏树就绪 |
| `section_status` | generating/ready/failed | 进度点 |
| `section_ready` | 正文落盘 | 中央区刷新读盘 |
| `note_appended` | append_note | 笔记列表 |
| `export_ready` | export_topic 成功 | 下载入口（带 format） |

原则：进度以落盘为准；刷新后用 `list_outline` + `get_section` 恢复，不靠内存。

---

## 6. 模型代理（闸后实现要点）

- 唯一出口：`model/proxy` 读 Settings，构造 pi-ai 客户端
- Session / 工具参数 / 普通日志：禁止出现 key
- 本阶段：可用 fake/mock provider 占位，**禁止**要求用户贴 key 进聊天

---

## 7. 与前端契约面（最小）

对齐 IA v1.3 底栏：**学习 / 书籍 / 我的**。

### 7.1 学习页投影（顶栏 + 内容区）

| UI 槽位 | 数据 / 通道 | 说明 |
|---------|-------------|------|
| 顶栏中：「主题·章节」 | `GET /topics/current/projection` → `{ topic_title, section_title, section_id, … }` | 标题居中；无当前主题时为空态文案 |
| 顶栏左：大纲抽屉 | 同 projection 内 `outline` / 或 `list_outline` | 选节 → 可触发 `generate_section`（经 agent）或仅切换当前节读盘 |
| 顶栏右：会话抽屉 | `SSE/WS /sessions/:id/events` | **唯一**会话入口；内容区**禁止**再放会话入口 |
| 中央内容区 | projection.current_section.body（读盘） | 仅正文；空态引导去**书籍**新建/切换 |

`GET /topics/current/projection` 建议最小形状：
```
{
  topic_id, topic_title,
  section_id, section_title, section_status, body_md?,
  outline: [{ id, title, status, … }],
  phase
}
```

### 7.2 书籍页（侧栏主题卡 + 当前主题资产）

主题操作**只在侧栏卡片**；书籍顶栏/主区**禁止**再挂独立「新建」「导出」。

| UI / API | 作用 |
|----------|------|
| 侧栏**首卡「新建主题」** | 启动 boundary 会话（侧开，非表单页） |
| 侧栏**历史主题卡「切换」** | `POST /topics/:id/activate` → 设 `current_topic_id`；学习投影与书籍正文/笔记一并换绑 |
| 侧栏**历史主题卡「导出」** | UI 弹窗选 `md` / `html` / `epub` → `POST /topics/:id/export` body `{ format }` → 服务端走 `export_topic` |
| 主区若保留「切换」文案 | 仅打开上述主题侧栏，与侧栏一致（原「历史主题」改名） |
| `GET /topics` | 侧栏历史卡数据源 |
| `GET /sections?topic_id=current` / `GET /notes?topic_id=current` | **只返回当前主题**；切换后两列表同步过滤，禁止混显 |

### 7.3 我的 / 其它

| API / 通道 | 作用 |
|------------|------|
| `GET/PUT /settings` | 模型偏好；key 走安全写入，响应脱敏 |
| ~~UI「记一笔」~~ / ~~内容区会话入口~~ | **已取消** |

（路径名为草案，可随原型调整；语义先锁。）

---

## 8. 待产品 / 待闸事项（不挡本草稿）

- 边界问卷默认题库文案与可增删交互（字段 schema 已由 core1 收口；文案可迭代）
- 大纲用户可编辑粒度（树节点增删改是否经工具）
- 热力图统计口径
- 各导出格式的版式细节（md/html/epub 目录与笔记呈现）
- 是否允许学习中并行 generate 多节（v0 建议否）
- AI 触发 `append_note` 的启发式已默认（core2 §4.2）；文案/频率微调可迭代

---

## 9. 本阶段交付清单

- [x] 本文件：工具契约 + 目录草案 + 不变量（v0.5 收核心①+②）
- [x] 原型闸已过；全栈建仓进行中（CTO）
- [x] 核心② `TutorContext` / 策略枚举 / append_note.reason_code 已收
- [ ] 产品补题库文案/大纲编辑粒度/导出版式后：再修订小版本
