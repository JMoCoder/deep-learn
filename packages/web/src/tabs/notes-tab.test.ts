import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { NoteRecord, OutlineNode, SectionRecord, TopicSummary } from "@quantum/shared";
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

const section: SectionRecord = {
  id: "s1",
  topicId: "top_1",
  outlineNodeId: "s1",
  title: "定向",
  bodyMd: "先搞清要量什么。",
  generatedAt: 1,
};

const outline: OutlineNode[] = [
  {
    id: "s1",
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
  {
    id: "s2",
    topicId: "top_1",
    parentId: null,
    title: "读数",
    intent: "",
    objective: "",
    dependsOn: ["s1"],
    targetChars: 1,
    sortOrder: 1,
    status: "ready",
    children: [],
  },
];

const notes: NoteRecord[] = [
  {
    id: "n1",
    topicId: "top_1",
    sectionId: "s1",
    body: "误差不是错误",
    reasonCode: 1,
    type: "思考",
    kind: "formal",
    createdAt: 10,
  },
  {
    id: "n2",
    topicId: "top_1",
    sectionId: "s2",
    body: "另一节的笔记",
    reasonCode: 1,
    type: "思考",
    kind: "formal",
    createdAt: 11,
  },
];

async function mount(opts: {
  notesOpen?: boolean;
  outlineOpen?: boolean;
  persistent?: boolean;
  notes?: NoteRecord[];
  topic?: TopicSummary | null;
} = {}) {
  const selected: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        LocaleProvider,
        null,
        createElement(NotesTab, {
          topic: opts.topic === undefined ? topic : opts.topic,
          section: opts.topic === null ? null : section,
          outline: opts.topic === null ? [] : outline,
          prereqEdges: [],
          currentSectionId: opts.topic === null ? null : "s1",
          notes: opts.notes ?? notes,
          outlineOpen: opts.outlineOpen ?? true,
          outlinePersistent: opts.persistent ?? true,
          notesOpen: opts.notesOpen ?? true,
          notesPersistent: opts.persistent ?? true,
          onOutlineOpen: () => {},
          onNotesOpen: () => {},
          onSelectSection: (id) => selected.push(id),
        }),
      ),
    );
  });
  return { root, selected };
}

describe("NotesTab", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("mirrors Learn three-pane chrome without book switch", async () => {
    const { root } = await mount();
    assert.equal(document.querySelector('[data-testid="notes-hero"]'), null);
    assert.ok(document.querySelector('[data-testid="notes-outline-rail"]'));
    assert.ok(document.querySelector('[data-testid="notes-list-rail"]'));
    assert.ok(document.querySelector('[data-testid="notes-article"]'));
    assert.ok(document.querySelector('[data-testid="notes-pane"]'));
    assert.ok(document.querySelector('[data-testid="notes-scope-toggle"]'));
    assert.ok(document.querySelector('[data-testid="notes-kind-filter"]'));
    assert.equal(document.querySelector('[data-testid="shelf-list"]'), null);
    assert.equal(document.querySelector('[data-testid="shelf-switch"]'), null);
    root.unmount();
  });

  it("defaults to section scope and can show all book notes", async () => {
    const { root } = await mount();
    assert.equal(document.querySelectorAll('[data-testid="notes-item"]').length, 1);
    assert.match(document.body.textContent ?? "", /误差不是错误/);
    assert.equal((document.body.textContent ?? "").includes("另一节的笔记"), false);

    const book = document.querySelector<HTMLButtonElement>('[data-testid="notes-scope-book"]');
    assert.ok(book);
    await act(async () => {
      book.click();
    });
    assert.equal(document.querySelectorAll('[data-testid="notes-item"]').length, 2);
    assert.match(document.body.textContent ?? "", /另一节的笔记/);
    root.unmount();
  });

  it("offers show-all when section is empty but the book has notes", async () => {
    const { root } = await mount({
      notes: [
        {
          id: "n2",
          topicId: "top_1",
          sectionId: "s2",
          body: "另一节的笔记",
          reasonCode: 1,
          type: "思考",
          kind: "formal",
          createdAt: 11,
        },
      ],
    });
    assert.ok(document.querySelector('[data-testid="notes-empty"]'));
    const showAll = document.querySelector<HTMLButtonElement>('[data-testid="notes-show-all"]');
    assert.ok(showAll);
    await act(async () => {
      showAll.click();
    });
    assert.equal(document.querySelectorAll('[data-testid="notes-item"]').length, 1);
    root.unmount();
  });

  it("filters by note kind chips", async () => {
    const { root } = await mount({
      notes: [
        ...notes,
        {
          id: "n3",
          topicId: "top_1",
          sectionId: "s1",
          body: "划线片段",
          reasonCode: 1,
          type: "思考",
          kind: "highlight",
          createdAt: 12,
        },
      ],
    });
    assert.equal(document.querySelectorAll('[data-testid="notes-item"]').length, 2);
    const highlight = document.querySelector<HTMLButtonElement>('[data-testid="notes-kind-highlight"]');
    assert.ok(highlight);
    await act(async () => {
      highlight.click();
    });
    assert.equal(document.querySelectorAll('[data-testid="notes-item"]').length, 1);
    assert.match(document.body.textContent ?? "", /划线片段/);
    root.unmount();
  });

  it("empty state when there is no current book", async () => {
    const { root } = await mount({ topic: null, notes: [] });
    assert.match(document.body.textContent ?? "", /还没有当前书籍|No current book/);
    root.unmount();
  });

  it("uses drawers when rails are not persistent", async () => {
    const { root } = await mount({ persistent: false, outlineOpen: true, notesOpen: true });
    assert.equal(
      document.querySelector('[data-testid="notes-outline-rail"]')?.getAttribute("data-state"),
      "closed",
    );
    assert.equal(
      document.querySelector('[data-testid="notes-list-rail"]')?.getAttribute("data-state"),
      "closed",
    );
    assert.ok(document.querySelector('[data-testid="notes-pane"]'));
    root.unmount();
  });
});
