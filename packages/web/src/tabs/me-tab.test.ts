import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { LocaleProvider } from "@/i18n";
import { MeTab } from "./MeTab.tsx";

const heatmap = [
  { date: "2026-09-01", count: 0 },
  { date: "2026-09-02", count: 3 },
];

function mountMe(): Root {
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
          heatmap,
          onSave: async () => {},
        }),
      ),
    );
  });
  return root;
}

describe("Me page width + heatmap top region", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("ranks the heatmap before language and model settings, not in the top bar, and does not fill the main area", () => {
    const root = mountMe();
    const top = document.querySelector("[data-testid=me-top-region]");
    const heat = document.querySelector("[data-testid=me-heatmap]");
    const body = document.querySelector("[data-testid=me-body]");
    const appTopBar = document.querySelector("[data-testid=learn-top-region]");
    assert.ok(top);
    assert.ok(heat);
    assert.ok(body);
    assert.equal(top.contains(heat), false);
    assert.equal(body.contains(heat), true);
    assert.equal(appTopBar, null);

    const headings = [...document.querySelectorAll("h1, h2")].map((el) => el.textContent ?? "");
    const heatAt = headings.findIndex((h) => /学习热力图|Learning heatmap/.test(h));
    const langAt = headings.findIndex((h) => /界面语言|Interface language/.test(h));
    const modelAt = headings.findIndex((h) => /模型代理|Model proxy/.test(h));
    assert.ok(heatAt >= 0 && langAt >= 0 && modelAt >= 0);
    assert.ok(heatAt < langAt);
    assert.ok(langAt < modelAt);

    assert.equal(/\bflex-1\b/.test(heat.className), false);
    assert.equal(/\bgrow\b/.test(heat.className), false);
    assert.equal(/\bh-full\b/.test(heat.className), false);
    const grid = heat.querySelector("[data-testid=me-heatmap-grid]");
    assert.ok(grid);
    assert.match(grid.className, /\bw-max\b/);
    assert.equal(/\bw-full\b/.test(grid.className), false);
    assert.match(grid.getAttribute("style") ?? "", /repeat\(7/);
    assert.match(grid.getAttribute("style") ?? "", /grid-auto-flow:\s*column/);
    const cell = heat.querySelector("[title]");
    assert.ok(cell);
    assert.equal(/\bw-full\b/.test(cell.className), false);
    assert.equal(/\baspect-square\b/.test(cell.className), false);
    assert.equal((heat.textContent ?? "").includes("docs/cores.md"), false);
    root.unmount();
  });

  it("stretches the page body across the main region instead of a narrow centered column", () => {
    const root = mountMe();
    const body = document.querySelector("[data-testid=me-body]");
    assert.ok(body);
    assert.match(body.className, /\bw-full\b/);
    assert.equal(/\bmax-w-lg\b/.test(body.className), false);
    assert.equal(/\bmx-auto\b/.test(body.className), false);
    root.unmount();
  });
});
