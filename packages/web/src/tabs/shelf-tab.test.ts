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
  archived: false,
  createdAt: 1,
  updatedAt: 2,
};

async function mount(
  props: Partial<{
    topics: TopicSummary[];
    topic: TopicSummary | null;
    onArchive: (id: string) => void;
    onSwitch: (id: string) => void;
  }> = {},
) {
  const imports: Array<{ html: string; title?: string }> = [];
  const switches: string[] = [];
  const archives: string[] = [];
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
          onImportHtml: async (html, title) => {
            imports.push({ html, title });
          },
          onSwitch: (id) => {
            switches.push(id);
            props.onSwitch?.(id);
          },
          onExport: () => {},
          onArchive: async (id) => {
            archives.push(id);
            props.onArchive?.(id);
          },
        }),
      ),
    );
  });
  return { root, imports, switches, archives };
}

describe("ShelfTab", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses a responsive card grid without a top status hero", async () => {
    const { root } = await mount();
    assert.equal(document.querySelector('[data-testid="shelf-hero"]'), null);
    assert.ok(document.querySelector('[data-testid="shelf-grid"]'));
    assert.ok(document.querySelector('[data-testid="shelf-import-open"]'));
    assert.ok(document.querySelector('[data-testid="shelf-book-card"]'));
    assert.ok(document.querySelector('[data-testid="shelf-archive"]'));
    assert.match(
      document.querySelector('[data-testid="shelf-grid"]')?.className ?? "",
      /auto-fit/,
    );
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
    root.unmount();
  });

  it("opens archive confirm from the icon and switches from the text button", async () => {
    const { root, switches, archives } = await mount();
    const switchBtn = document.querySelector<HTMLButtonElement>('[data-testid="shelf-switch"]');
    const archiveBtn = document.querySelector<HTMLButtonElement>('[data-testid="shelf-archive"]');
    assert.ok(switchBtn);
    assert.ok(archiveBtn);
    await act(async () => {
      switchBtn.click();
    });
    assert.deepEqual(switches, ["top_1"]);
    await act(async () => {
      archiveBtn.click();
    });
    const confirm = document.querySelector<HTMLButtonElement>('[data-testid="shelf-archive-confirm"]');
    assert.ok(confirm);
    await act(async () => {
      confirm.click();
      await new Promise((r) => setTimeout(r, 10));
    });
    assert.deepEqual(archives, ["top_1"]);
    root.unmount();
  });

  it("opens outline preview sidebar when the card body is clicked", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/topics/top_1")) {
        return new Response(
          JSON.stringify({
            topic,
            boundaries: [],
            boundary_snapshot: {},
            boundary_confirmed: true,
            boundary_finalized: true,
            outline: [
              {
                id: "out_1",
                topicId: "top_1",
                parentId: null,
                title: "定向",
                intent: "",
                objective: "",
                dependsOn: [],
                targetChars: 1,
                sortOrder: 0,
                status: "ready",
                children: [],
              },
            ],
            currentSection: null,
            notes: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    const { root, switches } = await mount();
    const card = document.querySelector<HTMLElement>('[data-testid="shelf-book-card"]');
    assert.ok(card);
    await act(async () => {
      card.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    assert.ok(document.querySelector('[data-testid="shelf-outline-drawer"]'));
    const previewSwitch = document.querySelector<HTMLButtonElement>('[data-testid="shelf-preview-switch"]');
    assert.ok(previewSwitch);
    await act(async () => {
      previewSwitch.click();
    });
    assert.deepEqual(switches, ["top_1"]);
    root.unmount();
  });
});
