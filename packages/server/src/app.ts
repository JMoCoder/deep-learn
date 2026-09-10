import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { AppSnapshot, ExportFormat, SettingsInput } from "@quantum/shared";
import {
  evaluateOutlineLeafBudget,
  learnGatesFromServer,
  shouldShowOutlineConfirm,
  snapshotFromAnswers,
} from "@quantum/shared";
import { AgentHost } from "./agent/runtime.js";
import { bus } from "./agent/bus.js";
import { config } from "./config.js";
import { exportTopic } from "./export/index.js";
import { isSafeExportSegment, resolveExportFile } from "./export/safe-path.js";
import { outlineFromBoundaries } from "./learning/outline-from-boundaries.js";
import { collectPrereqEdges } from "./learning/prereq-edges.js";
import { Store } from "./store/repos.js";
import { runTopicTool } from "./tools/run-tool.js";

export const LOCAL_PREVIEW_ORIGINS = [
  "http://127.0.0.1:43127",
  "http://localhost:43127",
] as const;

export type CreateAppOptions = {
  /** Override process env. Empty/omit with no env token = ungated (unit tests). */
  apiToken?: string;
};

export function createApp(
  store = new Store(),
  host = new AgentHost(store),
  options: CreateAppOptions = {},
) {
  const app = new Hono();
  const apiToken = (options.apiToken ?? config.apiToken).trim();

  app.use(
    "/api/*",
    cors({
      origin: [...LOCAL_PREVIEW_ORIGINS],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "X-Quantum-Token"],
      maxAge: 600,
    }),
  );

  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    if (c.req.path === "/api/health" && c.req.method === "GET") return next();
    if (!apiToken) return next();
    const presented = presentedToken(c.req.header("authorization"), c.req.header("x-quantum-token"));
    if (!tokenMatches(presented, apiToken)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  });

  app.get("/api/health", (c) =>
    c.json({ ok: true, name: "quantum", coachMode: store.hasLiveModel() ? "live" : "stub" }),
  );

  app.get("/api/state", (c) => c.json(appSnapshot(store)));

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
    const gates = topicGates(store, topic.id, topic.phase);
    return c.json({
      topic,
      boundaries,
      boundary_snapshot: snapshotFromAnswers(boundaries),
      boundary_confirmed: gates.boundaryConfirmed,
      boundary_finalized: gates.boundaryFinalized,
      outline: store.getOutline(id),
      currentSection: currentSectionId ? store.getSection(currentSectionId) : null,
      notes: store.listNotes(id),
    });
  });

  app.post("/api/topics/:id/confirm-boundary", (c) => {
    const id = c.req.param("id");
    let topic;
    try {
      topic = store.requireTopic(id);
    } catch {
      return c.json({ error: "not found" }, 404);
    }
    const stored = store.getTopicGates(id);
    if (
      !learnGatesFromServer({
        phase: topic.phase,
        boundaryConfirmed: stored.boundaryConfirmed,
        boundaryFinalized: stored.boundaryFinalized,
      }).boundaryFinalized
    ) {
      return c.json({ error: "boundary not finalized" }, 400);
    }
    store.setTopicGates(id, { boundaryConfirmed: true });
    return c.json({
      ok: true,
      topicId: id,
      ...topicGates(store, id, topic.phase),
      state: appSnapshot(store),
    });
  });

  app.post("/api/topics/:id/confirm-outline", async (c) => {
    const id = c.req.param("id");
    let topic;
    try {
      topic = store.requireTopic(id);
    } catch {
      return c.json({ error: "not found" }, 404);
    }
    const outline = store.getOutline(id);
    const gates = topicGates(store, id, topic.phase);
    if (
      !shouldShowOutlineConfirm({
        phase: topic.phase,
        boundaryConfirmed: gates.boundaryConfirmed,
        hasOutline: outline.length > 0,
      })
    ) {
      return c.json({ ok: false, error: "outline confirm not available" }, 400);
    }
    const snapshot = snapshotFromAnswers(store.listBoundaries(id));
    const budget = evaluateOutlineLeafBudget(outline, snapshot.chunk_budget);
    if (!budget.canConfirm) {
      return c.json({ ok: false, error: "over budget", ...budget }, 400);
    }
    store.setCurrentTopic(id);
    const result = await runTopicTool(store, id, "finalize_outline", { title: topic.title });
    const details = (result as { details?: { ok?: boolean; errors?: string[] } }).details;
    if (details?.ok === false) {
      return c.json({ ok: false, error: details.errors?.join("；") ?? "finalize_outline rejected" }, 400);
    }
    const next = store.requireTopic(id);
    return c.json({
      ok: true,
      topicId: id,
      phase: next.phase,
      state: appSnapshot(store),
    });
  });

  app.post("/api/topics/:id/reduce-outline", async (c) => {
    const id = c.req.param("id");
    let topic;
    try {
      topic = store.requireTopic(id);
    } catch {
      return c.json({ error: "not found" }, 404);
    }
    const gates = topicGates(store, id, topic.phase);
    if (
      !shouldShowOutlineConfirm({
        phase: topic.phase,
        boundaryConfirmed: gates.boundaryConfirmed,
        hasOutline: store.getOutline(id).length > 0,
      })
    ) {
      return c.json({ ok: false, error: "outline reduce not available" }, 400);
    }
    const drafted = outlineFromBoundaries(store.listBoundaries(id));
    store.setCurrentTopic(id);
    const result = await runTopicTool(store, id, "draft_outline", drafted);
    const details = (result as { details?: { ok?: boolean; errors?: string[]; leafCount?: number; leafCap?: number } }).details;
    if (details?.ok === false) {
      return c.json({ ok: false, error: details.errors?.join("；") ?? "draft_outline rejected", ...details }, 400);
    }
    return c.json({
      ok: true,
      topicId: id,
      leafCount: details?.leafCount,
      leafCap: details?.leafCap,
      state: appSnapshot(store),
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
    if (!isSafeExportSegment(topicId) || !isSafeExportSegment(filename)) {
      return c.json({ error: "bad path" }, 400);
    }
    try {
      store.requireTopic(topicId);
    } catch {
      return c.json({ error: "not found" }, 404);
    }
    const abs = resolveExportFile(topicId, filename);
    if (!abs) {
      return c.json({ error: "bad path" }, 400);
    }
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

  // Same exporter as export_topic. ok:true only after a real, non-empty file exists.
  app.post("/api/topics/:id/export", async (c) => {
    const id = c.req.param("id");
    try {
      store.requireTopic(id);
    } catch {
      return c.json({ ok: false, error: "not found" }, 404);
    }
    const body = (await c.req.json().catch(() => ({}))) as { format?: ExportFormat };
    const format = body.format ?? "md";
    if (format !== "md" && format !== "html" && format !== "epub") {
      return c.json({ ok: false, format, error: "unsupported format" });
    }
    store.setCurrentTopic(id);
    try {
      store.updateTopic(id, { exportState: "exporting" });
      const result = await exportTopic(store, id, format);
      const abs = resolveExportFile(id, result.filename);
      if (!abs) {
        store.updateTopic(id, { exportState: "idle" });
        return c.json({ ok: false, format, error: "export path escaped exports root" });
      }
      store.updateTopic(id, { exportState: "ready" });
      bus.emit({
        type: "export_ready",
        topicId: id,
        format: result.format,
        filename: result.filename,
        downloadPath: result.downloadPath,
      });
      bus.emit({
        type: "phase_changed",
        topicId: id,
        phase: store.requireTopic(id).phase,
        exportState: "ready",
      });
      return c.json({ ok: true, ...result });
    } catch (err) {
      store.updateTopic(id, { exportState: "idle" });
      return c.json({
        ok: false,
        format,
        error: err instanceof Error ? err.message : "export failed",
      });
    }
  });

  return { app, store, host };
}

function appSnapshot(store: Store): AppSnapshot {
  const currentTopicId = store.getCurrentTopicId();
  const topic = currentTopicId ? store.getTopic(currentTopicId) : null;
  const gates = topic
    ? topicGates(store, topic.id, topic.phase)
    : { boundaryConfirmed: false, boundaryFinalized: false };
  return {
    currentTopicId,
    topic,
    currentSectionId: store.getCurrentSectionId(),
    coachMode: store.hasLiveModel() ? "live" : "stub",
    settings: store.publicSettings(),
    ...gates,
  };
}

function topicGates(store: Store, topicId: string, phase: string) {
  const stored = store.getTopicGates(topicId);
  return learnGatesFromServer({
    phase,
    boundaryConfirmed: stored.boundaryConfirmed,
    boundaryFinalized: stored.boundaryFinalized,
  });
}

function presentedToken(authorization: string | undefined, xToken: string | undefined): string {
  const header = authorization ?? "";
  if (/^bearer\s+/i.test(header)) return header.replace(/^bearer\s+/i, "").trim();
  return (xToken ?? "").trim();
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
