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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function mountApp(requested: string[] = []) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url === "/api/state") {
      return json({
        currentTopicId: null,
        topic: null,
        currentSectionId: null,
        coachMode: "stub",
        settings,
      });
    }
    if (url === "/api/topics") return json([]);
    if (url === "/api/session/messages") return json([]);
    if (url === "/api/topics/current/projection") {
      return json({
        topic_title: "",
        section_title: "",
        section_id: null,
        outline: [],
        prereq_edges: [],
        phase: "idle",
        boundary_snapshot: emptyBoundarySnapshot(),
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
    await new Promise((r) => setTimeout(r, 20));
  });
  return root;
}

describe("app frame + default outline rail", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("stretches the main frame to the screen without max-w gutters", async () => {
    const root = await mountApp();
    const frame = document.querySelector("[data-app-frame]");
    assert.ok(frame);
    assert.match(frame.className, /\bw-full\b/);
    assert.equal(/\bmax-w-lg\b/.test(frame.className), false);
    assert.equal(/\bmax-w-3xl\b/.test(frame.className), false);
    assert.equal(/\bmax-w-4xl\b/.test(frame.className), false);
    assert.equal(/\bmx-auto\b/.test(frame.className), false);
    root.unmount();
  });

  it("opens the outline rail by default on a wide viewport", async () => {
    const root = await mountApp();
    const rail = document.querySelector("[data-testid=outline-rail]");
    assert.ok(rail);
    assert.equal(rail.getAttribute("data-state"), "open");
    assert.match(rail.textContent ?? "", /还没有大纲|No outline yet/);
    root.unmount();
  });

  it("does not fetch /api/heatmap while loading or opening Me", async () => {
    const requested: string[] = [];
    const root = await mountApp(requested);
    const me = document.querySelector<HTMLButtonElement>('[data-testid="tab-me"]');
    assert.ok(me);
    await act(async () => {
      me.click();
    });
    assert.equal(
      requested.some((url) => url === "/api/heatmap" || url.includes("/api/heatmap")),
      false,
    );
    assert.equal(document.querySelector("[data-testid=me-heatmap]"), null);
    const pageText = document.body.textContent ?? "";
    assert.equal(/学习热力图|Learning heatmap|占位热力图|placeholder heatmap/i.test(pageText), false);
    root.unmount();
  });
});
