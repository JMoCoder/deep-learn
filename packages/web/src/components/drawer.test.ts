import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { Drawer } from "./Drawer.tsx";

function pointer(el: Element, type: string, x: number, y: number): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: x,
      clientY: y,
      button: 0,
    }),
  );
}

async function swipe(el: Element, fromX: number, toX: number, y = 48): Promise<void> {
  await act(async () => {
    pointer(el, "pointerdown", fromX, y);
    pointer(el, "pointermove", fromX + (toX - fromX) / 2, y);
    pointer(el, "pointermove", toX, y);
    pointer(el, "pointerup", toX, y);
  });
}

function mountDrawer(
  props: {
    open?: boolean;
    side?: "left" | "right";
    swipeDismiss?: boolean;
    onClose?: () => void;
  } = {},
): { root: Root; closes: string[] } {
  const closes: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const node: ReactElement = createElement(
    Drawer,
    {
      contained: true,
      open: props.open ?? true,
      side: props.side ?? "left",
      title: "大纲",
      swipeDismiss: props.swipeDismiss,
      onClose: () => {
        closes.push("close");
        props.onClose?.();
      },
    },
    "tree",
  );
  act(() => {
    root.render(node);
  });
  return { root, closes };
}

describe("Drawer overlay + reverse swipe dismiss", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps tap-outside-to-close and open/close transitions", async () => {
    const { root, closes } = mountDrawer();
    const rootEl = document.querySelector("[data-testid=drawer-root]");
    const overlay = document.querySelector<HTMLElement>("[data-testid=drawer-dismiss]");
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(rootEl);
    assert.ok(overlay);
    assert.ok(panel);
    assert.equal(rootEl.getAttribute("data-state"), "open");
    assert.equal(rootEl.getAttribute("data-swipe-dismiss"), "true");
    assert.match(rootEl.className, /transition-opacity/);
    assert.match(panel.className, /transition-transform/);
    await act(async () => {
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assert.deepEqual(closes, ["close"]);
    root.unmount();
  });

  it("closes a left drawer on a reverse (leftward) swipe only", async () => {
    const left = mountDrawer({ side: "left" });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(panel);
    await swipe(panel, 160, 40);
    assert.deepEqual(left.closes, ["close"]);
    left.root.unmount();

    const stay = mountDrawer({ side: "left" });
    const stayPanel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(stayPanel);
    await swipe(stayPanel, 40, 160);
    assert.deepEqual(stay.closes, []);
    stay.root.unmount();
  });

  it("closes a right drawer on a reverse (rightward) swipe only", async () => {
    const right = mountDrawer({ side: "right" });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(panel);
    await swipe(panel, 40, 160);
    assert.deepEqual(right.closes, ["close"]);
    right.root.unmount();

    const stay = mountDrawer({ side: "right" });
    const stayPanel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(stayPanel);
    await swipe(stayPanel, 160, 40);
    assert.deepEqual(stay.closes, []);
    stay.root.unmount();
  });

  it("does not swipe-dismiss when the flag is off (wide rails)", async () => {
    const { root, closes } = mountDrawer({ side: "left", swipeDismiss: false });
    const rootEl = document.querySelector("[data-testid=drawer-root]");
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(rootEl);
    assert.ok(panel);
    assert.equal(rootEl.getAttribute("data-swipe-dismiss"), "false");
    assert.equal(panel.hasAttribute("data-swipe-pan-y"), false);
    await swipe(panel, 160, 40);
    assert.deepEqual(closes, []);
    root.unmount();
  });

  it("keeps a reverse swipe after lostpointercapture and pointercancel (iOS scroll child)", async () => {
    const { root, closes } = mountDrawer({ side: "left" });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(panel);
    await act(async () => {
      pointer(panel, "pointerdown", 160, 48);
      pointer(panel, "pointermove", 140, 48);
      panel.dispatchEvent(
        new PointerEvent("lostpointercapture", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 140,
          clientY: 48,
        }),
      );
      panel.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 140,
          clientY: 48,
        }),
      );
      pointer(panel, "pointermove", 40, 48);
      pointer(panel, "pointerup", 40, 48);
    });
    assert.deepEqual(closes, ["close"]);
    root.unmount();
  });

  it("tracks a reverse swipe from the overflow body via document listeners", async () => {
    const { root, closes } = mountDrawer({ side: "left" });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    const body = panel?.querySelector(".overflow-y-auto");
    assert.ok(panel);
    assert.ok(body);
    assert.equal(panel.getAttribute("data-swipe-pan-y"), "true");
    assert.match(panel.className, /touch-pan-y/);
    assert.match(body.className, /touch-pan-y/);
    assert.equal(/\btouch-none\b/.test(panel.className), false);
    await swipe(body, 160, 40);
    assert.deepEqual(closes, ["close"]);
    root.unmount();
  });

  it("keeps reverse swipe when a nested overflow child has no touch-pan-y class", async () => {
    const closes: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            contained: true,
            open: true,
            side: "right",
            title: "会话",
            onClose: () => closes.push("close"),
          },
          createElement(
            "div",
            { className: "min-h-0 flex-1 overflow-y-auto", "data-testid": "nested-scroll" },
            "transcript",
          ),
        ),
      );
    });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    const nested = document.querySelector("[data-testid=nested-scroll]");
    assert.ok(panel);
    assert.ok(nested);
    assert.equal(panel.getAttribute("data-swipe-pan-y"), "true");
    assert.equal(panel.contains(nested), true);
    assert.equal(/\btouch-pan-y\b/.test(nested.className), false);
    await swipe(nested, 40, 160);
    assert.deepEqual(closes, ["close"]);
    root.unmount();
  });

  it("does not treat a vertical scroll as a dismiss", async () => {
    const { root, closes } = mountDrawer({ side: "left" });
    const panel = document.querySelector("[data-testid=drawer-panel]");
    assert.ok(panel);
    await act(async () => {
      pointer(panel, "pointerdown", 80, 20);
      pointer(panel, "pointermove", 70, 140);
      pointer(panel, "pointerup", 70, 140);
    });
    assert.deepEqual(closes, []);
    root.unmount();
  });

  it("does not start a swipe from a textarea (session composer)", async () => {
    const closes: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            contained: true,
            open: true,
            side: "right",
            title: "会话",
            onClose: () => closes.push("close"),
          },
          createElement("textarea", { name: "text", defaultValue: "caret" }),
        ),
      );
    });
    const field = document.querySelector("textarea[name=text]");
    assert.ok(field);
    await swipe(field, 40, 200);
    assert.deepEqual(closes, []);
    root.unmount();
  });

  it("swallows the click after a reverse swipe so a row is not activated", async () => {
    const events: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(
          Drawer,
          {
            contained: true,
            open: true,
            side: "left",
            title: "大纲",
            onClose: () => events.push("close"),
          },
          createElement(
            "button",
            {
              type: "button",
              "data-testid": "outline-row",
              onClick: () => events.push("row"),
            },
            "测量",
          ),
        ),
      );
    });
    const row = document.querySelector("[data-testid=outline-row]");
    assert.ok(row);
    await swipe(row, 160, 40);
    await act(async () => {
      row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    assert.deepEqual(events, ["close"]);
    root.unmount();
  });
});
