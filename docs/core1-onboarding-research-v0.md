# Quantum 核心① — 新建主题引导：专业调研草稿 v0

> **Historical.** 调研底稿，不再当契约或 L0/L1 真源。现行过线：[`backend-baseline-v0.5.md`](./backend-baseline-v0.5.md) · [`two-cores-acceptance-v0.md`](./two-cores-acceptance-v0.md)。用户可见名：**Deep Learn**（Quantum = 内部包名）。  
> 作者：结野主税（产品）  
> 日期：2026-09-06  
> 状态：historical（首迭代输入；非正式定稿）  
> 依据：用户锁定两核之①；对齐当时 IA / 基线工具面  
> 非目标：本文不写业务代码；不替代核心②（侧栏 AI 交互）完整方案（文末只给衔接点）

---

## 0. 问题陈述

「新建主题」不是随便填几道问卷，而是 **把用户从「我想学 X」带到一份可执行的大纲 + 学习计划**。  
成功标准：边界快照足以让 `draft_outline` / `finalize_outline` 产出 **有先修、有深度梯度、有篇幅约束** 的大纲，而不是章节名堆砌。

本项目 90% 里，①占「入口质量」：入口糊了，后面生成正文与笔记联动都会漂。

---

## 1. 专业底座（可核对来源）

### 1.1 逆向设计 UbD（Wiggins & McTighe）

三阶段：**Desired Results → Evidence → Learning Plan**。  
对 Quantum 的映射：

| UbD | Quantum 新建主题引导 |
|-----|----------------------|
| Stage 1 目标结果 | 边界里先锁「学完能做什么 / 理解什么」（目标深度、可验证表现） |
| Stage 2 证据 | 先问「怎么算学会」（能解释 / 能做小练习 / 能写伪代码…），再排大纲 |
| Stage 3 学习计划 | 大纲节序 + 每节目标字数/时长 + 生成优先级 = 计划 |

要点：先问终点，再问路径；禁止先列章节再倒推目标（典型「活动导向」失败模式）。

