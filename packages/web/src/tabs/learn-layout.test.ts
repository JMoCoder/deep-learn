import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import { LocaleProvider } from "@/i18n";
import { LearnTab } from "./LearnTab.tsx";

function mountLearn(
  frame = true,
  open: {
    outlineOpen?: boolean;
    sessionOpen?: boolean;
    outlinePersistent?: boolean;
    sessionPersistent?: boolean;
  } = {},
): Root {
  const host = document.createElement("div");
  if (frame) host.setAttribute("data-app-frame", "");
  host.className = "relative flex h-dvh flex-col";
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(
        LocaleProvider,
        null,
        createElement(LearnTab, {
          topic: {
            id: "t1",
            title: "量子力学",
            phase: "learning",
            exportState: "idle",
            createdAt: 1,
            updatedAt: 1,
          },
          section: {
            id: "s1",
            topicId: "t1",
            outlineNodeId: "n1",
            title: "测量",
            bodyMd: "正文",
            generatedAt: 1,
          },
          outline: [
            {
              id: "n1",
              title: "测量",
              intent: "",
              objective: "能复述测量假设",
              dependsOn: [],
              estimatedLength: 400,
              children: [],
            },
          ],
          prereqEdges: [],
          currentSectionId: "s1",
          outlineOpen: open.outlineOpen ?? false,
          outlinePersistent: open.outlinePersistent ?? false,
          sessionOpen: open.sessionOpen ?? true,
          sessionPersistent: open.sessionPersistent ?? false,
          onOutlineOpen: () => {},
          onSessionOpen: () => {},
          onSelectSection: () => {},
          messages: [],
          liveRows: [],
          streaming: "",
          busy: false,
          coachMode: "stub",
          error: null,
          onSend: () => {},
          snapshot: emptyBoundarySnapshot(),
          askedKinds: [],
          pendingBoundary: false,
          pendingOutline: false,
          onConfirmBoundary: () => {},
        }),
      ),
    );
  });
  return root;
}

describe("Learn sidebar is full-height of the frame", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps the session drawer out of the page stage so it can cover full frame height", () => {
    const root = mountLearn();
    const stage = document.querySelector("[data-testid=learn-stage]");
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    const top = document.querySelector("[data-testid=learn-top-region]");
    assert.ok(stage);
    assert.ok(drawer);
    assert.ok(top);
    assert.equal(stage.contains(drawer), false);
    assert.match(drawer.className, /\babsolute\b/);
    assert.match(drawer.className, /\binset-0\b/);
    root.unmount();
  });

  it("keeps closed drawers mounted so exit transitions can run, without blocking clicks", () => {
    const root = mountLearn(true, { outlineOpen: false, sessionOpen: false });
    const outline = document.querySelector("[data-testid=drawer-root][data-drawer-side=left]");
    const session = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    assert.ok(outline);
    assert.ok(session);
    assert.equal(outline.getAttribute("data-state"), "closed");
    assert.equal(session.getAttribute("data-state"), "closed");
    assert.equal(outline.hasAttribute("inert"), true);
    assert.equal(session.hasAttribute("inert"), true);
    assert.match(outline.className, /pointer-events-none/);
    assert.match(session.className, /pointer-events-none/);
    assert.match(outline.className, /transition-opacity/);
    assert.match(session.className, /transition-opacity/);
    const sessionPanel = session.querySelector("aside");
    assert.ok(sessionPanel);
    assert.match(sessionPanel.className, /transition-transform/);
    assert.match(sessionPanel.className, /translate-x-full/);
    root.unmount();
  });

  it("uses the same top-region height on the Learn header and the session header", () => {
    const root = mountLearn();
    const top = document.querySelector("[data-testid=learn-top-region]");
    const session = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    const sessionHeader = session?.querySelector("[data-testid=drawer-header]");
    assert.ok(top);
    assert.ok(sessionHeader);
    assert.match(top.className, /h-\[var\(--top-region-height\)\]/);
    assert.match(sessionHeader.className, /h-\[var\(--top-region-height\)\]/);
    assert.match(top.className, /\bborder-b\b/);
    assert.match(sessionHeader.className, /\bborder-b\b/);
    root.unmount();
  });
});

describe("Learn outline rail + full-width stage", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps a persistent outline rail with the tree, not a ghost strip", () => {
    const root = mountLearn(true, { outlineOpen: true, outlinePersistent: true, sessionOpen: false });
    const rail = document.querySelector("[data-testid=outline-rail]");
    assert.ok(rail);
    assert.equal(rail.getAttribute("data-state"), "open");
    assert.match(rail.className, /w-\[var\(--outline-rail-width\)\]/);
    assert.match(rail.className, /transition-\[width\]/);
    assert.match(rail.textContent ?? "", /测量/);
    assert.equal(/\bw-9\b/.test(rail.className), false);
    const article = document.querySelector("[data-testid=learn-article]");
    assert.ok(article);
    assert.match(article.className, /\bw-full\b/);
    assert.equal(/\bmax-w-2xl\b/.test(article.className), false);
    assert.equal(/\bmx-auto\b/.test(article.className), false);
    root.unmount();
  });

  it("collapses the rail on a narrow viewport and uses the overlay drawer instead", () => {
    const root = mountLearn(true, {
      outlineOpen: true,
      outlinePersistent: false,
      sessionOpen: false,
    });
    const rail = document.querySelector("[data-testid=outline-rail]");
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=left]");
    assert.ok(rail);
    assert.ok(drawer);
    assert.equal(rail.getAttribute("data-state"), "closed");
    assert.match(rail.className, /\bw-0\b/);
    assert.equal(drawer.getAttribute("data-state"), "open");
    assert.equal(drawer.hasAttribute("inert"), false);
    root.unmount();
  });
});

