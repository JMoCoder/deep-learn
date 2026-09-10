import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import type { NoteRecord, SectionRecord, TopicSummary } from "@quantum/shared";
import { OUTLINE_RAIL_QUERY } from "@/lib/outline-rail";
import {
  BooksTab,
  BOOKS_PANE_INACTIVE,
  BOOKS_PANE_KEY,
  BOOKS_PANE_SURFACE,
  booksSpreadPaneSurface,
  readBooksPane,
} from "./BooksTab.tsx";

const originalMatchMedia = window.matchMedia;

function hasClassToken(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}

function assertChipMatchesContent(pane: "body" | "notes"): void {
  const expected = BOOKS_PANE_SURFACE[pane];
  const other = pane === "notes" ? BOOKS_PANE_SURFACE.body : BOOKS_PANE_SURFACE.notes;
  const tab = document.querySelector(`[data-testid=books-tab-${pane}]`);
  const surface = document.querySelector("[data-testid=books-content-surface]");
  const panel = document.querySelector(`[data-testid=books-pane-${pane}]`);
  assert.ok(tab);
  assert.ok(surface);
  assert.ok(panel);
  assert.equal(tab.getAttribute("aria-selected"), "true");
  assert.equal(surface.getAttribute("data-pane"), pane);
  assert.equal(hasClassToken(tab.className, expected), true);
  assert.equal(hasClassToken(surface.className, expected), true);
  assert.equal(hasClassToken(panel.className, expected), true);
  assert.equal(hasClassToken(tab.className, other), false);
  assert.equal(hasClassToken(surface.className, other), false);
  assert.equal(hasClassToken(panel.className, other), false);
  assert.equal(hasClassToken(panel.className, BOOKS_PANE_INACTIVE), false);
}

