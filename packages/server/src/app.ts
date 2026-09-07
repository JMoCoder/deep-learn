import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { ExportFormat, SettingsInput } from "@quantum/shared";
import { snapshotFromAnswers } from "@quantum/shared";
import { AgentHost } from "./agent/runtime.js";
import { bus } from "./agent/bus.js";
import { config } from "./config.js";
import { collectPrereqEdges } from "./learning/prereq-edges.js";
import { Store } from "./store/repos.js";

export function createApp(store = new Store(), host = new AgentHost(store)) {
  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/api/health", (c) =>
    c.json({ ok: true, name: "quantum", coachMode: store.hasLiveModel() ? "live" : "stub" }),
  );

  app.get("/api/state", (c) => {
    const currentTopicId = store.getCurrentTopicId();
    return c.json({
      currentTopicId,
      topic: currentTopicId ? store.getTopic(currentTopicId) : null,
      currentSectionId: store.getCurrentSectionId(),
      coachMode: store.hasLiveModel() ? "live" : "stub",
      settings: store.publicSettings(),
    });
  });

  app.get("/api/settings", (c) => c.json(store.publicSettings()));

  app.put("/api/settings", async (c) => {
    const body = (await c.req.json()) as SettingsInput;
    const current = store.getSettings();
    const next = {
      provider: body.provider?.trim() || current.provider,
      modelId: body.modelId?.trim() || current.modelId,
      baseUrl: body.baseUrl?.trim() ?? current.baseUrl,
      apiKey: body.clearApiKey ? "" : body.apiKey?.trim() ? body.apiKey.trim() : current.apiKey,
    };
    store.putSettings(next);
    host.dropAll();
    return c.json(store.publicSettings());
  });

  app.get("/api/heatmap", (c) => c.json(store.heatmap()));

  app.get("/api/topics", (c) => c.json(store.listTopics()));

  app.get("/api/topics/current/projection", (c) => {
    const currentTopicId = store.getCurrentTopicId();
    if (!currentTopicId) {
      return c.json({
        topic_title: "",
        section_title: "",
        section_id: null,
        outline: [],
        prereq_edges: [],
        phase: "",
      });
    }
    const topic = store.requireTopic(currentTopicId);
    const currentSectionId = store.getCurrentSectionId();
    const section =
      (currentSectionId ? store.getSection(currentSectionId) : null) ??
      (currentSectionId ? store.getSectionByOutline(currentSectionId) : null);
    const outline = store.getOutline(currentTopicId);
    return c.json({
      topic_title: topic.title,
      section_title: section?.title ?? "",
      section_id: section?.id ?? currentSectionId,
      outline,
      prereq_edges: collectPrereqEdges(outline),
      phase: topic.phase,
    });
  });

  app.post("/api/topics", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { title?: string };
    const topic = store.createTopic(body.title?.trim() || "未命名主题");
    bus.emit({ type: "topic_updated", topicId: topic.id });
    bus.emit({
      type: "phase_changed",
      topicId: topic.id,
      phase: topic.phase,
      exportState: topic.exportState,
    });
    void host.kickoff(topic.id);
    return c.json(topic, 201);
  });

  app.patch("/api/topics/:id", async (c) => {
    const id = c.req.param("id");
    store.requireTopic(id);
    const body = (await c.req.json().catch(() => ({}))) as { title?: string };
    const title = body.title?.trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const topic = store.updateTopic(id, { title });
    bus.emit({ type: "topic_updated", topicId: id });
    return c.json(topic);
  });

  app.post("/api/topics/:id/switch", (c) => {
    const id = c.req.param("id");
    store.requireTopic(id);
    store.setCurrentTopic(id);
    const first = store.getOutline(id)[0];
    const currentSection = store.getCurrentSectionId();
    if (!currentSection && first) store.setCurrentSection(first.id);
    bus.emit({ type: "topic_updated", topicId: id });
    return c.json({
      currentTopicId: id,
      topic: store.getTopic(id),
      currentSectionId: store.getCurrentSectionId(),
    });
  });

  app.get("/api/topics/:id", (c) => {
    const id = c.req.param("id");
    const topic = store.requireTopic(id);
    const currentSectionId = store.getCurrentSectionId();
    const boundaries = store.listBoundaries(id);
    return c.json({
      topic,
      boundaries,
      boundary_snapshot: snapshotFromAnswers(boundaries),
      outline: store.getOutline(id),
      currentSection: currentSectionId ? store.getSection(currentSectionId) : null,
      notes: store.listNotes(id),
    });
  });

  app.post("/api/topics/:id/select-section", async (c) => {
    const id = c.req.param("id");
    store.requireTopic(id);
    const body = (await c.req.json()) as { sectionId?: string };
    if (!body.sectionId) return c.json({ error: "sectionId required" }, 400);
    store.setCurrentSection(body.sectionId);
    bus.emit({
      type: "section_status",
      topic_id: id,
      section_id: body.sectionId,
      status: store.getSection(body.sectionId) ? "ready" : "selected",
    });
    bus.emit({ type: "section_updated", topicId: id, sectionId: body.sectionId });
    return c.json({ currentSectionId: body.sectionId, section: store.getSection(body.sectionId) });
  });

  app.get("/api/session/messages", (c) => {
    const topicId = store.getCurrentTopicId();
    if (!topicId) return c.json([]);
    return c.json(host.messagesForClient(topicId));
  });

  app.post("/api/session/prompt", async (c) => {
    const topicId = store.getCurrentTopicId();
    if (!topicId) return c.json({ error: "没有当前主题" }, 400);
    const body = (await c.req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) return c.json({ error: "text required" }, 400);
    void host.prompt(topicId, text);
    return c.json({ ok: true, topicId });
  });

  app.post("/api/session/abort", (c) => {
    const topicId = store.getCurrentTopicId();
    if (topicId) host.abort(topicId);
    return c.json({ ok: true });
  });

  app.get("/api/session/events", (c) =>
    streamSSE(c, async (sse) => {
      const unsub = bus.subscribe((event) => {
        void sse.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      const abort = () => unsub();
      c.req.raw.signal.addEventListener("abort", abort);
      try {
        while (!c.req.raw.signal.aborted) {
          await sse.writeSSE({ event: "ping", data: "{}" });
          await sleep(15000);
        }
      } finally {
        unsub();
      }
    }),
  );

  app.get("/api/exports/:topicId/:filename", (c) => {
    const topicId = c.req.param("topicId");
    const filename = c.req.param("filename");
    if (filename.includes("..") || filename.includes("/")) {
      return c.json({ error: "bad filename" }, 400);
    }
    const abs = resolve(config.dataDir, "exports", topicId, filename);
    try {
      const buf = readFileSync(abs);
      return new Response(buf, {
        headers: {
          "content-type": contentType(filename),
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  // Convenience: export without waiting for the agent (still uses the same exporter).
  app.post("/api/topics/:id/export", async (c) => {
    const id = c.req.param("id");
    store.requireTopic(id);
    const body = (await c.req.json()) as { format?: ExportFormat };
    const format = body.format ?? "md";
    store.setCurrentTopic(id);
    void host.prompt(id, `请用工具 export_topic 导出为 ${format}。`);
    return c.json({ ok: true, format });
  });

  return { app, store, host };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function contentType(filename: string): string {
  if (filename.endsWith(".html")) return "text/html; charset=utf-8";
  if (filename.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (filename.endsWith(".epub")) return "application/epub+zip";
  return "application/octet-stream";
}
