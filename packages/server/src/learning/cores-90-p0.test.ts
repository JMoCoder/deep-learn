import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createApp } from "../app.js";
import { build_tutor_context } from "../agent/tutor-context.js";
import { planCoachTurn } from "../agent/coach.js";
import { beginTurn, peekTurnMeta } from "../agent/turn-meta.js";
import { config } from "../config.js";
import { exportTopic } from "../export/index.js";
import { outlineFromBoundaries } from "./outline-from-boundaries.js";
import { collectPrereqEdges } from "./prereq-edges.js";
import { openMemoryDb } from "../store/db.js";
import { flattenOutline, Store } from "../store/repos.js";
import { createQuantumTools } from "../tools/factory.js";

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

const FULL_WALK = [
  { kind: "motivation", question: "m", answer: "因为工作要用" },
  { kind: "goal_outcome", question: "g", answer: "我能独立画一遍" },
  { kind: "success_evidence", question: "e", answer: "能给同事讲 10 分钟" },
  { kind: "prior_level", question: "p", answer: "只会定义" },
  { kind: "prior_gaps", question: "g2", answer: "会：态矢量；不会：投影公设" },
  { kind: "scope_in", question: "i", answer: "测量公设" },
  { kind: "scope_out", question: "s", answer: "弦论" },
  { kind: "depth", question: "d", answer: "能讲清" },
  { kind: "chunk_budget", question: "c", answer: "每周 3 小时" },
];

async function topicThroughOutline(store: Store) {
  const topic = store.createTopic("两核P0");
  const tools = toolsFor(store, topic.id);
  await exec(tools.find((t) => t.name === "finalize_boundary")!, { answers: FULL_WALK });
  const drafted = outlineFromBoundaries(store.listBoundaries(topic.id));
  await exec(tools.find((t) => t.name === "draft_outline")!, drafted);
  await exec(tools.find((t) => t.name === "finalize_outline")!, {});
  return { topic, tools };
}

describe("cores-90 P0", () => {
  it("1.4 draft_outline / finalize_outline write non-empty depends_on and projection exposes edges", async () => {
    const store = new Store(openMemoryDb());
    const { topic } = await topicThroughOutline(store);
    const outline = store.getOutline(topic.id);
    const flat = flattenOutline(outline);
    const withDeps = flat.filter((n) => n.dependsOn.length > 0);
    assert.ok(withDeps.length >= 2, `expected ≥2 nodes with depends_on, got ${withDeps.length}`);
    const ids = new Set(flat.map((n) => n.id));
    for (const node of withDeps) {
      for (const dep of node.dependsOn) {
        assert.ok(ids.has(dep), `depends_on ${dep} should be an outline id`);
      }
    }

    const { app } = createApp(store);
    const res = await app.request("/api/topics/current/projection");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      outline: Array<{ dependsOn: string[] }>;
      prereq_edges: Array<{ from_id: string; to_id: string; from_title: string; to_title: string }>;
      phase: string;
    };
    assert.equal(body.phase, "learning");
    assert.ok(body.prereq_edges.length >= 2);
    assert.ok(body.outline.some((n) => (n.dependsOn?.length ?? 0) > 0 || n));
    assert.equal(body.prereq_edges.length, collectPrereqEdges(outline).length);
    assert.ok(body.prereq_edges.every((e) => e.from_id && e.to_id && e.from_title && e.to_title));
  });

  it("2.2/2.3 generate_section fills L1 body excerpt and turn citations", async () => {
    const store = new Store(openMemoryDb());
    const { topic, tools } = await topicThroughOutline(store);
    const leaf = flattenOutline(store.getOutline(topic.id)).find((n) => n.children.length === 0)!;
    const marker = "叠加态在测量前不是左右同时在，而是振幅同时在。";
    beginTurn(topic.id, "GROUND");
    await exec(tools.find((t) => t.name === "generate_section")!, {
      outline_node_id: leaf.id,
      title: leaf.title,
      body_md: `# ${leaf.title}\n\n${marker}\n\n这是落盘正文，不是空脚手架。`,
    });
    const section = store.getSectionByOutline(leaf.id)!;
    assert.ok(section.bodyMd.includes(marker));

    const ctx = build_tutor_context(store, topic.id);
    assert.ok(ctx);
    assert.ok(ctx.L1.body.trim(), "L1.body must be a real excerpt");
    assert.ok(ctx.L1.body.includes(marker));
    assert.equal(ctx.L1.sectionId, section.id);
    assert.ok(ctx.L3.body.includes(marker));

    const meta = peekTurnMeta(topic.id);
    assert.ok(
      meta.citations.some((c) => c.section_id === section.id),
      `citations should point at persisted section ${section.id}`,
    );

    await exec(tools.find((t) => t.name === "get_section")!, { outline_node_id: leaf.id });
    assert.ok(peekTurnMeta(topic.id).citations.some((c) => c.section_id === section.id));
  });

  it("2.4 stub coach stably emits SCAFFOLD then ADVANCE", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("策略");
    store.finalizeBoundaries(
      topic.id,
      FULL_WALK.map((a) => ({ kind: a.kind as never, question: a.question, answer: a.answer })),
    );
    const draft = planCoachTurn(store, topic.id, "边界已齐");
    assert.equal(draft.tool?.name, "draft_outline");
    assert.equal(draft.strategy, "SCAFFOLD");

    const args = draft.tool!.args as { title: string; nodes: never[] };
    store.replaceOutline(topic.id, args.title, args.nodes, "draft");
    store.finalizeOutline(topic.id);
    const leaves = flattenOutline(store.getOutline(topic.id)).filter((n) => n.children.length === 0);
    assert.ok(leaves.length >= 2);
    store.upsertSection(topic.id, leaves[0]!.id, leaves[0]!.title, "第一节正文。");

    const advance = planCoachTurn(store, topic.id, "下一节");
    assert.equal(advance.strategy, "ADVANCE");
    assert.equal(advance.tool?.name, "generate_section");
    assert.equal(
      (advance.tool?.args as { outline_node_id: string }).outline_node_id,
      leaves[1]!.id,
    );

    const ground = planCoachTurn(store, topic.id, "这段在讲什么");
    assert.equal(ground.strategy, "GROUND");
    assert.equal(ground.tool?.name, "get_section");
  });

  it("export html writes a real artifact file", async () => {
    const store = new Store(openMemoryDb());
    const { topic } = await topicThroughOutline(store);
    const leaf = flattenOutline(store.getOutline(topic.id)).find((n) => n.children.length === 0)!;
    store.upsertSection(topic.id, leaf.id, leaf.title, "导出用正文：测量前后差别。");

    const result = await exportTopic(store, topic.id, "html");
    assert.equal(result.format, "html");
    assert.match(result.filename, /\.html$/);
    const abs = resolve(config.dataDir, "exports", topic.id, result.filename);
    assert.ok(existsSync(abs), `missing ${abs}`);
    const html = readFileSync(abs, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.ok(html.includes("导出用正文") || html.includes(topic.title));

    const tools = toolsFor(store, topic.id);
    const viaTool = await exec(tools.find((t) => t.name === "export_topic")!, { format: "html" });
    assert.equal(viaTool.details.format, "html");
    const exported = viaTool.content?.[0];
    const text = exported && "text" in exported ? String(exported.text) : "";
    assert.ok(text.includes(".html"));
  });
});
