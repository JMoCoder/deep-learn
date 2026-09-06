import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { build_tutor_context, renderTutorContext } from "./tutor-context.js";

describe("build_tutor_context", () => {
  it("exposes L0+L1 operational snapshot fields and defers L4", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("打包");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "g", answer: "我能独立画一遍" },
      { kind: "prior", question: "p", answer: "只会定义" },
      { kind: "time", question: "t", answer: "每周 3 小时" },
      { kind: "depth", question: "d", answer: "能讲清" },
      { kind: "constraint", question: "c", answer: "没有" },
    ]);
    store.replaceOutline(
      topic.id,
      "独立画一遍",
      [{ title: "定向", intent: "地图", objective: "能指出接入点", target_chars: 800 }],
      "finalized",
    );
    store.finalizeOutline(topic.id);
    store.appendNote(topic.id, "卡在符号", undefined, 2);

    const ctx = build_tutor_context(store, topic.id);
    assert.ok(ctx);
    assert.equal(ctx.L0.topicId, topic.id);
    assert.equal(ctx.L0.phase, "learning");
    assert.equal(ctx.L0.strategyHint, "SCAFFOLD");
    assert.equal(ctx.L1.snapshot.goal_outcome, "我能独立画一遍");
    assert.equal(ctx.L1.snapshot.prior_level, "只会定义");
    assert.equal(ctx.L1.snapshot.chunk_budget, "每周 3 小时");
    assert.equal(ctx.L1.snapshot.scope_out, "没有");
    assert.equal(ctx.L1.snapshot.depth, "能讲清");
    assert.equal(ctx.L1.body, "");
    assert.equal(ctx.L2.tree[0]?.objective, "能指出接入点");
    assert.equal(ctx.L4, undefined);

    const withL4 = build_tutor_context(store, topic.id, { includeL4: true });
    assert.equal(withL4?.L4?.recentNotes[0]?.reasonCode, 2);
    assert.equal(withL4?.L4?.recentNotes[0]?.type, "疑问");

    const rendered = renderTutorContext(ctx);
    assert.ok(!rendered.includes("apiKey"));
    assert.match(rendered, /L0–L3/);
  });
});
