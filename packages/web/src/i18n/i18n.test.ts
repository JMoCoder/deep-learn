import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { MeTab } from "../tabs/MeTab.tsx";
import { LocaleProvider } from "./context.tsx";
import { STORAGE_KEY, detectBrowserLocale, writeStoredLocale } from "./locale.ts";
import { en, zh, type MessageKey } from "./messages.ts";
import { translate } from "./translate.ts";

describe("i18n dictionaries", () => {
  it("keeps zh and en keys in sync", () => {
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    assert.deepEqual(enKeys, zhKeys);
  });

  it("interpolates placeholders", () => {
    assert.equal(
      translate("en", "boundary.coverage", { asked: 3, total: 8 }),
      "Covered 3/8 dimensions",
    );
    assert.match(translate("zh", "boundary.coverage", { asked: 3, total: 8 }), /3\/8/);
  });

  it("falls back to zh for unknown holes", () => {
    const key = "tab.learn" satisfies MessageKey;
    assert.equal(translate("zh", key), "学习");
    assert.equal(translate("en", key), "Learn");
  });
});

describe("browser locale default", () => {
  it("maps en* to en, zh* to zh, else zh-CN fallback", () => {
    assert.equal(detectBrowserLocale(["en-US"]), "en");
    assert.equal(detectBrowserLocale(["en"]), "en");
    assert.equal(detectBrowserLocale(["zh-CN"]), "zh");
    assert.equal(detectBrowserLocale(["zh-TW"]), "zh");
    assert.equal(detectBrowserLocale(["fr-FR"]), "zh");
    assert.equal(detectBrowserLocale([]), "zh");
  });
});

describe("settings language switch", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.removeItem(STORAGE_KEY);
  });

  it("persists en and retitles Me chrome", async () => {
    writeStoredLocale("zh");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(
        createElement(
          LocaleProvider,
          null,
          createElement(MeTab, {
            settings: { provider: "openai", modelId: "gpt-4o-mini", baseUrl: "", hasApiKey: false },
            heatmap: [],
            onSave: async () => {},
          }),
        ),
      );
    });

    assert.match(host.textContent ?? "", /我的/);
    const enBtn = host.querySelector<HTMLButtonElement>('[data-testid="locale-en"]');
    assert.ok(enBtn);
    await act(async () => {
      enBtn.click();
    });
    assert.equal(localStorage.getItem(STORAGE_KEY), "en");
    assert.match(host.textContent ?? "", /Interface language/);
    assert.match(host.textContent ?? "", /Agent replies follow/);
    assert.equal((host.textContent ?? "").includes("我的"), false);
    root.unmount();
  });
});
