import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { missingFinalizeFields, missingInterviewWalk } from "@quantum/shared";
import { createApp } from "../app.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { build_tutor_context } from "../agent/tutor-context.js";
import { createQuantumTools } from "./factory.js";

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

const FIVE_REQUIRED = [
  { kind: "goal_outcome", question: "g", answer: "我能独立画一遍" },
  { kind: "prior_level", question: "p", answer: "只会定义" },
  { kind: "scope_out", question: "s", answer: "弦论" },
  { kind: "depth", question: "d", answer: "能讲清" },
  { kind: "chunk_budget", question: "c", answer: "每周 2 小时" },
];

const FULL_WALK = [
  { kind: "motivation", question: "m", answer: "因为工作要用" },
  ...FIVE_REQUIRED,
  { kind: "success_evidence", question: "e", answer: "能给同事讲 10 分钟" },
  { kind: "prior_gaps", question: "g2", answer: "会：态矢量；不会：投影公设" },
  { kind: "scope_in", question: "i", answer: "测量公设" },
];

describe("two cores backend", () => {
  it("finalize_boundary rejects missing required snapshot fields with ok:false", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("缺字段");
    const finalize = toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!;
    const result = await exec(finalize, {
      answers: [
        { kind: "goal", question: "g", answer: "我能做" },
        { kind: "prior", question: "p", answer: "零基础" },
      ],
    });
    assert.equal(result.details.ok, false);
    assert.ok((result.details.missing as string[]).includes("scope_out"));
    assert.ok((result.details.missing as string[]).includes("depth"));
    assert.ok((result.details.missing as string[]).includes("chunk_budget"));
    assert.equal(store.requireTopic(topic.id).phase, "boundary_interview");
  });

  it("finalize_boundary allows five required fields even if the interview walk is incomplete", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("只五必填");
    const finalize = toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!;
    const result = await exec(finalize, { answers: FIVE_REQUIRED });
    assert.equal(result.details.ok, true);
    const snap = result.details.snapshot as Parameters<typeof missingFinalizeFields>[0];
    assert.deepEqual(missingFinalizeFields(snap), []);
    const unasked = missingInterviewWalk(snap);
    assert.ok(unasked.includes("motivation"));
    assert.ok(unasked.includes("success_evidence"));
    assert.ok(unasked.includes("prior_gaps"));
    assert.ok(unasked.includes("scope_in"));
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
  });

  it("finalize_boundary still succeeds after the full interview walk", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("齐了");
    const finalize = toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!;
    const result = await exec(finalize, { answers: FULL_WALK });
    assert.equal(result.details.ok, true);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
    const snap = result.details.snapshot as { motivation: string; scope_in: string };
    assert.equal(snap.motivation, "因为工作要用");
    assert.equal(snap.scope_in, "测量公设");
  });

  it("draft_outline respects chunk_budget and scope_out", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("约束");
    await exec(toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!, {
      answers: [
        { kind: "motivation", question: "m", answer: "因为要用" },
        { kind: "goal", question: "g", answer: "我能做" },
        { kind: "success_evidence", question: "e", answer: "能讲清一页" },
        { kind: "prior", question: "p", answer: "零" },
        { kind: "prior_gaps", question: "g2", answer: "不会：投影" },
        { kind: "scope_in", question: "i", answer: "测量" },
        { kind: "constraint", question: "s", answer: "弦论" },
        { kind: "depth", question: "d", answer: "能讲清" },
        { kind: "time", question: "c", answer: "每周 1 小时" },
      ],
    });
    const draft = toolsFor(store, topic.id).find((t) => t.name === "draft_outline")!;
    const banned = await exec(draft, {
      title: "坏大纲",
      nodes: [
        {
          title: "定向：地图",
          intent: "地图",
          objective: "能指出",
          children: Array.from({ length: 20 }, (_, i) => ({
            title: i === 0 ? "弦论入门" : `叶${i}`,
            intent: "堆砌",
            objective: "x",
          })),
        },
      ],
    });
    assert.equal(banned.details.ok, false);
  });

  it("build_tutor_context always has L0+L1 and omits L4 by default", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("窗");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "g", answer: "我能独立画一遍" },
      { kind: "prior", question: "p", answer: "只会定义" },
      { kind: "time", question: "t", answer: "每周 2 小时" },
      { kind: "depth", question: "d", answer: "能讲清" },
      { kind: "constraint", question: "s", answer: "没有" },
    ]);
    const ctx = build_tutor_context(store, topic.id);
    assert.ok(ctx);
    assert.equal(ctx.L0.topicId, topic.id);
    assert.ok(ctx.L0.strategyHint);
    assert.equal(ctx.L1.snapshot.goal_outcome, "我能独立画一遍");
    assert.equal(ctx.L1.snapshot.prior_level, "只会定义");
    assert.equal(ctx.L1.snapshot.chunk_budget, "每周 2 小时");
    assert.equal(ctx.L4, undefined);
    const packed = JSON.stringify(ctx);
    assert.ok(!packed.includes("apiKey"));
    assert.ok(!packed.includes("sk-"));
  });

  it("append_note is tool-loop only and enforces body≤300 + reason_code 1–4", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("笔记");
    const { app } = createApp(store);
    const post = await app.request("/api/notes", { method: "POST", body: "{}" });
    assert.equal(post.status, 404);

    const append = toolsFor(store, topic.id).find((t) => t.name === "append_note")!;
    const tooLong = await exec(append, { body: "x".repeat(301), reason_code: 1 });
    assert.equal(tooLong.details.ok, false);
    assert.equal(store.listNotes(topic.id).length, 0);

    const ok = await exec(append, { body: "卡在投影公设", reason_code: 1 });
    assert.equal(ok.details.ok, true);
    assert.equal(ok.details.reason_code, 1);
    assert.equal(ok.details.type, "思考");
    assert.equal(store.listNotes(topic.id)[0]?.reasonCode, 1);
    assert.equal(store.listNotes(topic.id)[0]?.type, "思考");

    const q = await exec(append, { body: "这个符号还没懂", reason_code: 2 });
    assert.equal(q.details.type, "疑问");
    const ext = await exec(append, { body: "想留下这条旁支", reason_code: 3 });
    assert.equal(ext.details.type, "拓展");
    const loop = await exec(append, { body: "同一问第二轮仍未解", reason_code: 4 });
    assert.equal(loop.details.type, "疑问");
    const rejected = await exec(append, { body: "旧英文名", reason_code: "friction" });
    assert.equal(rejected.details.ok, false);
  });

  it("emits frozen session events and serves current projection", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("事件");
    const captured: Array<{ type: string }> = [];
    const tools = createQuantumTools({
      store,
      topicId: topic.id,
      requireTopic: () => store.requireTopic(topic.id),
      emit: (event) => captured.push(event),
    });

    await exec(tools.find((t) => t.name === "finalize_boundary")!, {
      answers: [
        { kind: "motivation", question: "m", answer: "因为工作要用" },
        { kind: "goal_outcome", question: "g", answer: "我能独立画一遍" },
        { kind: "success_evidence", question: "e", answer: "能讲 10 分钟" },
        { kind: "prior_level", question: "p", answer: "只会定义" },
        { kind: "prior_gaps", question: "g2", answer: "不会：投影" },
        { kind: "scope_in", question: "i", answer: "测量公设" },
        { kind: "scope_out", question: "s", answer: "没有" },
        { kind: "depth", question: "d", answer: "能讲清" },
        { kind: "chunk_budget", question: "c", answer: "每周 2 小时" },
      ],
    });
    assert.ok(captured.some((e) => e.type === "boundary_finalized"));
    assert.ok(captured.some((e) => e.type === "phase_changed"));

    await exec(tools.find((t) => t.name === "draft_outline")!, {
      title: "独立画一遍",
      nodes: [
        {
          title: "定向：地图",
          intent: "地图",
          objective: "能指出接入点",
          children: [{ title: "过关", intent: "证据", objective: "能写出一条证据" }],
        },
      ],
    });
    await exec(tools.find((t) => t.name === "finalize_outline")!, {});
    assert.ok(captured.some((e) => e.type === "outline_finalized"));

    const outline = store.getOutline(topic.id);
    const leaf = outline[0]?.children[0] ?? outline[0]!;
    await exec(tools.find((t) => t.name === "generate_section")!, {
      outline_node_id: leaf.id,
      title: leaf.title,
      body_md: "第一节。",
    });
    assert.ok(captured.some((e) => e.type === "section_status"));
    assert.ok(captured.some((e) => e.type === "section_ready"));

    const section = store.getSectionByOutline(leaf.id)!;
    await exec(tools.find((t) => t.name === "append_note")!, {
      body: "记下这条心得",
      reason_code: 1,
      section_id: section.id,
    });
    const noteEvent = captured.find((e) => e.type === "note_appended") as {
      note_id?: string;
      note_type?: string;
      reason_code?: number;
      section_id?: string;
    };
    assert.ok(noteEvent?.note_id);
    assert.equal(noteEvent.note_type, "思考");
    assert.equal(noteEvent.reason_code, 1);
    assert.equal(noteEvent.section_id, section.id);

    const { app } = createApp(store);
    const projection = await app.request("/api/topics/current/projection");
    assert.equal(projection.status, 200);
    const body = (await projection.json()) as {
      topic_title: string;
      section_title: string;
      outline: unknown[];
      phase: string;
    };
    assert.equal(body.topic_title, "独立画一遍");
    assert.equal(body.section_title, leaf.title);
    assert.ok(Array.isArray(body.outline));
    assert.equal(body.phase, "learning");

    const detailRes = await app.request(`/api/topics/${topic.id}`);
    const detail = (await detailRes.json()) as {
      boundary_snapshot: { goal_outcome: string; motivation: string; scope_out: string };
    };
    assert.equal(detail.boundary_snapshot.goal_outcome, "我能独立画一遍");
    assert.equal(detail.boundary_snapshot.scope_out, "没有");
    assert.equal(detail.boundary_snapshot.motivation, "因为工作要用");
  });

  it("keeps a single current_topic_id", () => {
    const store = new Store(openMemoryDb());
    const a = store.createTopic("甲");
    const b = store.createTopic("乙");
    assert.equal(store.getCurrentTopicId(), b.id);
    store.setCurrentTopic(a.id);
    assert.equal(store.getCurrentTopicId(), a.id);
    assert.notEqual(store.getCurrentTopicId(), b.id);
  });
});
