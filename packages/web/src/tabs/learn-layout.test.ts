import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import { LocaleProvider } from "@/i18n";
import { LearnTab } from "./LearnTab.tsx";

function mountLearn(frame = true): Root {
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
          outline: [],
          prereqEdges: [],
          currentSectionId: "s1",
          outlineOpen: false,
          sessionOpen: true,
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
    const drawer = document.querySelector("[data-testid=drawer-root]");
    const top = document.querySelector("[data-testid=learn-top-region]");
    assert.ok(stage);
    assert.ok(drawer);
    assert.ok(top);
    assert.equal(stage.contains(drawer), false);
    assert.match(drawer.className, /\babsolute\b/);
    assert.match(drawer.className, /\binset-0\b/);
    root.unmount();
  });

  it("uses the same top-region height on the Learn header and the session header", () => {
    const root = mountLearn();
    const top = document.querySelector("[data-testid=learn-top-region]");
    const sessionHeader = document.querySelector("[data-testid=drawer-header]");
    assert.ok(top);
    assert.ok(sessionHeader);
    assert.match(top.className, /h-\[var\(--top-region-height\)\]/);
    assert.match(sessionHeader.className, /h-\[var\(--top-region-height\)\]/);
    assert.match(top.className, /\bborder-b\b/);
    assert.match(sessionHeader.className, /\bborder-b\b/);
    root.unmount();
  });
});
