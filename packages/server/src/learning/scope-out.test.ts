import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../app.js";
import { bus } from "../agent/bus.js";
import { planCoachTurn } from "../agent/coach.js";
import { beginTurn, endTurn } from "../agent/turn-meta.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { createQuantumTools } from "../tools/factory.js";
import { hitsScopeOut } from "./scope-out.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { SessionEvent } from "@quantum/shared";

function seedLearning(store: Store, scopeOut = "弦论") {
  const topic = store.createTopic("测量入门");
  store.finalizeBoundaries(topic.id, [
    { kind: "goal_outcome", question: "g", answer: "我能独立画一遍测量" },
    { kind: "prior_level", question: "p", answer: "只会定义" },
    { kind: "scope_out", question: "s", answer: scopeOut },
    { kind: "depth", question: "d", answer: "能讲清" },
    { kind: "chunk_budget", question: "c", answer: "每周 2 小时" },
    { kind: "scope_in", question: "i", answer: "测量公设与自旋" },
  ]);
  store.replaceOutline(
    topic.id,
    "独立画一遍测量",
    [{ title: "定向：地图", intent: "地图", objective: "能指出接入点" }],
    "finalized",
  );
  store.finalizeOutline(topic.id);
  const node = store.getOutline(topic.id)[0]!;
  store.upsertSection(topic.id, node.id, node.title, "第一节正文。");
  store.setCurrentSection(node.id);
  return topic;
}

async function exec(tool: AgentTool, args: Record<string, unknown>) {
  return tool.execute("call", args as never);
}

function seedConstraintWalk(store: Store) {
  const topic = store.createTopic("测量入门");
  store.finalizeBoundaries(topic.id, [
    { kind: "motivation", question: "m", answer: "因为工作要用" },
    { kind: "goal", question: "g", answer: "我能独立画一遍测量" },
    { kind: "success_evidence", question: "e", answer: "能讲 10 分钟" },
    { kind: "prior", question: "p", answer: "只会定义" },
    { kind: "prior_gaps", question: "g2", answer: "会：态矢量；不会：投影公设" },
    { kind: "scope_in", question: "i", answer: "测量公设" },
    { kind: "constraint", question: "s", answer: "排除弦论" },
    { kind: "depth", question: "d", answer: "能讲清" },
    { kind: "time", question: "t", answer: "每次 20 分钟" },
  ]);
  store.replaceOutline(
    topic.id,
    "独立画一遍测量",
    [{ title: "定向：地图", intent: "地图", objective: "能指出接入点" }],
    "finalized",
  );
  store.finalizeOutline(topic.id);
  const node = store.getOutline(topic.id)[0]!;
  store.upsertSection(topic.id, node.id, node.title, "第一节正文。");
  store.setCurrentSection(node.id);
  return topic;
}

