# Quantum 核心② — 侧栏 AI 交互：专业调研草稿 v0

> **Historical.** 调研底稿。文中 L0–L4 / 策略六枚举是当时草案，**已过时**。分层真源是 packer `TutorContext`（见 [`two-cores-acceptance-v0.md`](./two-cores-acceptance-v0.md) 对照表）；策略闭集与工具入参以 `@quantum/shared` 为准。用户可见名：**Deep Learn**。  
> 作者：结野主税（产品）  
> 日期：2026-09-06  
> 状态：historical（首迭代输入；非正式定稿）  
> 依据：用户锁定两核之②；衔接核心① `core1-onboarding-research-v0.md`；对齐当时 IA / 基线  
> 非目标：不写业务代码；不重做①的边界/大纲口径

---

## 0. 问题陈述

侧栏 AI 不是通用聊天窗，而是 **绑在「当前主题·当前节」上的辅导会话**：要会装上下文、会有效交互、会跟正文/笔记联动。  
成功标准：用户追问时，回答 **锚定已落盘正文与边界**，该沉淀时调 `append_note`，不把 Session 倾成笔记，也不脱离大纲乱跑。

与①的分工：①决定「学什么顺序」；②决定「学这一节时怎么聊、聊什么进笔记」。

---

## 1. 专业底座（可核对来源）

### 1.1 证据→决策→反馈（EDF / 自适应脚手架）

教学 agent 宜拆三环，而不是「一问一答生成器」：

1. **Evidence**：从用户本轮话 + 当前节掌握迹象推断状态（理解/误解/要答案/要例子…）  
2. **Decision**：选对话策略（追问澄清 / 给脚手架 / 推进一步 / 指回正文…），落在最近发展区，避免过度代做  
3. **Feedback**：用自然语言执行策略，并留下可解释依据（引用哪段正文/哪条笔记）

