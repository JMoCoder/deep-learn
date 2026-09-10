import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { LocaleProvider } from "@/i18n";
import { MeTab } from "./MeTab.tsx";

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
          onSave: async () => {},
        }),
      ),
    );
  });
  return root;
}

const heatmapCopy = /学习热力图|Learning heatmap|占位热力图|placeholder heatmap|me-heatmap/i;

describe("Me page settings only", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps description, language, and model settings, and does not render a heatmap", () => {
    const root = mountMe();
    const top = document.querySelector("[data-testid=me-top-region]");
    const body = document.querySelector("[data-testid=me-body]");
    const heat = document.querySelector("[data-testid=me-heatmap]");
    const grid = document.querySelector("[data-testid=me-heatmap-grid]");
    const appTopBar = document.querySelector("[data-testid=learn-top-region]");
    assert.ok(top);
    assert.ok(body);
    assert.equal(heat, null);
    assert.equal(grid, null);
    assert.equal(appTopBar, null);

    const headings = [...document.querySelectorAll("h1, h2")].map((el) => el.textContent ?? "");
    const titleAt = headings.findIndex((h) => /我的|Me/.test(h));
    const langAt = headings.findIndex((h) => /界面语言|Interface language/.test(h));
    const modelAt = headings.findIndex((h) => /模型代理|Model proxy/.test(h));
    assert.ok(titleAt >= 0 && langAt >= 0 && modelAt >= 0);
    assert.ok(titleAt < langAt);
    assert.ok(langAt < modelAt);
    assert.equal(
      headings.some((h) => /学习热力图|Learning heatmap/.test(h)),
      false,
    );

    const pageText = document.body.textContent ?? "";
    assert.match(pageText, /模型代理与界面语言|Model proxy and interface language/);
    assert.equal(heatmapCopy.test(pageText), false);
    assert.ok(document.querySelector('[data-testid="locale-zh"]'));
    assert.ok(document.querySelector('[data-testid="locale-en"]'));
    assert.ok(document.querySelector('form input[name="provider"]'));
    assert.ok(document.querySelector('form input[name="modelId"]'));
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
