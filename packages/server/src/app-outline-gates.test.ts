import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countOutlineLeaves } from "@quantum/shared";
import { createApp } from "./app.js";
import { outlineFromBoundaries } from "./learning/outline-from-boundaries.js";
import { openMemoryDb } from "./store/db.js";
import { Store } from "./store/repos.js";

const FIVE = [
  { kind: "goal_outcome" as const, question: "g", answer: "我能独立画一遍" },
  { kind: "prior_level" as const, question: "p", answer: "只会定义" },
  { kind: "scope_out" as const, question: "s", answer: "弦论" },
  { kind: "depth" as const, question: "d", answer: "能讲清" },
  { kind: "chunk_budget" as const, question: "c", answer: "每次 20 分钟" },
];

function draftTopic(confirmed: boolean) {
  const store = new Store(openMemoryDb());
  const topic = store.createTopic("闸");
  store.finalizeBoundaries(topic.id, FIVE);
  const drafted = outlineFromBoundaries(store.listBoundaries(topic.id));
  store.replaceOutline(topic.id, drafted.title, drafted.nodes, "draft");
  if (confirmed) store.setTopicGates(topic.id, { boundaryConfirmed: true });
  const { app } = createApp(store);
  return { app, store, topic };
}

describe("outline confirm / reduce HTTP gates", () => {
  it("confirm-outline requires the web boundary-confirm gate", async () => {
    const { app, topic, store } = draftTopic(false);
    const res = await app.request(`/api/topics/${topic.id}/confirm-outline`, { method: "POST" });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, false);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
  });

  it("confirm-outline runs finalize_outline when shared budget allows", async () => {
    const { app, topic, store } = draftTopic(true);
    const res = await app.request(`/api/topics/${topic.id}/confirm-outline`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; phase: string };
    assert.equal(body.ok, true);
    assert.equal(body.phase, "learning");
    assert.equal(store.requireTopic(topic.id).phase, "learning");
  });

  it("reduce-outline requires the same card visibility gate as confirm", async () => {
    const { app, topic, store } = draftTopic(false);
    const res = await app.request(`/api/topics/${topic.id}/reduce-outline`, { method: "POST" });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, false);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
  });

  it("reduce-outline re-drafts via draft_outline", async () => {
    const { app, topic, store } = draftTopic(true);
    const beforeLeaves = countOutlineLeaves(store.getOutline(topic.id));
    const res = await app.request(`/api/topics/${topic.id}/reduce-outline`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; leafCount?: number };
    assert.equal(body.ok, true);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
    const afterLeaves = countOutlineLeaves(store.getOutline(topic.id));
    assert.ok(afterLeaves > 0);
    assert.ok(typeof body.leafCount === "number");
    assert.equal(body.leafCount, afterLeaves);
    assert.ok(beforeLeaves >= afterLeaves || afterLeaves > 0);
  });
});

