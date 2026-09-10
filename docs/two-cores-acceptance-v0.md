# Deep Learn — 两核验收清单 v0

> 作者：结野主税（产品）  
> 日期：2026-09-06 · 修订 2026-09-10（红 5：L0/L1 对齐 packer）  
> 用户可见名：**Deep Learn**。Quantum 仅内部包名 / 路径，不改包名。  
> 契约真源：`@quantum/shared` + `packages/server/src/tools/factory.ts` + packer `packages/server/src/agent/tutor-context.ts`。冲突以代码为准。  
> 依据：基线 [`backend-baseline-v0.5.md`](./backend-baseline-v0.5.md)；IA 壳层。core1 / core2 调研稿已标 historical，**不再当分层真源**。  
> 用途：首迭代演示 / 冒烟验收；过了再谈热力图·导出版式等后置项

---

## Packer L0–L4（真源）

`build_tutor_context` 默认装 L0–L3。字段以 `TutorContext`（`packages/shared/src/tutor.ts`）为准。

| 层 | 装什么 |
|----|--------|
| L0 | 会话不变量：`topicId` / `title` / `phase` / `exportState` / `coachMode` / `strategyHint` |
| L1 | `BoundarySnapshot` **加上**当前节读盘摘录（`body` / `sectionId` / `title` / `truncated`） |
| L2 | 大纲位置：当前叶 `objective`、`dependsOn`、上下叶标题、压缩树 |
| L3 | 当前节再截一刀（与 L1.body 同源） |
| L4 | 后置；默认不装近期笔记，无向量检索 |

### 旧调研口径 → packer（对照，勿再当定义）

| 旧说法（core2 调研） | 现在落在 |
|----------------------|----------|
| 「L0 = 边界摘要 + 当前节 objective」 | 边界在 **L1.snapshot**；objective 在 **L2.currentObjective**。L0 不再装摘要 |
| 「L1 = 读盘正文片段」 | 读盘在 **L1.body**（及同源 **L3.body**） |
| 「L2 = 近期 Note」 | 笔记在可选 **L4.recentNotes**，默认不装 |
| 「L3 = dialog_tail」 | 对话轨迹走 Session，**不进** TutorContext 分层 |
| 「L4 = 向量」 | 仍后置；当前实现无向量 |

验收 2.2 按 **packer 表** 判，不按旧 L0/L1 句子。

---

## 核① 新建主题引导

| # | 验收项 | 过线标准 |
|---|--------|----------|
| 1.1 | 入口 | 仅从书籍右侧主题侧栏**首卡「新建主题」**进入；无表单页旁路 |
| 1.2 | 提问维度 | 引导覆盖：动机、终点表现、成功证据、先验、先修轻探、scope_in/out、深度、负荷（可合并问，不可缺维）。八维是覆盖，不是定稿硬门 |
| 1.3 | 边界卡 | `finalize_boundary` 后可展示结构化边界卡；五必填齐（`goal_outcome` / `prior_level` / `scope_out` / `depth` / `chunk_budget`）。缺则 `ok: false`、不改相位 |
| 1.4 | 大纲质量 | 草稿含 `objective`、可见先修序（`depends_on` 或等价标题边）、`target_chars` 服从 chunk_budget；不踩 scope_out |
| 1.5 | 反模式 | 无「先填章节名再倒推」；无只问主题名+三档难度就出大纲 |
| 1.6 | 计划形态 | 确认大纲后进入学习投影；不另起甘特/CRUD 计划页。确认 / 重拟只走**学习页大纲卡**，不在会话里回「可以」「减叶」 |

## 核② 侧栏 AI 交互

| # | 验收项 | 过线标准 |
|---|--------|----------|
| 2.1 | 入口 | 学习页仅顶栏**右侧**开会话；内容区无会话入口；与书籍主题侧栏同时只开一个右抽屉 |
| 2.2 | 上下文 | 学习相位每轮 packer 带 **L0 不变量** + **L1（snapshot + 读盘摘录）** + **L2 objective / 先修位置**。有正文却答非所问、完全脱节落盘，可判为 bug |
| 2.3 | 接地 | 解释本段类问题能出现**引用行**（`citations[]` / CiteRow）或复述落盘要点；空引用不出现。踩排除区的那一轮不挂引用 |
| 2.4 | 策略痕迹 | mock/真流中可见合理辅导行为（追问 / 脚手架 / 指回正文 / 推进下一叶），非一律长文终局答案。手点不教策略枚举名；闭集只在 shared |
| 2.5 | 笔记联动 | 值得沉淀时出现 `append_note`（带 `reason_code` 1–4）；书籍笔记只读可见；Note ≠ 聊天原文 |
| 2.5b | reason_code 枚举（冻） | `1` 稳定结论/心得（思考）；`2` 可复查误解或未解（疑问）；`3` 超 objective 旁支且用户想留（拓展）；`4` 同题往返≥2 轮未解（疑问）。数值不改名，验收对文案 |
| 2.6 | 未生成节 | 不假装已读盘；引导或经确认走 `generate_section` |
| 2.7 | 边界 | 踩 `scope_out` **短拒 + 拉回当前节**（拒回流卡）；该轮书籍笔记不增加、不挂引用。密钥不进会话 |

## 联调冒烟（演示路径）

1. 书籍 → 切换侧栏（右出）→ 新建主题 → 走完边界 → 在学习页确认边界卡  
2. 在学习页**大纲卡**核对 objective / 先修「A → B」/ 篇幅 → 确认进入学习（超负荷则卡上点重拟）  
3. 顶栏右开会话 → 针对当前节追问 → 见引用行 / 读盘锚定  
4. 触发至少一条 AI 笔记 → 书籍「笔记」只读可见该条  
5. 主题卡导出弹 md|html|epub 之一  
6. 抽测拒回流：排除区用词追问 → 短拒 + 回流，笔记不增

## 本清单不管（后置）

热力图统计口径、导出三格式版式细节、向量检索 L4、大纲细粒度编辑交互、原生 App、黄包 UI、改包名。