describe("Learn session rail + full-width stage", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps a persistent session rail in flow, not an overlay drawer", () => {
    const root = mountLearn(true, {
      outlineOpen: false,
      sessionOpen: true,
      sessionPersistent: true,
    });
    const rail = document.querySelector("[data-testid=session-rail]");
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    const article = document.querySelector("[data-testid=learn-article]");
    const header = document.querySelector("[data-testid=session-rail-header]");
    assert.ok(rail);
    assert.ok(drawer);
    assert.ok(article);
    assert.ok(header);
    assert.equal(rail.getAttribute("data-state"), "open");
    assert.match(rail.className, /w-\[var\(--session-rail-width\)\]/);
    assert.match(rail.className, /transition-\[width\]/);
    assert.equal(/\babsolute\b/.test(rail.className), false);
    assert.equal(drawer.getAttribute("data-state"), "closed");
    assert.equal(drawer.hasAttribute("inert"), true);
    assert.match(article.className, /\bw-full\b/);
    assert.match(header.className, /h-\[var\(--top-region-height\)\]/);
    root.unmount();
  });

  it("collapses the persistent session rail with a width transition", () => {
    const root = mountLearn(true, {
      sessionOpen: false,
      sessionPersistent: true,
    });
    const rail = document.querySelector("[data-testid=session-rail]");
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    const toggle = document.querySelector("[data-testid=learn-session-toggle]");
    assert.ok(rail);
    assert.ok(drawer);
    assert.ok(toggle);
    assert.equal(rail.getAttribute("data-state"), "closed");
    assert.match(rail.className, /\bw-0\b/);
    assert.match(rail.className, /transition-\[width\]/);
    assert.equal(drawer.getAttribute("data-state"), "closed");
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    root.unmount();
  });

  it("toggles the persistent session rail from the top-bar button", () => {
    let sessionOpen = true;
    const host = document.createElement("div");
    host.setAttribute("data-app-frame", "");
    host.className = "relative flex h-dvh flex-col";
    document.body.appendChild(host);
    const root = createRoot(host);

    function render() {
      act(() => {
        root.render(
          createElement(
            LocaleProvider,
            null,
            createElement(LearnTab, {
              topic: {
                id: "t1",
                title: "量子力学",
                phase: "learning",
                exportState: "idle",
                createdAt: 1,
                updatedAt: 1,
              },
              section: {
                id: "s1",
                topicId: "t1",
                outlineNodeId: "n1",
                title: "测量",
                bodyMd: "正文",
                generatedAt: 1,
              },
              outline: [],
              prereqEdges: [],
              currentSectionId: "s1",
              outlineOpen: false,
              outlinePersistent: true,
              sessionOpen,
              sessionPersistent: true,
              onOutlineOpen: () => {},
              onSessionOpen: (open: boolean) => {
                sessionOpen = open;
                render();
              },
              onSelectSection: () => {},
              messages: [],
              liveRows: [],
              streaming: "",
              busy: false,
              coachMode: "stub",
              error: null,
              onSend: () => {},
              snapshot: emptyBoundarySnapshot(),
              askedKinds: [],
              pendingBoundary: false,
              pendingOutline: false,
              onConfirmBoundary: () => {},
            }),
          ),
        );
      });
    }

    render();
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid=learn-session-toggle]");
    const rail = () => document.querySelector("[data-testid=session-rail]");
    assert.ok(toggle);
    assert.equal(rail()?.getAttribute("data-state"), "open");
    act(() => {
      toggle.click();
    });
    assert.equal(sessionOpen, false);
    assert.equal(rail()?.getAttribute("data-state"), "closed");
    assert.match(rail()?.className ?? "", /\bw-0\b/);
    assert.match(rail()?.className ?? "", /transition-\[width\]/);
    act(() => {
      toggle.click();
    });
    assert.equal(sessionOpen, true);
    assert.equal(rail()?.getAttribute("data-state"), "open");
    root.unmount();
  });

  it("collapses the session rail on a narrow viewport and uses the overlay drawer instead", () => {
    const root = mountLearn(true, {
      sessionOpen: true,
      sessionPersistent: false,
    });
    const rail = document.querySelector("[data-testid=session-rail]");
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    assert.ok(rail);
    assert.ok(drawer);
    assert.equal(rail.getAttribute("data-state"), "closed");
    assert.match(rail.className, /\bw-0\b/);
    assert.equal(drawer.getAttribute("data-state"), "open");
    assert.equal(drawer.hasAttribute("inert"), false);
    assert.match(drawer.className, /\babsolute\b/);
    root.unmount();
  });
});