function assertWideInactiveDimmed(inactive: "body" | "notes"): void {
  const panel = document.querySelector(`[data-testid=books-pane-${inactive}]`);
  assert.ok(panel);
  assert.equal(hasClassToken(panel.className, BOOKS_PANE_SURFACE.body), false);
  assert.equal(hasClassToken(panel.className, BOOKS_PANE_SURFACE.notes), false);
  assert.equal(hasClassToken(panel.className, BOOKS_PANE_INACTIVE), true);
  assert.equal(/\bopacity-/.test(panel.className), false);
}

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
  extras?: { drawerOpen?: boolean; topic?: TopicSummary | null; notes?: NoteRecord[] },
): Root {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(BooksTab, {
        topic: extras?.topic === undefined ? null : extras.topic,
        section: extras?.topic ? section : null,
        notes: extras?.topic ? (extras.notes ?? notes) : [],
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
    assertChipMatchesContent("body");

    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    assert.equal(notesTab.getAttribute("aria-selected"), "true");
    assertChipMatchesContent("notes");
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

  it("maps wide-pane surfaces to the active chip fill and a dimmed inactive fill", () => {
    assert.equal(booksSpreadPaneSurface("body", "body"), BOOKS_PANE_SURFACE.body);
    assert.equal(booksSpreadPaneSurface("notes", "notes"), BOOKS_PANE_SURFACE.notes);
    assert.equal(booksSpreadPaneSurface("notes", "body"), BOOKS_PANE_INACTIVE);
    assert.equal(booksSpreadPaneSurface("body", "notes"), BOOKS_PANE_INACTIVE);
    assert.notEqual(BOOKS_PANE_SURFACE.body, BOOKS_PANE_INACTIVE);
    assert.notEqual(BOOKS_PANE_SURFACE.notes, BOOKS_PANE_INACTIVE);
  });

  it("paints the content surface with the active tab chip background", async () => {
    assert.notEqual(BOOKS_PANE_SURFACE.body, BOOKS_PANE_SURFACE.notes);

    stubOutlineRail(false);
    const narrow = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    assertChipMatchesContent("body");
    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(notesTab);
    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assertChipMatchesContent("notes");
    narrow.unmount();
    sessionStorage.removeItem(BOOKS_PANE_KEY);

    stubOutlineRail(true);
    const wide = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    assertChipMatchesContent("body");
    assertWideInactiveDimmed("notes");
    const wideNotes = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(wideNotes);
    await act(async () => {
      wideNotes.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assertChipMatchesContent("notes");
    assertWideInactiveDimmed("body");
    wide.unmount();
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
    const narrowBody = document.querySelector('[data-testid="books-pane-body"]');
    assert.ok(narrowBody);
    assertChipMatchesContent("body");
    assert.equal(/shadow-\[inset/.test(narrowBody.className), false);
    assert.equal(document.querySelector('[data-testid="books-pane-notes"]'), null);

    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(notesTab);
    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const narrowNotes = document.querySelector('[data-testid="books-pane-notes"]');
    assert.ok(narrowNotes);
    assertChipMatchesContent("notes");
    assert.equal(hasClassToken(narrowNotes.className, "border-l"), false);
    assert.equal(/shadow-\[inset/.test(narrowNotes.className), false);
    assert.equal(document.querySelector('[data-testid="books-pane-body"]'), null);
    assert.equal(readBooksPane(), "notes");
    root.unmount();
  });

  it("keeps the wide hero to one primary row without collapsing the short card", () => {
    stubOutlineRail(true);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const hero = document.querySelector("[data-testid=books-hero]");
    const meta = document.querySelector("[data-testid=books-hero-meta]");
    const accent = hero?.querySelector(".hero-accent");
    assert.ok(hero);
    assert.ok(meta);
    assert.ok(accent);
    assert.equal(hero.getAttribute("data-layout"), "wide");
    assert.match(hero.className, /\bpy-2\b/);
    assert.equal(/\bpy-4\b/.test(hero.className), false);
    assert.match(hero.className, /\bmin-h-16\b/);
    assert.match(hero.className, /items-center/);
    assert.equal(hero.contains(meta), true);
    assert.match(meta.className, /justify-end/);
    assert.match(meta.className, /items-center/);
    assert.match(meta.className, /self-center/);
    const primary = document.querySelector("[data-testid=books-hero-primary]");
    assert.ok(primary);
    assert.equal(hero.contains(primary), true);
    assert.match(primary.className, /items-center/);
    assert.equal(/items-baseline/.test(primary.className), false);
    const title = primary.querySelector("h1");
    assert.ok(title);
    assert.match(title.className, /leading-none/);
    const primaryRow = primary.parentElement;
    assert.ok(primaryRow);
    assert.match(primaryRow.className, /items-center/);
    assert.match(primaryRow.className, /self-center/);
    assert.match(accent.className, /hero-accent--wide/);
    const heroText = hero.textContent ?? "";
    assert.match(heroText, /量子力学/);
    assert.match(heroText, /当前主题|Current topic/);
    assert.equal(/边界未齐/.test(heroText), false);
    assert.equal(/先打开学习页/.test(heroText), false);
    assert.equal(/If the boundary is incomplete/.test(heroText), false);
    assert.equal(/完整边界卡在学习页/.test(heroText), false);
    assert.equal(/this line does not advance/.test(heroText), false);
    root.unmount();
  });

  it("omits empty-state second-line prompts from the wide hero when there is no topic", () => {
    stubOutlineRail(true);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic: null },
    );
    const hero = document.querySelector("[data-testid=books-hero]");
    assert.ok(hero);
    assert.equal(hero.getAttribute("data-layout"), "wide");
    const heroText = hero.textContent ?? "";
    assert.match(heroText, /还没有当前主题|No current topic/);
    assert.equal(/点右侧打开主题抽屉/.test(heroText), false);
    assert.equal(/Open the topic drawer on the right/.test(heroText), false);
    assert.equal(/边界未齐/.test(heroText), false);
    root.unmount();
  });

  it("keeps empty/no-goal second-line copy on the narrow Books hero", () => {
    stubOutlineRail(false);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic },
    );
    const hero = document.querySelector("[data-testid=books-hero]");
    assert.ok(hero);
    assert.equal(hero.getAttribute("data-layout"), "narrow");
    assert.equal(/\bmin-h-16\b/.test(hero.className), false);
    const accent = hero.querySelector(".hero-accent");
    assert.ok(accent);
    assert.equal(/hero-accent--wide/.test(accent.className), false);
    assert.match(hero.textContent ?? "", /边界未齐时，先打开学习页右上角会话|If the boundary is incomplete/);
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
    assert.equal(hasClassToken(spread.className, "bg-paper-deep/40"), false);
    assert.equal(spread.className.split(/\s+/).some((token) => token.startsWith("bg-")), false);
    assert.match(spread.className, /rounded-lg/);
    assert.equal(spread.firstElementChild, body);
    assert.equal(spread.lastElementChild, notes);
    assert.equal(/shadow-\[inset/.test(body.className), false);
    assert.equal(/shadow-\[inset/.test(notes.className), false);
    assert.equal(/#fffaf2/.test(body.className), false);
    assert.equal(/#f6efe3/.test(notes.className), false);
    assertChipMatchesContent("body");
    assertWideInactiveDimmed("notes");
    assert.equal(hasClassToken(notes.className, "border-l"), true);
    assert.notEqual(body.className, notes.className);
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
    assertChipMatchesContent("notes");
    assertWideInactiveDimmed("body");
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

  it("shows books note meta as 思考/疑问/拓展 + time, never a bare reason_code digit", async () => {
    const typedNotes: NoteRecord[] = [
      { ...notes[0]!, id: "n-think", reasonCode: 1, type: "思考", body: "心得" },
      { ...notes[0]!, id: "n-q2", reasonCode: 2, type: "疑问", body: "未解" },
      { ...notes[0]!, id: "n-ext", reasonCode: 3, type: "拓展", body: "旁支" },
      { ...notes[0]!, id: "n-q4", reasonCode: 4, type: "疑问", body: "往返" },
    ];
    stubOutlineRail(false);
    const root = mountBooks(
      () => {},
      () => {},
      { drawerOpen: false, topic, notes: typedNotes },
    );
    const notesTab = document.querySelector<HTMLButtonElement>('[data-testid="books-tab-notes"]');
    assert.ok(notesTab);
    await act(async () => {
      notesTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    const metas = [...document.querySelectorAll("[data-testid=books-note-meta]")].map(
      (el) => el.textContent ?? "",
    );
    assert.equal(metas.length, 4);
    assert.match(metas[0] ?? "", /^思考 · /);
    assert.match(metas[1] ?? "", /^疑问 · /);
    assert.match(metas[2] ?? "", /^拓展 · /);
    assert.match(metas[3] ?? "", /^疑问 · /);
    for (const line of metas) {
      assert.equal(/\b[1-4]\b/.test(line.split(" · ")[0] ?? ""), false);
      assert.equal(/(^| · )[1-4]( · |$)/.test(line), false);
    }
    root.unmount();
  });
});