参考：[UIC Backward Design](https://teaching.uic.edu/cate-teaching-guides/syllabus-course-design/backward-design/)；[UbD White Paper](https://jaymctighe.com/wp-content/uploads/2020/06/UbD-White-Paper.pdf)

### 1.2 ADDIE · Analysis（需求分析 / 学习者分析 / 任务分析）

引导流本质是 **Analysis 会话化**：

- **Needs**：为何学、解决什么差距（动机 ≠ 主题名）
- **Learner**：先验、可用时间、偏好模态、禁忌区（如「不碰硬件」）
- **Task / 内容**：目标能力拆成可排序任务；再变成大纲叶节点

参考：[ADDIE Analysis](https://pressbooks.usnh.edu/addieexplained/chapter/analysis/)

### 1.3 脚手架与工作记忆

大纲排序遵循：**简单→复杂 / 具体→抽象 / 先修→后继**；单节信息量受工作记忆约束（分段、少并行新概念）。  
边界里的「篇长 / 总长 / 单次可学时长」是 **认知负荷预算**，不是装饰字段。

### 1.4 知识边界与先修追溯（对话式）

自适应路径研究强调：学习者常不知道自己缺什么（unknown unknowns）；应用对话递归追溯先修，直到碰到「已知边界」，再生成从边界到目标的路径。  
对 Quantum：边界问卷应包含 **轻量先修探测**（不是考试，是勾选/二选一/「听过但不会用」），再生成大纲。

参考方向：知识图谱路径约束（先修、难度梯度）；会话式 prerequisite tracing（如 RPKT 一类工作：实时发现先修链，而非预设巨型图谱）。

---

## 2. 产品化：边界快照最小字段（建议锁进契约）

`Topic.boundary_snapshot` 建议结构化（示意；实现可 JSON）：

| 字段 | 含义 | 专业来源 |
|------|------|----------|
| `goal_outcome` | 学完能做什么（1–3 条可观察表现） | UbD Stage 1 |
| `success_evidence` | 怎么自证学会（解释/应用/小项目…） | UbD Stage 2 |
| `prior_level` | 先验档：零基础 / 听说过 / 用过皮毛 / 能独立做 | Learner analysis |
| `prior_known` | 已知概念清单（用户点选或 AI 归纳） | 先修追溯 |
| `prior_gaps` | 已知缺口 / 想绕过的坑 | Gap analysis |
| `scope_in` / `scope_out` | 包含 / 排除（硬边界） | Needs + 约束 |
| `depth` | 直觉 / 能讲清 / 能动手 / 能教人 | 深度档 |
| `time_budget` | 总时长或周投入 | 情境/可行性 |
| `chunk_budget` | 单节目标字数或单次学习分钟 | 认知负荷 |
| `modality` | 偏叙述 / 例题 / 对照表 / 伪代码… | 偏好 |
| `motivation` | 场景动机（一句话） | Needs |

问卷 **题库可变、可增删**，但最终必须能填满上表「必填子集」（首迭代建议必填：`goal_outcome`, `prior_level`, `scope_out`, `depth`, `chunk_budget`）。

---

## 3. 引导会话剧本（Agent 流，非表单）

相位仍是 `boundary_interview` → `finalize_boundary` → `outline_draft` → `finalize_outline`。

### 3.1 推荐提问顺序（默认题序）

1. **动机场景**：你为什么现在要学这个？（Needs）  
2. **终点表现**：两周/一个月后，你希望自己能做到哪一件具体的事？（Desired Results）  
3. **成功证据**：怎样算「够了」？（Evidence）  
4. **先验自报**：下面哪档最像你？（零基础…）  
5. **先修轻探**：对目标里冒出的 3–5 个关键概念，用「会 / 半会 / 不会」点一下（可 AI 根据主题动态出概念）  
6. **范围刀**：必须包含？坚决不碰？（scope_in/out）  
7. **深度与负荷**：要到哪一档深度？单次能啃多少（字数或分钟）？  
8. **确认边界快照**：用自然语言复述 + 结构化卡，用户可改再 `finalize_boundary`

允许增删题，但 **不得跳过 2→7 的语义**（可用合并问法，不可缺维度）。

### 3.2 反模式（产品验收要拦）

- 一上来让用户「列章节」  
- 只问主题名 + 难度三档就出大纲  
- 大纲无先修边、无深度梯度、无视 `chunk_budget`  
- 把聊天流水当「学习计划」

---

## 4. 大纲怎么安排（从边界到 OutlineNode）

`draft_outline` 生成规则（产品约束，供后端/提示词）：

1. **目标对齐**：每叶节点挂一条 `section_objective`（对应 goal_outcome 的切片）  
2. **先修拓扑**：不会的概念排在会用到它的节之前；已知概念可跳过或极短「对齐」节  
3. **难度梯度**：前 20–30% 建表象与词汇；中段机制；后段迁移/综合（按 depth 裁剪）  
4. **负荷切割**：`target_chars` / 预估分钟服从 `chunk_budget`；超长目标拆叶，不塞一节  
5. **scope_out 硬过滤**：大纲标题与摘要不得踩排除区  
6. **可教性**：叶节点粒度 = 「一次学习会话能完成并落盘」；过粗则拆，过细则合并

用户确认大纲时，可编辑粒度仍属 §6；但 **系统草稿必须已满足 1–6**。

---

## 5. 「学习计划」在本产品里是什么

首迭代不另做甘特页。计划 =：

- 已确认大纲（节序 = 计划序）  
- 每节状态（pending/generating/ready）  
- 边界里的时间/负荷预算（用于提示「今日建议啃哪一节」——可后置）

导出（md/html/epub）带大纲即带计划骨架；笔记是计划执行中的沉淀，不是计划本身。

---

## 6. 对工具契约的增量建议（给全藏）

在现有 `ask_boundary` / `finalize_boundary` / `draft_outline` / `finalize_outline` 上：

- `finalize_boundary.answers`：对齐 §2 字段 schema（缺必填则 `ok:false`）  
- `draft_outline` 出参：`OutlineNode` 增加可选 `objective`, `depends_on[]`, `target_chars`  
- 事件：`boundary_finalized` 后 UI 展示「边界卡」再进大纲确认（产品闸）

不挡 v0.3 已锁导出；本增量进基线下一小版（建议 v0.4 草案标签）。

---

## 7. 与核心②的衔接（仅接口，不展开）

侧栏 AI 交互需要吃到同一份 `boundary_snapshot` + `outline_snapshot` + 当前 `section` + 近期 `Note`：

- 问「下一步学什么」→ 读大纲状态与先修  
- 追问深化 → 可 `append_note`，但不改大纲除非显式「调整计划」工具（后置）  
- 上下文窗口策略属核心②专项（下篇）

---

## 8. 首迭代验收清单（产品闸）

- [ ] 新建主题仅从书籍右侧主题侧栏首卡进入  
- [ ] 引导问完能产出完整边界卡（§2 必填齐）  
- [ ] 大纲草稿可见先修序与每节目标，且尊重 scope_out / chunk_budget  
- [ ] 用户确认大纲后进入学习投影；计划不另起 CRUD 页  
- [ ] 无「先填章节名」旁路  

---

## 9. 下一步

1. 群内评审本草稿 → 收口字段 schema  
2. 全藏：基线补 §2/§6 增量（小版本）  
3. 菖蒲：原型引导流按 §3 剧本改一版可点（仍假数据）  
4. 主税：并行开核心②《侧栏 AI 交互》调研草稿（上下文 / 聊 / 正文·笔记联动）
