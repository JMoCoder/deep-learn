import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { snapshotFromAnswers } from "@quantum/shared";
import App from "../App.tsx";
import { LocaleProvider } from "@/i18n";
import { writeBoundaryConfirmed, writeCachedTopicId } from "@/lib/boundary-session";

const settings = {
  provider: "openai",
  modelId: "gpt-4o-mini",
  baseUrl: "",
  hasApiKey: false,
};

const topic = {
  id: "top_state",
  title: "测量入门",
  phase: "outline_draft" as const,
  exportState: "idle" as const,
  createdAt: 1,
  updatedAt: 1,
};

const packed = snapshotFromAnswers([
  { kind: "goal", answer: "我能独立推一遍" },
  { kind: "prior", answer: "只会定义" },
  { kind: "constraint", answer: "没有" },
  { kind: "depth", answer: "认路" },
  { kind: "time", answer: "每次 20 分钟" },
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("confirm/pointer follow GET /api/state", () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows the boundary card when cache says confirmed but /api/state does not", async () => {
    writeCachedTopicId(topic.id);
    writeBoundaryConfirmed(topic.id, true);

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/state") {
        return json({
          currentTopicId: topic.id,
          topic,
          currentSectionId: null,
          coachMode: "stub",
          settings,
          boundaryConfirmed: false,
          boundaryFinalized: true,
        });
      }
      if (url === "/api/topics") return json([topic]);
      if (url === `/api/topics/${topic.id}`) {
        return json({
          topic,
          boundaries: [],
          boundary_snapshot: packed,
          boundary_confirmed: false,
          boundary_finalized: true,
          outline: [],
          currentSection: null,
          notes: [],
        });
      }
      if (url === "/api/topics/current/projection") {
        return json({
          topic_title: topic.title,
          section_title: "",
          section_id: null,
          outline: [],
          prereq_edges: [],
          phase: topic.phase,
        });
      }
      if (url === "/api/session/messages") return json([]);
      return json({ error: url }, 404);
    }) as typeof fetch;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(LocaleProvider, null, createElement(App)));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    assert.ok(document.querySelector(".boundary-card"), "state.confirmed=false must show the card");
    assert.equal(/OUTLINE/.test(document.body.textContent ?? ""), false);
    root.unmount();
  });

  it("does not open a cached topic when /api/state.currentTopicId is null", async () => {
    writeCachedTopicId(topic.id);

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/state") {
        return json({
          currentTopicId: null,
          topic: null,
          currentSectionId: null,
          coachMode: "stub",
          settings,
          boundaryConfirmed: false,
          boundaryFinalized: false,
        });
      }
      if (url === "/api/topics") return json([topic]);
      if (url === "/api/session/messages") return json([]);
      if (url === "/api/topics/current/projection") {
        return json({
          topic_title: "",
          section_title: "",
          section_id: null,
          outline: [],
          prereq_edges: [],
          phase: "",
        });
      }
      return json({ error: url }, 404);
    }) as typeof fetch;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(LocaleProvider, null, createElement(App)));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    assert.match(document.body.textContent ?? "", /还没有当前主题|No current topic/);
    assert.equal(document.querySelector(".boundary-card"), null);
    assert.equal(localStorage.getItem("quantum.current-topic-id"), null);
    root.unmount();
  });

  it("POSTs confirm-boundary and then follows the new /api/state gates", async () => {
    let confirmed = false;
    const posts: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") posts.push(`${method} ${url}`);
      if (url === "/api/state") {
        return json({
          currentTopicId: topic.id,
          topic,
          currentSectionId: null,
          coachMode: "stub",
          settings,
          boundaryConfirmed: confirmed,
          boundaryFinalized: true,
        });
      }
      if (url === "/api/topics") return json([topic]);
      if (url === `/api/topics/${topic.id}/confirm-boundary` && method === "POST") {
        confirmed = true;
        return json({
          ok: true,
          topicId: topic.id,
          boundaryConfirmed: true,
          boundaryFinalized: true,
        });
      }
      if (url === `/api/topics/${topic.id}`) {
        return json({
          topic,
          boundaries: [],
          boundary_snapshot: packed,
          boundary_confirmed: confirmed,
          boundary_finalized: true,
          outline: [
            {
              id: "n1",
              topicId: topic.id,
              parentId: null,
              title: "定向",
              intent: "地图",
              objective: "能指出地图",
              dependsOn: [],
              targetChars: 400,
              sortOrder: 0,
              status: "draft",
              children: [],
            },
          ],
          currentSection: null,
          notes: [],
        });
      }
      if (url === "/api/topics/current/projection") {
        return json({
          topic_title: topic.title,
          section_title: "",
          section_id: null,
          outline: [],
          prereq_edges: [],
          phase: topic.phase,
        });
      }
      if (url === "/api/session/messages") return json([]);
      return json({ error: url }, 404);
    }) as typeof fetch;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(LocaleProvider, null, createElement(App)));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    const card = document.querySelector(".boundary-card");
    assert.ok(card);
    const confirm = [...card.querySelectorAll("button")].find((btn) =>
      /确认边界|Confirm boundary/i.test(btn.textContent ?? ""),
    );
    assert.ok(confirm, "confirm button");
    await act(async () => {
      confirm.click();
      await new Promise((r) => setTimeout(r, 30));
    });

    assert.ok(posts.includes(`POST /api/topics/${topic.id}/confirm-boundary`));
    assert.match(document.body.textContent ?? "", /OUTLINE/);
    assert.equal(document.querySelector(".boundary-card"), null);
    root.unmount();
  });
});
