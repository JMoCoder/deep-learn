import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../app.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { importHtmlBook } from "../import/html-book.js";

describe("topic archive lifecycle", () => {
  it("archives hide from active list and clears current when last active", () => {
    const store = new Store(openMemoryDb());
    const a = store.createTopic("甲");
    const b = store.createTopic("乙");
    assert.equal(store.getCurrentTopicId(), b.id);
    store.setTopicArchived(b.id, true);
    assert.equal(store.getCurrentTopicId(), a.id);
    assert.equal(store.listTopics({ archived: false }).length, 1);
    assert.equal(store.listTopics({ archived: true }).length, 1);
    store.setTopicArchived(a.id, true);
    assert.equal(store.getCurrentTopicId(), null);
    assert.equal(store.hasActiveTopics(), false);
    store.setTopicArchived(a.id, false);
    assert.equal(store.hasActiveTopics(), true);
    assert.equal(store.getCurrentTopicId(), a.id);
  });

  it("permanent delete removes rows", async () => {
    const store = new Store(openMemoryDb());
    const { topic } = importHtmlBook(
      store,
      "<html><body><h2>一</h2><p>甲</p></body></html>",
      "删我",
    );
    store.setTopicArchived(topic.id, true);
    store.deleteTopic(topic.id);
    assert.equal(store.getTopic(topic.id), null);
    assert.equal(store.listTopics({ archived: true }).length, 0);

    const { app } = createApp(new Store(openMemoryDb()));
    const created = await app.request("/api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "归档测" }),
    });
    assert.equal(created.status, 201);
    const body = (await created.json()) as { id: string };
    const arch = await app.request(`/api/topics/${body.id}/archive`, { method: "POST" });
    assert.equal(arch.status, 200);
    const state = (await (await app.request("/api/state")).json()) as {
      hasActiveTopics: boolean;
    };
    assert.equal(state.hasActiveTopics, false);
    const listed = await app.request("/api/topics?archived=1");
    assert.equal(((await listed.json()) as unknown[]).length, 1);
  });
});
