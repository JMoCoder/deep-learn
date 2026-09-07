import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import App from "../App.tsx";

const settings = {
  provider: "openai",
  modelId: "gpt-4o-mini",
  baseUrl: "",
  hasApiKey: false,
};

const created = {
  id: "top_new",
  title: "未命名主题",
  phase: "boundary_interview" as const,
  exportState: "idle" as const,
  createdAt: 1,
  updatedAt: 1,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("1.1 create topic posts /api/topics", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("书籍抽屉「新建主题」issues POST /api/topics", async () => {
    let current = {
      currentTopicId: null as string | null,
      topic: null as typeof created | null,
      currentSectionId: null as string | null,
      coachMode: "stub" as const,
      settings,
    };
    const topics: typeof created[] = [];
    const posts: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") posts.push(`${method} ${url}`);
      if (url === "/api/state") return json(current);
      if (url === "/api/topics" && method === "GET") return json(topics);
      if (url === "/api/topics" && method === "POST") {
        topics.push(created);
        current = {
          ...current,
          currentTopicId: created.id,
          topic: created,
        };
        return json(created, 201);
      }
      if (url === `/api/topics/${created.id}`) {
        return json({
          topic: created,
          boundaries: [],
          boundary_snapshot: emptyBoundarySnapshot(),
          outline: [],
          currentSection: null,
          notes: [],
        });
      }
      if (url === "/api/topics/current/projection") {
        return json({
          topic_title: created.title,
          section_title: "",
          section_id: null,
          outline: [],
          prereq_edges: [],
          phase: created.phase,
        });
      }
      if (url === "/api/heatmap") return json([]);
      if (url === "/api/session/messages") return json([]);
      return json({ error: url }, 404);
    }) as typeof fetch;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(App));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const books = document.querySelector<HTMLButtonElement>('[data-testid="tab-books"]');
    assert.ok(books, "bottom nav Books");
    await act(async () => {
      books.click();
    });

    const openDrawer = document.querySelector<HTMLButtonElement>('[data-testid="open-topic-drawer"]');
    assert.ok(openDrawer);
    await act(async () => {
      openDrawer.click();
    });

    const create = document.querySelector<HTMLButtonElement>('[data-testid="create-topic"]');
    assert.ok(create, "drawer 首卡 新建主题");
    await act(async () => {
      create.click();
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.ok(
      posts.includes("POST /api/topics"),
      `expected POST /api/topics, got ${JSON.stringify(posts)}`,
    );
    assert.match(document.body.textContent ?? "", /未命名主题|边界|访谈|学习会话|Learning session|Boundary/);
    root.unmount();
  });
});
