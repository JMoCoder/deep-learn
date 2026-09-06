import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { build_tutor_context } from "./tutor-context.js";

describe("build_tutor_context", () => {
  it("exposes L0–L4 and required snapshot fields", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("打包");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "g", answer: "我能独立画一遍" },
      { kind: "prior", question: "p", answer: "只会定义" },
    ]);
    store.replaceOutline(
      topic.id,
      "独立画一遍",
      [{ title: "定向", intent: "地图", objective: "能指出接入点", target_chars: 800 }],
      "finalized",
    );
    store.finalizeOutline(topic.id);
    store.appendNote(topic.id, "卡在符号", undefined, "friction");

    const ctx = build_tutor_context(store, topic.id);
    assert.ok(ctx);
    assert.equal(ctx.L0.topicId, topic.id);
    assert.equal(ctx.L0.phase, "learning");
    assert.equal(ctx.L1.snapshot.goal, "我能独立画一遍");
    assert.equal(ctx.L1.snapshot.prior, "只会定义");
    assert.equal(ctx.L1.snapshot.time, "unspecified");
    assert.ok("success" in ctx.L1.snapshot);
    assert.ok("first_gap" in ctx.L1.snapshot);
    assert.ok("scaffold_pref" in ctx.L1.snapshot);
    assert.equal(ctx.L2.tree[0]?.objective, "能指出接入点");
    assert.equal(ctx.L2.tree[0]?.title, "定向");
    assert.equal(ctx.L3.body.length >= 0, true);
    assert.equal(ctx.L4.recentNotes[0]?.reasonCode, "friction");
    assert.equal(ctx.L4.strategyHint, "GROUND");
  });
});
