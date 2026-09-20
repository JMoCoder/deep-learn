import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { TopicSummary } from "@quantum/shared";
import { LocaleProvider } from "@/i18n";
import { ShelfTab } from "./ShelfTab.tsx";

const topic: TopicSummary = {
  id: "top_1",
  title: "测量入门",
  phase: "learning",
  exportState: "idle",
  createdAt: 1,
  updatedAt: 2,
};

async function mount(
  props: Partial<Parameters<typeof ShelfTab>[0]> & {
    onImportHtml?: (html: string, title?: string) => void | Promise<void>;
  } = {},
) {
  const imports: Array<{ html: string; title?: string }> = [];
  const switches: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        LocaleProvider,
        null,
        createElement(ShelfTab, {
          topic: props.topic === undefined ? topic : props.topic,
          topics: props.topics ?? [topic],
          drawerOpen: props.drawerOpen ?? false,
          onDrawerOpen: props.onDrawerOpen ?? (() => {}),
          onImportHtml: async (html, title) => {
            imports.push({ html, title });
            await props.onImportHtml?.(html, title);
          },
          onSwitch: (id) => {
            switches.push(id);
            props.onSwitch?.(id);
          },
          onExport: props.onExport ?? (() => {}),
          importing: props.importing,
        }),
      ),
    );
  });
  return { root, imports, switches };
}

describe("ShelfTab", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("manages books without a reading body or notes dump", async () => {
    const { root } = await mount();
    assert.ok(document.querySelector('[data-testid="shelf-hero"]'));
    assert.ok(document.querySelector('[data-testid="shelf-list"]'));
    assert.equal(document.querySelector('[data-testid="books-pane-body"]'), null);
    assert.equal(document.querySelector('[data-testid="books-pane-notes"]'), null);
    assert.equal(document.querySelector('[data-testid="notes-pane"]'), null);
    assert.match(document.body.textContent ?? "", /测量入门/);
    assert.match(document.body.textContent ?? "", /导入 HTML|Import HTML/);
    root.unmount();
  });

  it("imports pasted HTML via the dialog", async () => {
    const { root, imports } = await mount();
    const open = document.querySelector<HTMLButtonElement>('[data-testid="shelf-import-open"]');
    assert.ok(open);
    await act(async () => {
      open.click();
    });
    const box = document.querySelector<HTMLTextAreaElement>('[data-testid="shelf-import-html"]');
    const submit = document.querySelector<HTMLButtonElement>('[data-testid="shelf-import-submit"]');
    assert.ok(box);
    assert.ok(submit);

    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    assert.ok(setter);
    await act(async () => {
      setter.call(box, "<html><body><h2>一</h2><p>甲</p></body></html>");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      submit.click();
      await new Promise((r) => setTimeout(r, 20));
    });
    assert.equal(imports.length, 1);
    assert.match(imports[0]!.html, /<h2>一<\/h2>/);
    root.unmount();
  });

  it("switches the current book from the list", async () => {
    const other: TopicSummary = { ...topic, id: "top_2", title: "另一本" };
    const { root, switches } = await mount({ topics: [topic, other] });
    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-testid="shelf-switch"]');
    assert.equal(buttons.length, 2);
    await act(async () => {
      buttons[1]!.click();
    });
    assert.deepEqual(switches, ["top_2"]);
    root.unmount();
  });
});
