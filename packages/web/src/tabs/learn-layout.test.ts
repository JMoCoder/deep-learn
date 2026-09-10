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
  open: { outlineOpen?: boolean; sessionOpen?: boolean; outlinePersistent?: boolean } = {},
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