参考：[EDF / adaptive scaffolding for LLM agents](https://arxiv.org/abs/2602.01415)

### 1.2 计划引导 + 评估驱动记忆（ScaffoldLM 类）

多轮辅导要有 **稳定骨架**（对本产品 = 当前节 objective + 大纲依赖）+ **评估驱动记忆**（本节是否达成目标、卡在哪）。  
不是把全历史原文塞进窗口，而是维护紧凑的「辅导状态」。

参考：[ScaffoldLM / planning-guided tutoring](https://aclanthology.org/2026.acl-long.325/)

### 1.3 课程内容接地（RAG / 读盘优先）

教育场景应答应 ** grounding 在本课材料**，降低幻觉、保证与大纲一致。  
Quantum 首迭代：**读盘优先**（`get_section` / 边界 / 近期 Note），向量检索可后置；禁止「无视落盘正文空口讲另一套」。

参考方向：课程 RAG 辅导（如 LEA、KG-RAG 一类工作）——原则是 grounding，不是必须首迭代上向量库。

---

## 2. 上下文怎么装（Context Pack）

### 2.1 分层（强制）

| 层 | 内容 | 何时进模型 |
|----|------|------------|
| L0 不变量 | `current_topic_id`、phase、`boundary_snapshot` 摘要、当前 `section_id` + `objective` | **每轮必带**（压缩） |
| L1 读盘锚 | 当前节 `body_md`（可截断：首段+与问句相关片段）；`list_outline` 中当前节前后各 1 叶标题 | 学习相位每轮；超长则截断并标注「已截断」 |
| L2 笔记 | 本主题本节约最近 N 条 Note（默认 N=5）；类型+摘要 | 有笔记时 |
| L3 会话 | 最近 K 轮对话（默认 K=8）；更早的只留滚动摘要 | 每轮 |
| L4 检索（后置） | 向量召回其他已落盘节 | 首迭代可不做；问「和上一章关系」时可用 `get_section(other_id)` 点查 |

**禁止**：把整本 Session、全书所有 Section、原始 API key、无关主题塞进上下文。

### 2.2 运行时对象（建议契约）

```
TutorContext {
  topic_id, section_id, phase,
  boundary_digest,          // 压缩后的边界卡
  section_objective,
  section_excerpts[],       // 读盘片段
  recent_notes[],
  dialog_tail[],            // 最近 K 轮
  dialog_summary?,          // 更早轮摘要
  learner_state?            // 可选：understood|confused|asking_answer|wants_example…
}
```

由 runtime 在每次用户发言前装配；工具成功后刷新 L1/L2。

---

## 3. 如何与用户有效交互

### 3.1 对话策略枚举（产品可验）

| 策略 | 何时 | 行为要点 |
|------|------|----------|
| `PROBE` | 用户要直接答案 / 表述含混 | 先反问或出微题，不直接倾倒答案 |
| `SCAFFOLD` | 卡住但有部分理解 | 给台阶、类比、对照当前正文片段 |
| `GROUND` | 问题可用正文回答 | **先引用/复述落盘要点**，再补充 |
| `ADVANCE` | 本节 objective 已达 | 建议生成/进入下一节（经工具），或深化拓展 |
| `NOTEWORTHY` | 出现可沉淀洞见/误区/拓展 | 回答同时 `append_note` |
| `REFUSE_OFFSCOPE` | 踩 `scope_out` | 明确边界，给回流路径 |

首迭代可在系统提示 + 轻量分类里实现，不必上完整 ITS。

### 3.2 交互反模式（验收要拦）

- 无视当前节正文，另起炉灶讲一套  
- 用户一问就长文终局答案，无脚手架、无反问  
- 把整段聊天贴进 Note  
- 未 `finalize_outline` 就当学习辅导乱生成全书  
- 同时打开多主题会话（违反单路 `current_topic_id`）

### 3.3 UI 约束（已锁 IA）

- 学习页：**仅顶栏右侧**开会话抽屉；内容区无入口  
- 书籍「切换」主题侧栏也在右侧；**同时只开一个右抽屉**（主题管理 vs 会话互斥或分层，实现二选一即可）  
- 流式展示订阅 Pi 事件；工具调用（`append_note` / `generate_section`）在抽屉内可见为系统行，不伪装成用户手记

---

## 4. 与正文 / 笔记如何联动

### 4.1 正文（Section）

| 用户意图（识别） | 系统行为 |
|------------------|----------|
| 解释本段 / 举例 / 对比 | `GROUND`：读盘 → 答；必要时短引正文 |
| 本节还没生成 | 建议或经确认调用 `generate_section`；不空口假装已落盘 |
| 换节深挖 | 大纲抽屉选节换 `section_id`，会话上下文换绑 L0/L1 |
| 调整大纲/计划 | 首迭代：**引导回边界/大纲确认流**；不在学习闲聊里默改大纲（防漂） |

### 4.2 笔记（Note）

- **写入**：仅 AI `append_note`；类型∈{疑问,思考,拓展}  
- **启发式（产品默认）** 满足任一可记：  
  1. 用户明确说出稳定结论/心得（思考）  
  2. 暴露可复查的误解或未解问题（疑问）  
  3. 超出本节 objective 的有价值旁支且用户想留（拓展）  
  4. 同一关键问题往返 ≥2 轮仍未解（疑问，带 section_id）  
- **长度**：单条摘要级（建议 ≤300 字）；禁止整段对话拷贝  
- **读取**：书籍「笔记」只读列表；侧栏答疑可引用近期 Note，避免重复解答  
- **导出**：经 `summarize_notes_for_export`，仍非 Session 原文

### 4.3 事件（给前端）

已有：`note_appended` / `section_ready` / `phase_changed`。  
建议补：`tutor_grounded`（可选，调试用）或至少在 tool 结果里带 `citations: [{section_id, note_id?}]` 供 UI 高亮。

---

## 5. 对工具 / 运行时的增量建议（给全藏）

在基线 v0.4 之上建议 v0.5 草案标签：

1. **`build_tutor_context`（内部）** 或 runtime 隐式装配 §2 `TutorContext`（可不暴露为 AgentTool）  
2. **学习相位 system prompt 契约**：必须声明「优先 L1 读盘；策略枚举；append_note 启发式」  
3. **`append_note`**：入参保持；出参可加 `reason_code`（对应启发式 1–4）便于验收  
4. **可选 `cite_section`**：只读返回片段 id，供模型先 cite 再讲（也可合并进应答元数据）  
5. **单路右抽屉**：API 不强制；文档注明 UI 互斥

密钥仍只走 Settings → model proxy。

---

## 6. 首迭代验收清单（产品闸）

- [ ] 学习会话仅右侧抽屉；与书籍主题侧栏不同时抢焦（同时只开一个）  
- [ ] 每轮请求带 L0+L1（有正文时）；答非所问「脱节正文」可复现为 bug  
- [ ] 假/真流式中，值得沉淀时出现 `append_note`，书籍笔记只读可见  
- [ ] Note 非聊天原文；导出不含水话 Session  
- [ ] `scope_out` 问题被拒并回流  
- [ ] 未生成节时不假装已读盘；引导 `generate_section`  

---

## 7. 与核心①的衔接

- L0 `boundary_digest` 来自①的 `BoundarySnapshot`  
- 节 `objective` / `depends_on` 来自①增强的 `OutlineNode`  
- ①没定好，②的 GROUND/ADVANCE 会失锚 —— 两核同迭代，① schema 冻结后再钉②提示词

---

## 8. 下一步

1. 群评本草稿 → 冻结 Context 分层与策略枚举  
2. 全藏：基线补 TutorContext / append_note.reason_code（建议 v0.5）  
3. 菖蒲：侧栏会话 mock 按策略露痕迹（cite 正文、tool 行、与笔记列表联动）  
4. 主税：①②收口后出一页《两核验收》给用户过首迭代演示
