import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import { LocaleProvider } from "@/i18n";
import { LearnTab } from "./LearnTab.tsx";

function assertSessionChrome(host: Element | null) {
  assert.ok(host);
  const transcript = host.querySelector('[data-testid="session-transcript"]');
  const guidance = host.querySelector('[data-testid="session-inflow-guidance"]');
  const hint = host.querySelector('[data-testid="accept-hint"]');
  const shell = host.querySelector('[data-testid="session-composer-shell"]');
  const box = host.querySelector('[data-testid="session-composer"]');
  const actions = host.querySelector('[data-testid="session-composer-actions"]');
  const send = host.querySelector('[data-testid="session-send"]');
  assert.ok(transcript);
  assert.ok(guidance);
  assert.ok(hint);
  assert.ok(shell);
  assert.ok(box);
  assert.ok(actions);
  assert.ok(send);
  assert.match(transcript.className, /overflow-y-auto/);
  assert.equal(transcript.contains(guidance), true);
  assert.equal(transcript.contains(hint), true);
  assert.equal(transcript.contains(shell), false);
  assert.equal(shell.contains(box), true);
  assert.equal(shell.contains(send), true);
  assert.equal(box.nextElementSibling, actions);
  assert.match(actions.className, /justify-end/);
  assert.ok(Number(box.getAttribute("rows") ?? "0") >= 4);
  assert.match(box.className, /min-h-24/);
}

function mountLearn(
  frame = true,
  open: {
    outlineOpen?: boolean;
    sessionOpen?: boolean;
    outlinePersistent?: boolean;
    sessionPersistent?: boolean;
    coachMode?: "stub" | "live";
    phase?: "learning" | "boundary_interview";
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
            phase: open.phase ?? "learning",
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
          coachMode: open.coachMode ?? "stub",
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
    assert.equal(drawer.getAttribute("data-swipe-dismiss"), "true");
    assert.match(drawer.className, /transition-opacity/);
    const panel = drawer.querySelector("[data-testid=drawer-panel]");
    assert.ok(panel);
    assert.match(panel.className, /transition-transform/);
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
    assert.equal(rail.hasAttribute("inert"), false);
    assert.equal(rail.querySelector("textarea[name=text]") !== null, true);
    assert.equal(drawer.querySelector("textarea[name=text]"), null);
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
    assert.equal(rail.hasAttribute("inert"), true);
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
    assert.equal(rail.hasAttribute("inert"), true);
    assert.equal(drawer.getAttribute("data-state"), "open");
    assert.equal(drawer.hasAttribute("inert"), false);
    assert.equal(drawer.getAttribute("data-swipe-dismiss"), "true");
    assert.match(drawer.className, /\babsolute\b/);
    assert.match(drawer.className, /transition-opacity/);
    assert.equal(rail.querySelector("textarea[name=text]"), null);
    assert.equal(drawer.querySelector("textarea[name=text]") !== null, true);
    root.unmount();
  });

  it("uses the same in-flow guidance + composer chrome on the rail and the drawer", () => {
    const railRoot = mountLearn(true, {
      sessionOpen: true,
      sessionPersistent: true,
      coachMode: "stub",
      phase: "boundary_interview",
    });
    const rail = document.querySelector("[data-testid=session-rail]");
    assertSessionChrome(rail);
    assert.equal(rail?.querySelector("[data-testid=interview-guide]") !== null, true);
    const railClasses = {
      transcript: rail?.querySelector("[data-testid=session-transcript]")?.className,
      shell: rail?.querySelector("[data-testid=session-composer-shell]")?.className,
      actions: rail?.querySelector("[data-testid=session-composer-actions]")?.className,
    };
    railRoot.unmount();

    const drawerRoot = mountLearn(true, {
      sessionOpen: true,
      sessionPersistent: false,
      coachMode: "live",
      phase: "boundary_interview",
    });
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    const body = drawer?.querySelector("[data-testid=drawer-scroll]");
    assert.ok(drawer);
    assert.ok(body);
    assert.equal(body.getAttribute("data-fill"), "true");
    assert.match(body.className, /overflow-hidden/);
    assert.equal(/\boverflow-y-auto\b/.test(body.className), false);
    assertSessionChrome(drawer);
    assert.equal(drawer.querySelector("[data-testid=interview-guide]") !== null, true);
    assert.equal(drawer.querySelector("[data-testid=session-transcript]")?.className, railClasses.transcript);
    assert.equal(drawer.querySelector("[data-testid=session-composer-shell]")?.className, railClasses.shell);
    assert.equal(drawer.querySelector("[data-testid=session-composer-actions]")?.className, railClasses.actions);
    drawerRoot.unmount();
  });
});

