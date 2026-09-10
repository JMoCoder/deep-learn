import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createApp } from "../app.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { resolveExportFile } from "./safe-path.js";

const FIVE = [
  { kind: "goal_outcome" as const, question: "g", answer: "我能独立画一遍" },
  { kind: "prior_level" as const, question: "p", answer: "只会定义" },
  { kind: "scope_out" as const, question: "s", answer: "弦论" },
  { kind: "depth" as const, question: "d", answer: "能讲清" },
  { kind: "chunk_budget" as const, question: "c", answer: "每周 2 小时" },
];

function seededApp() {
  const store = new Store(openMemoryDb());
  const topic = store.createTopic("导出主题");
  store.finalizeBoundaries(topic.id, FIVE);
  store.replaceOutline(
    topic.id,
    "我能独立画一遍",
    [{ title: "定向", intent: "地图", objective: "能指出路线", target_chars: 200 }],
    "finalized",
  );
  store.finalizeOutline(topic.id);
  store.upsertSection(topic.id, store.getOutline(topic.id)[0]!.id, "定向", "落盘正文：测量前后差别。");
  const { app } = createApp(store);
  return { app, store, topic };
}

describe("export HTTP is not fake-green", () => {
  it("md writes a real file and GET downloads it", async () => {
    const { app, topic } = seededApp();
    const posted = await app.request(`/api/topics/${topic.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "md" }),
    });
    assert.equal(posted.status, 200);
    const body = (await posted.json()) as {
      ok: boolean;
      filename: string;
      downloadPath: string;
    };
    assert.equal(body.ok, true);
    assert.match(body.filename, /\.md$/);
    assert.equal(body.downloadPath, `/api/exports/${topic.id}/${body.filename}`);
    const abs = resolveExportFile(topic.id, body.filename);
    assert.ok(abs && existsSync(abs));
    assert.match(readFileSync(abs, "utf8"), /导出主题|落盘正文/);

    const downloaded = await app.request(body.downloadPath);
    assert.equal(downloaded.status, 200);
    const text = await downloaded.text();
    assert.match(text, /落盘正文/);
    assert.match(downloaded.headers.get("content-disposition") ?? "", /attachment/);
  });

  it("html and epub write real files or return ok:false", async () => {
    const { app, topic } = seededApp();
    for (const format of ["html", "epub"] as const) {
      const posted = await app.request(`/api/topics/${topic.id}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const body = (await posted.json()) as {
        ok: boolean;
        filename?: string;
        downloadPath?: string;
        error?: string;
      };
      if (!body.ok) {
        assert.ok(body.error);
        continue;
      }
      assert.ok(body.filename && body.downloadPath);
      const abs = resolveExportFile(topic.id, body.filename);
      assert.ok(abs && existsSync(abs), `${format} claimed ok without a file`);
      if (format === "html") {
        assert.match(readFileSync(abs, "utf8"), /<!doctype html>/i);
      } else {
        const buf = readFileSync(abs);
        assert.equal(buf[0], 0x50);
        assert.equal(buf[1], 0x4b);
      }
      const downloaded = await app.request(body.downloadPath);
      assert.equal(downloaded.status, 200);
    }
  });

  it("does not return ok:true for an unsupported format", async () => {
    const { app, topic } = seededApp();
    const posted = await app.request(`/api/topics/${topic.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "pdf" }),
    });
    const body = (await posted.json()) as { ok: boolean };
    assert.equal(body.ok, false);
  });
});
