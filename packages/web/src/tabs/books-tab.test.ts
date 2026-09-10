import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { NoteRecord, SectionRecord, TopicSummary } from "@quantum/shared";
import { OUTLINE_RAIL_QUERY } from "@/lib/outline-rail";
import { BooksTab, BOOKS_PANE_KEY, readBooksPane } from "./BooksTab.tsx";

const originalMatchMedia = window.matchMedia;

function stubOutlineRail(wide: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === OUTLINE_RAIL_QUERY ? wide : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
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

  it("stretches the books body across the main region instead of a narrow centered column", () => {
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const body = document.querySelector("[data-testid=books-body]");
    assert.ok(body);
    assert.match(body.className, /\bw-full\b/);
    assert.equal(/\bmax-w-2xl\b/.test(body.className), false);
    assert.equal(/\bmx-auto\b/.test(body.className), false);
    root.unmount();
  });

  it("keeps a closed topic drawer mounted for exit animation without blocking the page", () => {
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    assert.ok(drawer);
    assert.equal(drawer.getAttribute("data-state"), "closed");
    assert.equal(drawer.hasAttribute("inert"), true);
    assert.match(drawer.className, /pointer-events-none/);
    assert.match(drawer.className, /transition-opacity/);
    const panel = drawer.querySelector("aside");
    assert.ok(panel);
    assert.match(panel.className, /transition-transform/);
    root.unmount();
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

  it("keeps exclusive 正文/笔记 panes on a narrow viewport", async () => {
    stubOutlineRail(false);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const hero = document.querySelector("[data-testid=books-hero]");
    assert.ok(hero);
    assert.equal(hero.getAttribute("data-layout"), "narrow");
    assert.equal(document.querySelector("[data-testid=books-spread]"), null);
    assert.ok(document.querySelector('[data-testid="books-pane-body"]'));
    assert.equal(document.querySelector('[data-testid="books-pane-notes"]'), null);

    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(notesTab);
    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assert.ok(document.querySelector('[data-testid="books-pane-notes"]'));
    assert.equal(document.querySelector('[data-testid="books-pane-body"]'), null);
    assert.equal(readBooksPane(), "notes");
    root.unmount();
  });

  it("packs the wide hero into two lines and uses the trailing space for chips", () => {
    stubOutlineRail(true);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const hero = document.querySelector("[data-testid=books-hero]");
    const meta = document.querySelector("[data-testid=books-hero-meta]");
    assert.ok(hero);
    assert.ok(meta);
    assert.equal(hero.getAttribute("data-layout"), "wide");
    assert.match(hero.className, /\bpy-2\b/);
    assert.equal(/\bpy-4\b/.test(hero.className), false);
    assert.match(hero.className, /items-center/);
    assert.equal(hero.contains(meta), true);
    assert.match(meta.className, /justify-end/);
    root.unmount();
  });

  it("opens 正文 and 笔记 as facing pages at the outline-rail breakpoint", async () => {
    stubOutlineRail(true);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const spread = document.querySelector("[data-testid=books-spread]");
    const body = document.querySelector("[data-testid=books-pane-body]");
    const notes = document.querySelector("[data-testid=books-pane-notes]");
    assert.ok(spread);
    assert.ok(body);
    assert.ok(notes);
    assert.match(spread.className, /grid-cols-2/);
    assert.equal(spread.firstElementChild, body);
    assert.equal(spread.lastElementChild, notes);
    assert.equal(body.getAttribute("data-active"), "true");
    assert.equal(notes.getAttribute("data-active"), "false");
    assert.match(document.body.textContent ?? "", /投影正文在这一段/);
    assert.match(document.body.textContent ?? "", /一条落盘笔记/);

    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    const bodyTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-body"]');
    assert.ok(notesTab);
    assert.ok(bodyTab);
    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assert.equal(notesTab.getAttribute("aria-selected"), "true");
    assert.equal(bodyTab.getAttribute("aria-selected"), "false");
    assert.equal(notes.getAttribute("data-active"), "true");
    assert.equal(body.getAttribute("data-active"), "false");
    assert.ok(document.querySelector("[data-testid=books-pane-body]"));
    assert.ok(document.querySelector("[data-testid=books-pane-notes]"));
    assert.equal(readBooksPane(), "notes");
    root.unmount();
  });

  it("uses the outline rail query for the books wide layout, not a second breakpoint", () => {
    assert.equal(OUTLINE_RAIL_QUERY, "(min-width: 768px)");
    stubOutlineRail(false);
    const narrow = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    assert.equal(document.querySelector("[data-testid=books-spread]"), null);
    assert.equal(
      document.querySelector("[data-testid=books-hero]")?.getAttribute("data-layout"),
      "narrow",
    );
    narrow.unmount();

    stubOutlineRail(true);
    const wide = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    assert.ok(document.querySelector("[data-testid=books-spread]"));
    assert.equal(
      document.querySelector("[data-testid=books-hero]")?.getAttribute("data-layout"),
      "wide",
    );
    wide.unmount();
  });
});
