import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { NoteRecord, TopicSummary } from "@quantum/shared";
import { LocaleProvider } from "@/i18n";
import { NotesTab } from "./NotesTab.tsx";

const topic: TopicSummary = {
  id: "top_1",
  title: "测量入门",
  phase: "learning",
  exportState: "idle",
  archived: false,
  createdAt: 1,
  updatedAt: 2,
};

const notes: NoteRecord[] = [
  {
    id: "n1",
    topicId: "top_1",
    sectionId: "s1",
    body: "误差不是错误",
    reasonCode: 1,
    type: "思考",
    createdAt: 10,
  },
];

describe("NotesTab", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows notes without a top status hero or book switch", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(LocaleProvider, null, createElement(NotesTab, { topic, notes })),
      );
    });
    assert.equal(document.querySelector('[data-testid="notes-hero"]'), null);
    assert.ok(document.querySelector('[data-testid="notes-pane"]'));
    assert.ok(document.querySelector('[data-testid="notes-item"]'));
    assert.equal(document.querySelector('[data-testid="shelf-list"]'), null);
    root.unmount();
  });

  it("empty state when there is no current book", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(LocaleProvider, null, createElement(NotesTab, { topic: null, notes: [] })),
      );
    });
    assert.match(document.body.textContent ?? "", /还没有当前书籍|No current book/);
    root.unmount();
  });
});
