import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { NoteRecord, SectionRecord, TopicSummary } from "@quantum/shared";
import { BooksTab, BOOKS_PANE_KEY, readBooksPane } from "./BooksTab.tsx";

const topic: TopicSummary = {
  id: "t1",
  title: "量子力学",
  phase: "learning",
  exportState: "idle",
  createdAt: 1,
  updatedAt: 1,
};

const section: SectionRecord = {
  id: "s1",
  topicId: "t1",
  outlineNodeId: "n1",
  title: "测量",
  bodyMd: "投影正文在这一段。",
  generatedAt: 1,
};

const notes: NoteRecord[] = [
  {
    id: "n1",
    topicId: "t1",
    sectionId: "s1",
    body: "一条落盘笔记",
    reasonCode: 1,
    type: "思考",
    createdAt: 1,
  },
];

function mountBooks(
  onCreate: () => void,
  onDrawerOpen: (open: boolean) => void,
  extras?: { drawerOpen?: boolean; topic?: TopicSummary | null },
): Root {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(BooksTab, {
        topic: extras?.topic === undefined ? null : extras.topic,
        section: extras?.topic ? section : null,
        notes: extras?.topic ? notes : [],
        outline: [],
        boundaries: [],
        topics: extras?.topic ? [topic] : [],
        drawerOpen: extras?.drawerOpen ?? true,
        onDrawerOpen,
        onCreate,
        onSwitch: () => {},
        onExport: () => {},
      }),
    );
  });
  return root;
}

describe("1.1 books drawer 新建主题", () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.removeItem(BOOKS_PANE_KEY);
  });

  it("clicks 新建主题 and calls onCreate (createTopic), not only close", async () => {
    const events: string[] = [];
    const root = mountBooks(
      () => events.push("create"),
      (open) => events.push(open ? "open" : "close"),
    );

    const button = document.querySelector<HTMLButtonElement>('[data-testid="create-topic"]');
    assert.ok(button, "create-topic button must be in the drawer");
    assert.match(button.textContent ?? "", /新建主题|New topic/);

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    assert.deepEqual(events, ["create"]);
    assert.equal(events.includes("close"), false);
    root.unmount();
  });

  it("overlay dismiss closes the drawer without createTopic", async () => {
    const events: string[] = [];
    const root = mountBooks(
      () => events.push("create"),
      (open) => events.push(open ? "open" : "close"),
    );

    const overlay = document.querySelector<HTMLElement>('[data-testid="drawer-dismiss"]');
    assert.ok(overlay);
    await act(async () => {
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    assert.deepEqual(events, ["close"]);
    root.unmount();
  });
});

describe("books hero switch + 正文/笔记 tabs", () => {
  afterEach(() => {
    document.body.replaceChildren();
    sessionStorage.removeItem(BOOKS_PANE_KEY);
  });

  it("places the switch control inside the hero and vertically centered", () => {
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const hero = document.querySelector(".hero-topic");
    const switchBtn = document.querySelector<HTMLButtonElement>('[data-testid="open-topic-drawer"]');
    assert.ok(hero);
    assert.ok(switchBtn);
    assert.equal(hero.contains(switchBtn), true);
    assert.match(switchBtn.textContent ?? "", /切换|Switch/);
    assert.match(hero.className, /items-center/);
    assert.match(switchBtn.className, /self-center/);
    root.unmount();
  });

  it("switches 正文 / 笔记 on click and persists the pane", async () => {
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );

    const bodyTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-body"]');
    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(bodyTab);
    assert.ok(notesTab);
    assert.equal(bodyTab.getAttribute("aria-selected"), "true");
    assert.ok(document.querySelector('[data-testid="books-pane-body"]'));
    assert.match(document.body.textContent ?? "", /投影正文在这一段/);

    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    assert.equal(notesTab.getAttribute("aria-selected"), "true");
    assert.equal(bodyTab.getAttribute("aria-selected"), "false");
    assert.ok(document.querySelector('[data-testid="books-pane-notes"]'));
    assert.equal(document.querySelector('[data-testid="books-pane-body"]'), null);
    assert.match(document.body.textContent ?? "", /一条落盘笔记/);
    assert.equal(readBooksPane(), "notes");
    root.unmount();

    const again = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const notesAgain = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(notesAgain);
    assert.equal(notesAgain.getAttribute("aria-selected"), "true");
    assert.ok(document.querySelector('[data-testid="books-pane-notes"]'));
    again.unmount();
  });

  it("keeps the topic drawer out of the page stage so it stays full height", () => {
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: true, topic },
    );
    const stage = document.querySelector("[data-testid=books-stage]");
    const drawer = document.querySelector("[data-testid=drawer-root]");
    assert.ok(stage);
    assert.ok(drawer);
    assert.equal(stage.contains(drawer), false);
    assert.match(drawer.className, /\babsolute\b/);
    assert.match(drawer.className, /\binset-0\b/);
    root.unmount();
  });
});
