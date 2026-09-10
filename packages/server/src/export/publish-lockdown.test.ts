import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { createApp, LOCAL_PREVIEW_ORIGINS } from "../app.js";
import { config } from "../config.js";
import { isSafeExportSegment, resolveExportFile } from "./safe-path.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";

const TOKEN = "test-preview-token";

function gatedApp(store = new Store(openMemoryDb())) {
  return { ...createApp(store, undefined, { apiToken: TOKEN }), store };
}

function auth(init: RequestInit = {}, header: "bearer" | "x" = "bearer"): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (header === "bearer") headers.set("authorization", `Bearer ${TOKEN}`);
  else headers.set("x-quantum-token", TOKEN);
  return { ...init, headers };
}

describe("local preview publish lockdown", () => {
  it("GET /api/health stays open and does not dump config", async () => {
    const { app } = gatedApp();
    const res = await app.request("/api/health");
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.ok, true);
    assert.equal(body.name, "quantum");
    assert.ok(body.coachMode === "stub" || body.coachMode === "live");
    assert.equal(body.apiToken, undefined);
    assert.equal(body.host, undefined);
    assert.equal(body.QUANTUM_API_TOKEN, undefined);
    assert.equal(body.QUANTUM_HOST, undefined);
  });

  it("gated reads/writes/SSE/exports return 401 without token and 200/201 with token", async () => {
    const { app, store } = gatedApp();
    const topic = store.createTopic("锁");
    const filename = `${topic.id}.md`;
    const abs = resolveExportFile(topic.id, filename);
    assert.ok(abs);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "# ok\n");

    const protectedPaths: Array<{ path: string; method?: string; body?: string }> = [
      { path: "/api/state" },
      { path: "/api/settings" },
      { path: "/api/heatmap" },
      { path: "/api/topics" },
      { path: `/api/topics/${topic.id}` },
      { path: "/api/topics/current/projection" },
      { path: "/api/session/messages" },
      { path: "/api/session/events" },
      { path: `/api/exports/${topic.id}/${filename}` },
      { path: "/api/settings", method: "PUT", body: JSON.stringify({ modelId: "x" }) },
      { path: "/api/session/prompt", method: "POST", body: JSON.stringify({ text: "hi" }) },
      { path: "/api/topics", method: "POST", body: JSON.stringify({ title: "新" }) },
      { path: `/api/topics/${topic.id}/export`, method: "POST", body: JSON.stringify({ format: "md" }) },
      { path: `/api/topics/${topic.id}/confirm-boundary`, method: "POST" },
      { path: `/api/topics/${topic.id}/confirm-outline`, method: "POST" },
      { path: `/api/topics/${topic.id}/reduce-outline`, method: "POST" },
    ];

    for (const item of protectedPaths) {
      const naked = await app.request(item.path, {
        method: item.method ?? "GET",
        body: item.body,
        headers: item.body ? { "content-type": "application/json" } : undefined,
      });
      assert.equal(naked.status, 401, `${item.method ?? "GET"} ${item.path} should be 401`);
    }

    const state = await app.request("/api/state", auth());
    assert.equal(state.status, 200);

    const viaHeader = await app.request("/api/topics", auth({}, "x"));
    assert.equal(viaHeader.status, 200);

    const created = await app.request(
      "/api/topics",
      auth({ method: "POST", body: JSON.stringify({ title: "有令" }) }),
    );
    assert.equal(created.status, 201);

    const settings = await app.request(
      "/api/settings",
      auth({ method: "PUT", body: JSON.stringify({ modelId: "gated-ok" }) }),
    );
    assert.equal(settings.status, 200);

    const exported = await app.request(`/api/exports/${topic.id}/${filename}`, auth());
    assert.equal(exported.status, 200);
  });

  it("wrong token is 401; CORS is not * and preflight allows token headers", async () => {
    const { app } = gatedApp();
    const wrong = await app.request("/api/state", {
      headers: { authorization: "Bearer nope" },
    });
    assert.equal(wrong.status, 401);

    const denied = await app.request("/api/health", {
      headers: { origin: "https://evil.example" },
    });
    assert.notEqual(denied.headers.get("access-control-allow-origin"), "*");
    assert.notEqual(denied.headers.get("access-control-allow-origin"), "https://evil.example");

    for (const origin of LOCAL_PREVIEW_ORIGINS) {
      const allowed = await app.request("/api/health", { headers: { origin } });
      assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
    }

    const preflight = await app.request("/api/state", {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:43127",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,x-quantum-token",
      },
    });
    assert.ok(preflight.status === 204 || preflight.status === 200);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "http://127.0.0.1:43127");
    const allowHeaders = (preflight.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    assert.match(allowHeaders, /authorization/);
    assert.match(allowHeaders, /x-quantum-token/);
  });

  it("export GET rejects traversal and requires a real topic", async () => {
    const { app, store } = gatedApp();
    const topic = store.createTopic("导出");
    const okName = `${topic.id}.md`;
    const abs = resolveExportFile(topic.id, okName);
    assert.ok(abs);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "safe\n");

    const secret = resolve(config.dataDir, "outside-secret.txt");
    writeFileSync(secret, "nope\n");

    const attacks = [
      `/api/exports/${encodeURIComponent("..")}/${encodeURIComponent("outside-secret.txt")}`,
      `/api/exports/${encodeURIComponent("../")}/${okName}`,
      `/api/exports/${topic.id}/${encodeURIComponent("..")}`,
      `/api/exports/${topic.id}/${encodeURIComponent("../outside-secret.txt")}`,
      `/api/exports/${topic.id}/${encodeURIComponent("..\\outside-secret.txt")}`,
      `/api/exports/${encodeURIComponent(`${topic.id}/../${topic.id}`)}/${okName}`,
      `/api/exports/${encodeURIComponent("/etc")}/${encodeURIComponent("passwd")}`,
    ];

    for (const path of attacks) {
      const res = await app.request(path, auth());
      assert.ok(res.status === 400 || res.status === 404, `${path} → ${res.status}`);
      const text = await res.text();
      assert.ok(!text.includes("nope"), `leaked file via ${path}`);
    }

    const missingTopic = await app.request(`/api/exports/top_doesnotexist000/${okName}`, auth());
    assert.equal(missingTopic.status, 404);

    const ok = await app.request(`/api/exports/${topic.id}/${okName}`, auth());
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "safe\n");
  });

  it("resolveExportFile stays under the exports root after realpath", () => {
    assert.equal(isSafeExportSegment(".."), false);
    assert.equal(isSafeExportSegment("../x"), false);
    assert.equal(isSafeExportSegment("a/b"), false);
    assert.equal(isSafeExportSegment("a\\b"), false);
    assert.equal(isSafeExportSegment("/etc"), false);
    assert.equal(isSafeExportSegment("top_abc"), true);

    const topic = "top_safeexport0000";
    const filename = `${topic}.md`;
    const dest = resolveExportFile(topic, filename);
    assert.ok(dest);
    mkdirSync(dirname(dest), { recursive: true });
    const outside = resolve(config.dataDir, "escaped.txt");
    writeFileSync(outside, "escaped\n");
    const link = resolve(dirname(dest), "link.md");
    try {
      symlinkSync(outside, link);
    } catch {
      return;
    }
    assert.equal(resolveExportFile(topic, "link.md"), null);
    assert.equal(resolveExportFile("..", "escaped.txt"), null);
    assert.equal(resolveExportFile(topic, "../escaped.txt"), null);
  });
});
