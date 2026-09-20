import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { LocaleProvider } from "@/i18n";
import { MeTab } from "./MeTab.tsx";

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mountMe(archived: Array<{ id: string; title: string }> = []): Root {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/topics?archived=1") || url.includes("archived=1")) {
      return json(
        archived.map((a) => ({
          ...a,
          phase: "learning",
          exportState: "idle",
          archived: true,
          createdAt: 1,
          updatedAt: 2,
        })),
      );
    }
    return json({ error: url }, 404);
  }) as typeof fetch;

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(
        LocaleProvider,
        null,
        createElement(MeTab, {
          settings: { provider: "openai", modelId: "gpt-4o-mini", baseUrl: "", hasApiKey: false },
          onSave: async () => {},
          onUnarchive: async () => {},
          onDeleteArchived: async () => {},
        }),
      ),
    );
  });
  return root;
}

const heatmapCopy = /学习热力图|Learning heatmap|占位热力图|placeholder heatmap|me-heatmap/i;

describe("Me page settings + columns", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps language and model settings, and does not render a heatmap or top status bar", async () => {
    const root = mountMe();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    assert.equal(document.querySelector("[data-testid=me-top-region]"), null);
    assert.ok(document.querySelector("[data-testid=me-body]"));
    assert.ok(document.querySelector("[data-testid=me-columns]"));
    assert.equal(document.querySelector("[data-testid=me-heatmap]"), null);
    assert.equal(heatmapCopy.test(document.body.textContent ?? ""), false);
    assert.ok(document.querySelector('[data-testid="locale-zh"]'));
    root.unmount();
  });

  it("lists archived books for unarchive and delete", async () => {
    const root = mountMe([{ id: "top_a", title: "归档书" }]);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(document.querySelector('[data-testid="me-archived-card"]'));
    assert.ok(document.querySelector('[data-testid="me-unarchive"]'));
    assert.ok(document.querySelector('[data-testid="me-delete"]'));
    assert.match(document.body.textContent ?? "", /归档书/);
    root.unmount();
  });

  it("stretches the page body across the main region", () => {
    const root = mountMe();
    const body = document.querySelector("[data-testid=me-body]");
    assert.ok(body);
    assert.match(body.className, /\bw-full\b/);
    assert.equal(/\bmax-w-lg\b/.test(body.className), false);
    root.unmount();
  });
});
