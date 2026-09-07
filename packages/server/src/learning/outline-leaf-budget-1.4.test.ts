import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { BoundaryKind } from "@quantum/shared";
import { planCoachTurn } from "../agent/coach.js";
import { createQuantumTools } from "../tools/factory.js";
import { openMemoryDb } from "../store/db.js";
import { flattenOutline, Store } from "../store/repos.js";
import { collectDraftLeaves } from "./prereq-edges.js";
import {
  inferWeeklyMinutes,
  leafBudget,
  outlineFromBoundaries,
  trimOutlineToLeafCap,
} from "./outline-from-boundaries.js";

function toolsFor(store: Store, topicId: string) {
  return createQuantumTools({
    store,
    topicId,
    requireTopic: () => store.requireTopic(topicId),
    emit: () => undefined,
  });
}

async function exec(tool: AgentTool, args: Record<string, unknown>) {
  return tool.execute("call", args as never);
}

const WALK_20: Array<{ kind: BoundaryKind; question: string; answer: string }> = [
  { kind: "motivation", question: "m", answer: "因为工作要用" },
  { kind: "goal", question: "g", answer: "我能独立画一遍" },
  { kind: "success_evidence", question: "e", answer: "能讲 10 分钟" },
  { kind: "prior", question: "p", answer: "只会定义" },
  { kind: "prior_gaps", question: "g2", answer: "会：态矢量；不会：投影公设" },
  { kind: "scope_in", question: "i", answer: "测量公设" },
  { kind: "constraint", question: "s", answer: "弦论" },
  { kind: "depth", question: "d", answer: "能讲清" },
  { kind: "time", question: "t", answer: "每次 20 分钟" },
];

const FAT_SEVEN = {
  title: "超预算稿",
  nodes: [
    {
      title: "定向：地图",
      intent: "地图",
      objective: "能指出",
      children: [
        { title: "叶1", intent: "a", objective: "a" },
        { title: "叶2", intent: "b", objective: "b", depends_on: ["叶1"] },
      ],
    },
    {
      title: "先修缺口",
      intent: "补",
      children: [{ title: "叶3", intent: "c", objective: "c", depends_on: ["叶2"] }],
    },
    {
      title: "核心",
      intent: "干",
      children: [
        { title: "叶4", intent: "d", objective: "d", depends_on: ["叶3"] },
        { title: "叶5", intent: "e", objective: "e", depends_on: ["叶4"] },
      ],
    },
    {
      title: "应用",
      intent: "练",
      children: [{ title: "叶6", intent: "f", objective: "f", depends_on: ["叶5"] }],
    },
    {
      title: "迁移与收束",
      intent: "迁",
      children: [{ title: "叶7", intent: "g", objective: "g", depends_on: ["叶6"] }],
    },
  ],
};

describe("1.4 / 五步2 outline leaf budget", () => {
  it("keeps the frozen cap: 20 分钟 → 6, and scaffold drafts within it", () => {
    const minutes = inferWeeklyMinutes(
      WALK_20.map((row, i) => ({
        ...row,
        id: `b${i}`,
        topicId: "t",
        status: "answered" as const,
        sortOrder: i,
        createdAt: 0,
      })),
    );
    const cap = leafBudget(minutes);
    assert.equal(minutes, 20);
    assert.equal(cap, 6);

    const store = new Store(openMemoryDb());
    const topic = store.createTopic("20分钟");
    store.finalizeBoundaries(topic.id, WALK_20);
    const drafted = outlineFromBoundaries(store.listBoundaries(topic.id));
    assert.ok(collectDraftLeaves(drafted.nodes).length <= cap);
    assert.match(drafted.nodes[0]?.title ?? "", /定向|地图/);
  });

  it("draft_outline auto-cuts a 7-leaf tree to cap 6 and writes it", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("砍叶落盘");
    store.finalizeBoundaries(topic.id, WALK_20);
    const draft = toolsFor(store, topic.id).find((t) => t.name === "draft_outline")!;
    const result = await exec(draft, FAT_SEVEN);
    assert.equal(result.details.ok, true);
    assert.ok((result.details.leafCount as number) <= (result.details.leafCap as number));
    assert.equal(result.details.leafCap, 6);
    const leaves = flattenOutline(store.getOutline(topic.id)).filter((n) => n.children.length === 0);
    assert.ok(leaves.length <= 6);
    assert.ok(leaves.length >= 1);
  });

  it("「可以」/「减叶」on an over-budget disk outline redrafts instead of finalize", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("卡死循环");
    store.finalizeBoundaries(topic.id, WALK_20);
    store.replaceOutline(topic.id, FAT_SEVEN.title, FAT_SEVEN.nodes as never, "draft");
    assert.ok(
      flattenOutline(store.getOutline(topic.id)).filter((n) => n.children.length === 0).length > 6,
    );

    const cut = planCoachTurn(store, topic.id, "减到6");
    assert.equal(cut.tool?.name, "draft_outline");
    const cutLeaves = collectDraftLeaves(
      (cut.tool?.args as { nodes: Parameters<typeof collectDraftLeaves>[0] }).nodes,
    );
    assert.ok(cutLeaves.length <= 6);

    const confirm = planCoachTurn(store, topic.id, "可以");
    assert.equal(confirm.tool?.name, "draft_outline");
    assert.notEqual(confirm.tool?.name, "finalize_outline");
  });

  it("finalize_outline stays gated until the stored outline is within budget", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("锁定门闩");
    store.finalizeBoundaries(topic.id, WALK_20);
    store.replaceOutline(topic.id, FAT_SEVEN.title, FAT_SEVEN.nodes as never, "draft");
    const finalize = toolsFor(store, topic.id).find((t) => t.name === "finalize_outline")!;
    const blocked = await exec(finalize, {});
    assert.equal(blocked.details.ok, false);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");

    const draft = toolsFor(store, topic.id).find((t) => t.name === "draft_outline")!;
    const rewritten = await exec(draft, outlineFromBoundaries(store.listBoundaries(topic.id)));
    assert.equal(rewritten.details.ok, true);
    const ok = await exec(finalize, {});
    assert.notEqual(ok.details.ok, false);
    assert.equal(store.requireTopic(topic.id).phase, "learning");
  });

  it("trimOutlineToLeafCap does not raise the cap", () => {
    const trimmed = trimOutlineToLeafCap(FAT_SEVEN.nodes, 6);
    assert.ok(collectDraftLeaves(trimmed).length <= 6);
    assert.match(trimmed[0]?.title ?? "", /定向|地图/);
  });
});
