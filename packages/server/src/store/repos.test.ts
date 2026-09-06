import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "./db.js";
import { Store } from "./repos.js";

describe("store invariants", () => {
  it("keeps a single current_topic_id", () => {
    const store = new Store(openMemoryDb());
    const a = store.createTopic("甲");
    assert.equal(store.getCurrentTopicId(), a.id);
    const b = store.createTopic("乙");
    assert.equal(store.getCurrentTopicId(), b.id);
    store.setCurrentTopic(a.id);
    assert.equal(store.getCurrentTopicId(), a.id);
  });

  it("notes only exist via appendNote", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("笔记");
    assert.equal(store.listNotes(topic.id).length, 0);
    store.appendNote(topic.id, "助手记下的卡点");
    assert.equal(store.listNotes(topic.id).length, 1);
    assert.match(store.listNotes(topic.id)[0]!.body, /卡点/);
  });

  it("phase moves only through finalize helpers", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("阶段");
    assert.equal(topic.phase, "boundary_interview");
    store.askBoundary(topic.id, "goal", "目标？");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "目标？", answer: "我能独立推一遍" },
      { kind: "prior", question: "先验？", answer: "只会定义" },
    ]);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
    store.replaceOutline(
      topic.id,
      "独立推一遍",
      [
        {
          title: "定向",
          intent: "地图",
          objective: "能指出地图",
          target_chars: 600,
          children: [{ title: "过关", intent: "证据", objective: "能写出证据" }],
        },
      ],
      "draft",
    );
    store.finalizeOutline(topic.id);
    assert.equal(store.requireTopic(topic.id).phase, "learning");
  });

  it("does not expose api keys on public settings", () => {
    const store = new Store(openMemoryDb());
    store.putSettings({
      provider: "openai",
      modelId: "gpt-4o-mini",
      baseUrl: "",
      apiKey: "sk-secret-should-not-leak",
    });
    const pub = store.publicSettings();
    assert.equal(pub.hasApiKey, true);
    assert.ok(!JSON.stringify(pub).includes("sk-secret"));
  });
});
