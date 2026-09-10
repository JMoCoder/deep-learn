import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../app.js";
import { bus } from "../agent/bus.js";
import { planCoachTurn } from "../agent/coach.js";
import { beginTurn, endTurn } from "../agent/turn-meta.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { createQuantumTools } from "../tools/factory.js";
import { hitsScopeOut, scopeOutNeedles, topicHitsScopeOut } from "./scope-out.js";
import { scaffoldSectionBody } from "./section-scaffold.js";
import { flattenOutline } from "../store/repos.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { snapshotFromAnswers, type SessionEvent } from "@quantum/shared";

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

/** Learning topic whose prior answer echoes scope_out — first leaf not yet projected. */
function seedLearningPriorEchoesScopeOut(store: Store) {
  const topic = store.createTopic("测量入门");
  store.finalizeBoundaries(topic.id, [
    { kind: "goal", question: "g", answer: "我能独立画一遍测量" },
    { kind: "prior", question: "p", answer: "只碰过弦论科普" },
    { kind: "scope_out", question: "s", answer: "弦论" },
    { kind: "depth", question: "d", answer: "能讲清" },
    { kind: "chunk_budget", question: "c", answer: "每周 2 小时" },
    { kind: "scope_in", question: "i", answer: "测量公设与自旋" },
  ]);
  store.replaceOutline(
    topic.id,
    "独立画一遍测量",
    [
      { title: "定向：地图", intent: "地图", objective: "能指出接入点" },
      { title: "核心：投影公设", intent: "公设", objective: "能写出投影" },
    ],
    "finalized",
  );
  store.finalizeOutline(topic.id);
  return topic;
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
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "坚决不碰弦论"), true);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "排除：弦论"), true);
    assert.equal(hitsScopeOut("顺便把弦论也讲一遍", "坚决不碰什么？弦论"), true);
    assert.ok(scopeOutNeedles("坚决不碰弦论").includes("弦论"));
    assert.ok(scopeOutNeedles("排除：弦论").includes("弦论"));
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

  it("persists constraint「坚决不碰弦论」as that raw scope_out and refuses 顺便讲一遍", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("测量入门");
    store.finalizeBoundaries(topic.id, [
      { kind: "motivation", question: "m", answer: "因为工作要用" },
      { kind: "goal", question: "g", answer: "我能独立画一遍测量" },
      { kind: "success_evidence", question: "e", answer: "能讲 10 分钟" },
      { kind: "prior", question: "p", answer: "只会定义" },
      { kind: "prior_gaps", question: "g2", answer: "会：态矢量；不会：投影公设" },
      { kind: "scope_in", question: "i", answer: "测量公设" },
      { kind: "constraint", question: "s", answer: "坚决不碰弦论" },
      { kind: "depth", question: "d", answer: "能讲清" },
      { kind: "time", question: "t", answer: "每次 20 分钟" },
    ]);
    const constraint = store.listBoundaries(topic.id).find((b) => b.kind === "constraint");
    assert.equal(constraint?.answer, "坚决不碰弦论");
    const packed = snapshotFromAnswers(store.listBoundaries(topic.id));
    assert.equal(packed.scope_out, "坚决不碰弦论");
    assert.ok(scopeOutNeedles(packed.scope_out).includes("弦论"));
    assert.equal(topicHitsScopeOut(store, topic.id, "顺便把弦论也讲一遍"), true);

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

    const refuse = planCoachTurn(store, topic.id, "顺便把弦论也讲一遍");
    assert.equal(refuse.strategy, "REFUSE_OFFSCOPE");
    assert.equal(refuse.tool, undefined);

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

    endTurn(topic.id);
    const bodyBlocked = await exec(append, { body: "顺便把弦论也讲一遍", reason_code: 3 });
    assert.equal(bodyBlocked.details.ok, false);
    assert.equal(bodyBlocked.details.strategy, "REFUSE_OFFSCOPE");
    assert.equal(store.listNotes(topic.id).length, 1);

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

  it("on-topic first-leaf generate_section is not refused when only scaffold echoes scope_out", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearningPriorEchoesScopeOut(store);
    const outline = flattenOutline(store.getOutline(topic.id));
    const first = outline[0]!;
    const body = scaffoldSectionBody(first, topic.title, store.listBoundaries(topic.id), outline);
    assert.match(body, /只碰过弦论科普/);
    assert.equal(hitsScopeOut(body, "弦论"), true);
    assert.equal(topicHitsScopeOut(store, topic.id, "请开始"), false);
    assert.equal(topicHitsScopeOut(store, topic.id, "下一节"), false);

    const tools = createQuantumTools({
      store,
      topicId: topic.id,
      requireTopic: () => store.requireTopic(topic.id),
      emit: () => undefined,
    });
    const generate = tools.find((t) => t.name === "generate_section")!;

    beginTurn(topic.id, "SCAFFOLD", "请开始");
    const firstLeaf = await exec(generate, {
      outline_node_id: first.id,
      title: first.title,
      body_md: body,
    });
    assert.notEqual(firstLeaf.details.ok, false);
    assert.notEqual(firstLeaf.details.strategy, "REFUSE_OFFSCOPE");
    const written = store.getSectionByOutline(first.id);
    assert.ok(written);
    assert.match(written.bodyMd, /只碰过弦论科普/);
    endTurn(topic.id);

    const next = outline[1]!;
    const advanceBody = scaffoldSectionBody(next, topic.title, store.listBoundaries(topic.id), outline);
    beginTurn(topic.id, "ADVANCE", "下一节");
    const advanced = await exec(generate, {
      outline_node_id: next.id,
      title: next.title,
      body_md: advanceBody,
    });
    assert.notEqual(advanced.details.ok, false);
    assert.ok(store.getSectionByOutline(next.id));
    endTurn(topic.id);

    beginTurn(topic.id, "SCAFFOLD", "顺便把弦论也讲一遍");
    const userHit = await exec(generate, {
      outline_node_id: first.id,
      title: first.title,
      body_md: "测量正文，无脚手架回声。",
    });
    assert.equal(userHit.details.ok, false);
    assert.equal(userHit.details.strategy, "REFUSE_OFFSCOPE");
    endTurn(topic.id);

    const refuse = planCoachTurn(store, topic.id, "顺便把弦论也讲一遍");
    assert.equal(refuse.strategy, "REFUSE_OFFSCOPE");
    assert.equal(refuse.tool, undefined);
    assert.equal(store.listNotes(topic.id).length, 0);

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

  it("host.prompt projects the first on-topic leaf when prior echoes scope_out", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearningPriorEchoesScopeOut(store);
    const first = store.getOutline(topic.id)[0]!;
    assert.equal(store.getSectionByOutline(first.id), null);

    const { host } = createApp(store);
    const events: SessionEvent[] = [];
    const unsub = bus.subscribe((event) => events.push(event));
    try {
      await host.prompt(topic.id, "请开始");
    } finally {
      unsub();
    }
    const section = store.getSectionByOutline(first.id);
    assert.ok(section);
    assert.match(section.bodyMd, /只碰过弦论科普/);
    assert.equal(
      events.some((e) => e.type === "section_ready"),
      true,
    );
    assert.equal(store.listNotes(topic.id).length, 0);
    assert.equal(
      events.some((e) => e.type === "note_appended"),
      false,
    );
    const assistant = events.find(
      (e): e is Extract<SessionEvent, { type: "message" }> =>
        e.type === "message" && e.role === "assistant",
    );
    assert.notEqual(assistant?.strategy, "REFUSE_OFFSCOPE");
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
