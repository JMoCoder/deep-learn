import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createApp } from "../app.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { AgentHost, toClientMessages } from "./runtime.js";

function seedLearning(store: Store) {
  const topic = store.createTopic("测量入门");
  store.finalizeBoundaries(topic.id, [
    { kind: "goal_outcome", question: "g", answer: "我能独立画一遍测量" },
    { kind: "prior_level", question: "p", answer: "只会定义" },
    { kind: "scope_out", question: "s", answer: "弦论" },
    { kind: "depth", question: "d", answer: "能讲清" },
    { kind: "chunk_budget", question: "c", answer: "每周 2 小时" },
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

describe("toClientMessages learn projection", () => {
  it("keeps strategy and citations needed for refuse+reflow", () => {
    const raw = [
      {
        role: "user",
        content: [{ type: "text", text: "顺便把弦论也讲一遍" }],
        timestamp: 1,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "这个问题落在排除区（弦论），这次不展开。" }],
        timestamp: 2,
        strategy: "REFUSE_OFFSCOPE",
        citations: [{ section_id: "sec-1" }],
      },
    ] as AgentMessage[];
    const msgs = toClientMessages(raw);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[1]?.strategy, "REFUSE_OFFSCOPE");
    assert.deepEqual(msgs[1]?.citations, [{ section_id: "sec-1" }]);
  });

  it("reload path GET messages still has strategy after a refuse turn", async () => {
    const store = new Store(openMemoryDb());
    const topic = seedLearning(store);
    const { host } = createApp(store);
    await host.prompt(topic.id, "顺便把弦论也讲一遍");
    const live = host.messagesForClient(topic.id);
    const assistant = [...live].reverse().find((m) => m.role === "assistant");
    assert.ok(assistant);
    assert.equal(assistant.strategy, "REFUSE_OFFSCOPE");

    const fresh = new AgentHost(store);
    const reloaded = fresh.messagesForClient(topic.id);
    const again = [...reloaded].reverse().find((m) => m.role === "assistant");
    assert.ok(again);
    assert.equal(again.strategy, "REFUSE_OFFSCOPE");
  });
});
