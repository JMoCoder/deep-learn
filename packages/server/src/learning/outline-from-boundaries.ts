import type { BoundaryRecord, OutlineDraftNode } from "@quantum/shared";

/**
 * Deterministic outline scaffold used by the local coach and as a prompt example.
 * Sequence is loosely Gagné / backward-design: orient → prerequisites → core → apply → transfer.
 *
 * TODO (product research): leaf-count vs. reported weekly minutes; transfer node timing.
 */

export function inferWeeklyMinutes(boundaries: BoundaryRecord[]): number {
  const time = boundaries.find((b) => b.kind === "time")?.answer ?? "";
  const hour = time.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hour) return Math.round(Number(hour[1]) * 60);
  const minutes = time.match(/(\d+)\s*分钟/);
  if (minutes) return Number(minutes[1]);
  if (/每天|每日/.test(time)) return 5 * 40;
  if (/周末/.test(time)) return 120;
  return 90;
}

export function leafBudget(weeklyMinutes: number, weeks = 4): number {
  const sittings = Math.max(4, Math.round((weeklyMinutes * weeks) / 35));
  return Math.min(12, Math.max(6, sittings));
}

export function titleFromBoundaries(boundaries: BoundaryRecord[], fallback = "未命名主题"): string {
  const goal = boundaries.find((b) => b.kind === "goal")?.answer.trim();
  if (!goal) return fallback;
  const cleaned = goal.replace(/^我能/, "").replace(/[。！？!?]+$/, "");
  return cleaned.slice(0, 24) || fallback;
}

export function outlineFromBoundaries(boundaries: BoundaryRecord[]): {
  title: string;
  nodes: OutlineDraftNode[];
} {
  const goal = boundaries.find((b) => b.kind === "goal")?.answer.trim() || "尚不明确的表现目标";
  const prior = boundaries.find((b) => b.kind === "prior")?.answer.trim() || "先验未说明";
  const depth = boundaries.find((b) => b.kind === "depth")?.answer.trim() || "深度未说明，按「能讲清」处理";
  const constraint = boundaries.find((b) => b.kind === "constraint")?.answer.trim() || "无额外约束";
  const minutes = inferWeeklyMinutes(boundaries);
  const leaves = leafBudget(minutes);

  const title = titleFromBoundaries(boundaries);
  const nodes: OutlineDraftNode[] = [
    {
      title: "定向：这张地图怎么走",
      intent: `把目标「${goal}」翻译成学习路线，并标明先验「${prior}」从哪一站接入。`,
      children: [
        {
          title: "目标、过关证据、时间盒",
          intent: `写清四周内可检查的表现；时间预算约每周 ${minutes} 分钟，叶子上限约 ${leaves}。`,
        },
        {
          title: "词汇与对象一览",
          intent: "只列后续章节会反复出现的名字，不在这里讲完。",
        },
      ],
    },
    {
      title: "先修缺口",
      intent: `只补「${prior}」里为达成目标所缺的最小一块，避免重学已会的。`,
      children: [
        {
          title: "最小先修",
          intent: "用学习者自己的话说清缺什么；能跳过的明确跳过。",
        },
      ],
    },
    {
      title: "核心：能独立做出来的主干",
      intent: `深度按「${depth}」。每一叶最多两到三个意图。`,
      children: [
        {
          title: "主干概念与操作",
          intent: "先会做最小闭环，再展开变体。",
        },
        {
          title: "常见卡点",
          intent: "针对先验里提到的卡住处，给对照例子。",
        },
      ],
    },
    {
      title: "应用",
      intent: `在约束「${constraint}」下，用目标情境练习一次。`,
      children: [
        {
          title: "一次完整演练",
          intent: "对着目标场景走完，而不是再读一章。",
        },
      ],
    },
    {
      title: "迁移与收束",
      intent: "换一个相邻情境，看还能不能做；记下下次要问的问题。",
      children: [
        {
          title: "换境再做",
          intent: "同一目标，换材料或约束，检验是否只记住了例子。",
        },
      ],
    },
  ];

  return { title, nodes };
}
