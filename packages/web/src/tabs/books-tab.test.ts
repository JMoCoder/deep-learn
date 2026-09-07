import "./../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, it, afterEach } from "node:test";
import { BooksTab } from "./BooksTab.tsx";

function mountBooks(onCreate: () => void, onDrawerOpen: (open: boolean) => void): Root {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(BooksTab, {
        topic: null,
        section: null,
        notes: [],
        outline: [],
        boundaries: [],
        topics: [],
        drawerOpen: true,
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