describe("2.7 scope_out refuse", () => {
  it("matches keywords and packed phrases, ignores 没有", () => {
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "弦论"), true);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "排除弦论"), true);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "弦论。"), true);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "不碰弦论"), true);
    assert.equal(hitsScopeOut("想听广义相对论和弦论", "弦论和硬件"), true);
    assert.equal(hitsScopeOut("卡在投影公设", "弦论"), false);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "没有"), false);
    assert.equal(hitsScopeOut("随便问问", ""), false);
  });

  it("refuses offscope user turns without append_note or generate_section", () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearning(store);
    const refuse = planCoachTurn(store, topic.id, "顺便把弦论也讲一遍");
    assert.equal(refuse.strategy, "REFUSE_OFFSCOPE");
    assert.equal(refuse.tool, undefined);
    assert.match(refuse.text, /排除区|弦论|不展开/);
    assert.equal(store.listNotes(topic.id).length, 0);

    const inScope = planCoachTurn(store, topic.id, "这里看不懂投影公设");
    assert.equal(inScope.strategy, undefined);
    assert.equal(inScope.tool?.name, "append_note");
  });

  it("hits constraint-walk 排除弦论 even when the user wraps it in 顺便讲一遍", () => {
    const store = new Store(openMemoryDb());
    const topic = seedConstraintWalk(store);
    const refuse = planCoachTurn(store, topic.id, {
      lastUserText: "顺便把弦论也讲一遍",
      lastRole: "toolResult",
      lastToolName: "get_section",
    });
    assert.equal(refuse.strategy, "REFUSE_OFFSCOPE");
    assert.equal(refuse.tool, undefined);
    assert.equal(store.listNotes(topic.id).length, 0);
  });

  it("blocks append_note on a REFUSE_OFFSCOPE turn and leaves in-scope notes unchanged", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearning(store);
    const tools = createQuantumTools({
      store,
      topicId: topic.id,
      requireTopic: () => store.requireTopic(topic.id),
      emit: () => undefined,
    });
    const append = tools.find((t) => t.name === "append_note")!;

    beginTurn(topic.id, "REFUSE_OFFSCOPE");
    const blocked = await exec(append, { body: "记下弦论要点", reason_code: 3 });
    assert.equal(blocked.details.ok, false);
    assert.equal(blocked.details.strategy, "REFUSE_OFFSCOPE");
    assert.equal(store.listNotes(topic.id).length, 0);
    endTurn(topic.id);

    const ok = await exec(append, { body: "卡在投影公设", reason_code: 2 });
    assert.equal(ok.details.ok, true);
    assert.equal(store.listNotes(topic.id).length, 1);
    assert.equal(store.listNotes(topic.id)[0]?.body, "卡在投影公设");

    beginTurn(topic.id, "GROUND", "顺便把弦论也讲一遍");
    const stillBlocked = await exec(append, { body: "记下弦论要点", reason_code: 3 });
    assert.equal(stillBlocked.details.ok, false);
    assert.equal(stillBlocked.details.strategy, "REFUSE_OFFSCOPE");
    assert.equal(store.listNotes(topic.id).length, 1);
    endTurn(topic.id);

    beginTurn(topic.id, "REFUSE_OFFSCOPE");
    const generate = tools.find((t) => t.name === "generate_section")!;
    const node = store.getOutline(topic.id)[0]!;
    const gen = await exec(generate, {
      outline_node_id: node.id,
      title: "弦论入门",
      body_md: "无关正文",
    });
    assert.equal(gen.details.ok, false);
    assert.equal(gen.details.strategy, "REFUSE_OFFSCOPE");
    endTurn(topic.id);
  });

  it("prompting the host with scope_out does not persist a note and emits REFUSE_OFFSCOPE", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearning(store);
    const { host } = createApp(store);
    const events: SessionEvent[] = [];
    const unsub = bus.subscribe((event) => events.push(event));
    try {
      await host.prompt(topic.id, "顺便把弦论也讲一遍");
    } finally {
      unsub();
    }
    assert.equal(store.listNotes(topic.id).length, 0);
    const message = events.find(
      (e): e is Extract<SessionEvent, { type: "message" }> =>
        e.type === "message" && e.role === "assistant",
    );
    assert.ok(message);
    assert.equal(message.strategy, "REFUSE_OFFSCOPE");
    assert.equal(
      events.some((e) => e.type === "note_appended"),
      false,
    );
  });

  it("constraint-walk 排除弦论: host.prompt stays REFUSE and writes no note", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedConstraintWalk(store);
    const { host } = createApp(store);
    const events: SessionEvent[] = [];
    const unsub = bus.subscribe((event) => events.push(event));
    try {
      await host.prompt(topic.id, "顺便把弦论也讲一遍");
    } finally {
      unsub();
    }
    assert.equal(store.listNotes(topic.id).length, 0);
    const message = events.find(
      (e): e is Extract<SessionEvent, { type: "message" }> =>
        e.type === "message" && e.role === "assistant",
    );
    assert.ok(message);
    assert.equal(message.strategy, "REFUSE_OFFSCOPE");
    assert.notEqual(message.strategy, "GROUND");
    assert.equal(
      events.some((e) => e.type === "note_appended"),
      false,
    );
  });
});