describe("outline card uses web gates, not chat 可以", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("confirm / revise call card handlers instead of sending 可以", () => {
    const sent: string[] = [];
    const confirmed: string[] = [];
    const revised: string[] = [];
    const host = document.createElement("div");
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
              phase: "outline_draft",
              exportState: "idle",
              createdAt: 1,
              updatedAt: 1,
            },
            section: null,
            outline: [
              {
                id: "n1",
                topicId: "t1",
                parentId: null,
                title: "定向",
                intent: "地图",
                objective: "能指出路线",
                dependsOn: [],
                targetChars: 200,
                sortOrder: 0,
                status: "draft",
                children: [],
              },
            ],
            prereqEdges: [],
            currentSectionId: null,
            outlineOpen: false,
            sessionOpen: false,
            onOutlineOpen: () => {},
            onSessionOpen: () => {},
            onSelectSection: () => {},
            messages: [],
            liveRows: [],
            streaming: "",
            busy: false,
            coachMode: "stub",
            error: null,
            onSend: (text) => sent.push(text),
            snapshot: { ...emptyBoundarySnapshot(), chunk_budget: "每周 2 小时" },
            askedKinds: [],
            pendingBoundary: false,
            pendingOutline: true,
            onConfirmBoundary: () => {},
            onConfirmOutline: () => confirmed.push("card"),
            onReviseOutline: () => revised.push("card"),
          }),
        ),
      );
    });
    const buttons = [...host.querySelectorAll("button")];
    const confirm = buttons.find((btn) => /确认大纲|Confirm outline/.test(btn.textContent ?? ""));
    const revise = buttons.find((btn) => /要改结构|Change the structure/.test(btn.textContent ?? ""));
    assert.ok(confirm);
    assert.ok(revise);
    act(() => {
      confirm.click();
      revise.click();
    });
    assert.deepEqual(sent, []);
    assert.deepEqual(confirmed, ["card"]);
    assert.deepEqual(revised, ["card"]);
    root.unmount();
  });
});

describe("Learn swipe dismiss is drawer-only", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not swipe-dismiss persistent wide rails", async () => {
    let outlineOpen = true;
    let sessionOpen = true;
    const host = document.createElement("div");
    host.setAttribute("data-app-frame", "");
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
              outlineOpen,
              outlinePersistent: true,
              sessionOpen,
              sessionPersistent: true,
              onOutlineOpen: (open: boolean) => {
                outlineOpen = open;
                render();
              },
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
    const outlineRail = document.querySelector("[data-testid=outline-rail]");
    const sessionRail = document.querySelector("[data-testid=session-rail]");
    const outlineDrawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=left]");
    const sessionDrawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=right]");
    assert.ok(outlineRail);
    assert.ok(sessionRail);
    assert.ok(outlineDrawer);
    assert.ok(sessionDrawer);
    assert.equal(outlineRail.getAttribute("data-state"), "open");
    assert.equal(sessionRail.getAttribute("data-state"), "open");
    assert.equal(outlineRail.getAttribute("data-swipe-dismiss"), "false");
    assert.equal(sessionRail.getAttribute("data-swipe-dismiss"), "false");
    assert.equal(outlineDrawer.getAttribute("data-state"), "closed");
    assert.equal(sessionDrawer.getAttribute("data-state"), "closed");

    await act(async () => {
      outlineRail.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 160,
          clientY: 40,
        }),
      );
      outlineRail.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 20,
          clientY: 40,
        }),
      );
      outlineRail.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 20,
          clientY: 40,
        }),
      );
    });
    assert.equal(outlineOpen, true);
    assert.equal(sessionOpen, true);
    assert.equal(outlineRail.getAttribute("data-state"), "open");
    root.unmount();
  });

  it("closes a narrow outline drawer on a reverse swipe", async () => {
    let outlineOpen = true;
    const host = document.createElement("div");
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
              outlineOpen,
              outlinePersistent: false,
              sessionOpen: false,
              sessionPersistent: false,
              onOutlineOpen: (open: boolean) => {
                outlineOpen = open;
                render();
              },
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
    }

    render();
    const drawer = document.querySelector("[data-testid=drawer-root][data-drawer-side=left]");
    const panel = document.querySelector("[data-testid=drawer-panel]");
    const rail = document.querySelector("[data-testid=outline-rail]");
    assert.ok(drawer);
    assert.ok(panel);
    assert.ok(rail);
    assert.equal(drawer.getAttribute("data-swipe-dismiss"), "true");
    assert.equal(rail.getAttribute("data-swipe-dismiss"), "false");
    assert.equal(drawer.getAttribute("data-state"), "open");

    await act(async () => {
      panel.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 160,
          clientY: 48,
        }),
      );
      panel.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 40,
          clientY: 48,
        }),
      );
      panel.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 40,
          clientY: 48,
        }),
      );
    });
    assert.equal(outlineOpen, false);
    assert.equal(drawer.getAttribute("data-state"), "closed");
    root.unmount();
  });
});
