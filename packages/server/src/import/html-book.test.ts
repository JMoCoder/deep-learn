import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { htmlFragmentToMd, importHtmlBook, parseHtmlBook } from "./html-book.js";
import { createApp } from "../app.js";

describe("html book import", () => {
  it("parses title and h2 sections", () => {
    const parsed = parseHtmlBook(`<!doctype html><html><head><title>测量入门</title></head>
<body><h2>定向</h2><p>先分清测量与理论。</p><h2>核心</h2><p>误差与不确定度。</p></body></html>`);
    assert.equal(parsed.title, "测量入门");
    assert.equal(parsed.sections.length, 2);
    assert.equal(parsed.sections[0]!.title, "定向");
    assert.match(parsed.sections[0]!.bodyMd, /测量与理论/);
    assert.equal(parsed.sections[1]!.title, "核心");
  });

  it("strips scripts and keeps emphasis", () => {
    const md = htmlFragmentToMd(`<p>看 <strong>关键</strong> 量</p><script>alert(1)</script>`);
    assert.match(md, /\*\*关键\*\*/);
    assert.equal(/alert/.test(md), false);
  });

  it("imports into learning phase with ready sections", () => {
    const store = new Store(openMemoryDb());
    const { topic, sectionCount } = importHtmlBook(
      store,
      `<html><body><h1>甲</h1><p>导言</p><h2>乙</h2><p>正文乙</p></body></html>`,
    );
    assert.equal(topic.phase, "learning");
    assert.equal(sectionCount, 2);
    assert.equal(store.getCurrentTopicId(), topic.id);
    const section = store.getSection(store.getCurrentSectionId()!);
    assert.ok(section);
    assert.ok(section.bodyMd.length > 0);
  });

  it("POST /api/topics/import-html creates a readable book without generation kickoff", async () => {
    const prev = process.env.QUANTUM_GENERATION_ENABLED;
    delete process.env.QUANTUM_GENERATION_ENABLED;
    try {
      const store = new Store(openMemoryDb());
      const { app } = createApp(store);
      const res = await app.request("/api/topics/import-html", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          html: "<html><body><h2>一</h2><p>甲</p><h2>二</h2><p>乙</p></body></html>",
          title: "导入书",
        }),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as {
        topic: { title: string; phase: string };
        sectionCount: number;
      };
      assert.equal(body.topic.title, "导入书");
      assert.equal(body.topic.phase, "learning");
      assert.equal(body.sectionCount, 2);

      const topicId = store.getCurrentTopicId()!;
      const frozen = await app.request(`/api/topics/${topicId}/confirm-boundary`, {
        method: "POST",
      });
      assert.equal(frozen.status, 403);

      const health = await app.request("/api/health");
      const h = (await health.json()) as { generationEnabled: boolean };
      assert.equal(h.generationEnabled, false);
    } finally {
      if (prev === undefined) delete process.env.QUANTUM_GENERATION_ENABLED;
      else process.env.QUANTUM_GENERATION_ENABLED = prev;
    }
  });
});
