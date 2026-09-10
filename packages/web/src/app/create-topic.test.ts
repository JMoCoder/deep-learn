import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import App from "../App.tsx";
import { LocaleProvider } from "@/i18n";

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
    created.title = "未命名主题";
    sessionStorage.removeItem("quantum.topic-anchor.top_new");
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
    const patches: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") posts.push(`${method} ${url}`);
      if (method === "PATCH") patches.push(`${method} ${url}`);
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
      if (url === `/api/topics/${created.id}` && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { title?: string };
        created.title = body.title?.trim() || created.title;
        current = { ...current, topic: created };
        const idx = topics.findIndex((item) => item.id === created.id);
        if (idx >= 0) topics[idx] = created;
        return json(created);
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
      if (url === "/api/session/messages") return json([]);
      if (url === "/api/session/prompt" && method === "POST") return json({ ok: true });
      return json({ error: url }, 404);
    }) as typeof fetch;

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(LocaleProvider, null, createElement(App)));
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
    assert.ok(document.querySelector('[data-testid="topic-anchor-prompt"]'));
    assert.match(document.body.textContent ?? "", /想学哪个主题|What do you want to learn/);
    assert.equal(document.querySelector("[data-dim]"), null);

    const box = document.querySelector<HTMLTextAreaElement>("textarea[name='text']");
    assert.ok(box, "session composer");
    box.value = "我想学测量入门";
    const form = box.closest("form");
    assert.ok(form);
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.ok(
      patches.includes(`PATCH /api/topics/${created.id}`),
      `expected PATCH title, got ${JSON.stringify(patches)}`,
    );
    assert.ok(
      posts.includes("POST /api/session/prompt"),
      `expected first reply to reach the stub, got ${JSON.stringify(posts)}`,
    );
    assert.match(document.body.textContent ?? "", /测量入门/);
    root.unmount();
  });
});
