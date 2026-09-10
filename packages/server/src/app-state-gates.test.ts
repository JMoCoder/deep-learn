import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "./app.js";
import { openMemoryDb } from "./store/db.js";
import { Store } from "./store/repos.js";

describe("GET /api/state learn gates", () => {
  it("returns persisted confirm/finalize and currentTopicId as the only pointer", async () => {
    const store = new Store(openMemoryDb());
    const { app } = createApp(store);

    const empty = (await (await app.request("/api/state")).json()) as {
      currentTopicId: string | null;
      boundaryConfirmed: boolean;
      boundaryFinalized: boolean;
    };
    assert.equal(empty.currentTopicId, null);
    assert.equal(empty.boundaryConfirmed, false);
    assert.equal(empty.boundaryFinalized, false);

    const topic = store.createTopic("测量入门");
    const created = (await (await app.request("/api/state")).json()) as {
      currentTopicId: string | null;
      boundaryConfirmed: boolean;
      boundaryFinalized: boolean;
    };
    assert.equal(created.currentTopicId, topic.id);
    assert.equal(created.boundaryConfirmed, false);
    assert.equal(created.boundaryFinalized, false);

    const tooEarly = await app.request(`/api/topics/${topic.id}/confirm-boundary`, {
      method: "POST",
    });
    assert.equal(tooEarly.status, 400);

    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "目标？", answer: "我能独立推一遍" },
      { kind: "prior", question: "先验？", answer: "只会定义" },
    ]);
    const finalized = (await (await app.request("/api/state")).json()) as {
      boundaryConfirmed: boolean;
      boundaryFinalized: boolean;
      topic: { phase: string } | null;
    };
    assert.equal(finalized.topic?.phase, "outline_draft");
    assert.equal(finalized.boundaryFinalized, true);
    assert.equal(finalized.boundaryConfirmed, false);

    const missing = await app.request("/api/topics/top_missing/confirm-boundary", {
      method: "POST",
    });
    assert.equal(missing.status, 404);

    const confirm = await app.request(`/api/topics/${topic.id}/confirm-boundary`, { method: "POST" });
    assert.equal(confirm.status, 200);
    const confirmed = (await (await app.request("/api/state")).json()) as {
      boundaryConfirmed: boolean;
      boundaryFinalized: boolean;
    };
    assert.equal(confirmed.boundaryConfirmed, true);
    assert.equal(confirmed.boundaryFinalized, true);
  });
});
