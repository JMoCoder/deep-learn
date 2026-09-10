import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
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

async function mountApp() {
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
    if (url === "/api/topics") return json([]);
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
    await new Promise((r) => setTimeout(r, 20));
  });
  return root;
}

describe("Learn rails open independently", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("collapsing the session rail does not close the outline rail", async () => {
    const root = await mountApp();
    const outline = () => document.querySelector("[data-testid=outline-rail]");
    const session = () => document.querySelector("[data-testid=session-rail]");
    const sessionToggle = document.querySelector<HTMLButtonElement>("[data-testid=learn-session-toggle]");
    const outlineToggle = document.querySelector<HTMLButtonElement>("[data-testid=learn-outline-toggle]");
    assert.ok(sessionToggle);
    assert.ok(outlineToggle);
    assert.equal(outline()?.getAttribute("data-state"), "open");
    assert.equal(session()?.getAttribute("data-state"), "open");

    await act(async () => {
      sessionToggle.click();
    });
    assert.equal(session()?.getAttribute("data-state"), "closed");
    assert.equal(outline()?.getAttribute("data-state"), "open");

    await act(async () => {
      outlineToggle.click();
    });
    assert.equal(outline()?.getAttribute("data-state"), "closed");
    assert.equal(session()?.getAttribute("data-state"), "closed");

    await act(async () => {
      sessionToggle.click();
    });
    assert.equal(session()?.getAttribute("data-state"), "open");
    assert.equal(outline()?.getAttribute("data-state"), "closed");
    root.unmount();
  });
});
