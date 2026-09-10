import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, afterEach } from "node:test";
import { emptyBoundarySnapshot } from "@quantum/shared";
import { SessionPane } from "./SessionPane.tsx";

describe("session pane hides internal strategy", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not paint PROBE/strategy chips on entry or on assistant turns", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(SessionPane, {
          messages: [
            {
              id: "a1",
              role: "assistant",
              text: "先说你想学什么。",
              strategy: "PROBE",
              createdAt: 1,
            },
          ],
          liveRows: [
            {
              id: "tutor-meta",
              kind: "tool",
              title: "PROBE",
              summary: "",
              status: "done",
              strategy: "PROBE",
              createdAt: 2,
            },
          ],
          streaming: "",
          busy: false,
          coachMode: "stub",
          error: null,
          onSend: () => {},
          phase: "boundary_interview",
          snapshot: emptyBoundarySnapshot(),
          askedKinds: [],
          pendingBoundary: false,
          pendingOutline: false,
        }),
      );
    });

    assert.equal(document.querySelector('[data-testid="strategy-chip"]'), null);
    assert.equal((host.textContent ?? "").includes("PROBE"), false);
    assert.equal((host.textContent ?? "").includes("策略"), false);
    assert.match(host.textContent ?? "", /先说你想学什么/);
    root.unmount();
  });

  it("shows the topic-anchor prompt and hides 8-dim chips until the title is locked", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(SessionPane, {
          messages: [
            {
              id: "k1",
              role: "user",
              text: "学习者刚新建主题。请开始边界访谈。",
              createdAt: 1,
            },
            {
              id: "a1",
              role: "assistant",
              text: "你为什么现在要学这个？",
              strategy: "PROBE",
              createdAt: 2,
            },
          ],
          liveRows: [],
          streaming: "",
          busy: false,
          coachMode: "stub",
          error: null,
          onSend: () => {},
          phase: "boundary_interview",
          snapshot: emptyBoundarySnapshot(),
          askedKinds: [],
          pendingBoundary: false,
          pendingOutline: false,
          awaitingTopicAnchor: true,
        }),
      );
    });

    assert.ok(document.querySelector('[data-testid="topic-anchor-prompt"]'));
    assert.match(host.textContent ?? "", /想学哪个主题|What do you want to learn/);
    assert.equal(document.querySelector("[data-dim]"), null);
    assert.equal(document.querySelector('[data-testid="strategy-chip"]'), null);
    assert.equal((host.textContent ?? "").includes("PROBE"), false);
    assert.equal((host.textContent ?? "").includes("你为什么现在要学这个"), false);
    root.unmount();
  });
});

function paneProps(
  overrides: Partial<ComponentProps<typeof SessionPane>> = {},
): ComponentProps<typeof SessionPane> {
  return {
    messages: [],
    liveRows: [],
    streaming: "",
    busy: false,
    coachMode: "stub",
    error: null,
    onSend: () => {},
    phase: "learning",
    snapshot: emptyBoundarySnapshot(),
    askedKinds: [],
    pendingBoundary: false,
    pendingOutline: false,
    ...overrides,
  };
}

async function renderPane(overrides: Partial<ComponentProps<typeof SessionPane>> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(SessionPane, paneProps(overrides)));
  });
  return { host, root };
}

function dispatchComposerKey(
  box: HTMLTextAreaElement,
  init: { ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean },
) {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
    ctrlKey: Boolean(init.ctrlKey),
    metaKey: Boolean(init.metaKey),
  });
  if (init.isComposing) {
    Object.defineProperty(event, "isComposing", { value: true });
  }
  box.dispatchEvent(event);
  return event;
}

describe("session composer send path", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("Enter alone does not send; Ctrl+Enter and Cmd+Enter share the button path", async () => {
    const sent: string[] = [];
    const { host, root } = await renderPane({
      onSend: (text: string) => sent.push(text),
    });
    const box = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    const send = host.querySelector<HTMLButtonElement>('[data-testid="session-send"]');
    assert.ok(box);
    assert.ok(send);

    box.value = "hello from enter";
    await act(async () => {
      dispatchComposerKey(box, {});
    });
    assert.deepEqual(sent, []);
    assert.equal(box.value, "hello from enter");
    assert.equal(host.querySelector('[data-testid="session-pending-user"]'), null);

    await act(async () => {
      dispatchComposerKey(box, { ctrlKey: true });
    });
    assert.deepEqual(sent, ["hello from enter"]);
    assert.equal(box.value, "");
    const pendingAfterCtrl = [...host.querySelectorAll('[data-testid="session-pending-user"]')];
    assert.equal(pendingAfterCtrl.length, 1);
    assert.match(pendingAfterCtrl[0]?.textContent ?? "", /hello from enter/);

    box.value = "hello from cmd";
    await act(async () => {
      dispatchComposerKey(box, { metaKey: true });
    });
    assert.deepEqual(sent, ["hello from enter", "hello from cmd"]);
    const pendingAfterCmd = [...host.querySelectorAll('[data-testid="session-pending-user"]')];
    assert.equal(pendingAfterCmd.length, 2);
    assert.match(pendingAfterCmd.at(-1)?.textContent ?? "", /hello from cmd/);

    box.value = "hello from button";
    await act(async () => {
      send.click();
    });
    assert.deepEqual(sent, ["hello from enter", "hello from cmd", "hello from button"]);
    const pendingAfterButton = [...host.querySelectorAll('[data-testid="session-pending-user"]')];
    assert.equal(pendingAfterButton.length, 3);
    assert.match(pendingAfterButton.at(-1)?.textContent ?? "", /hello from button/);
    root.unmount();
  });

  it("paints the user bubble before session_end refresh (optimistic)", async () => {
    const sent: string[] = [];
    const { host, root } = await renderPane({
      coachMode: "live",
      messages: [],
      onSend: (text: string) => sent.push(text),
    });
    const box = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    const send = host.querySelector<HTMLButtonElement>('[data-testid="session-send"]');
    assert.ok(box);
    assert.ok(send);
    box.value = "do not wait for session_end";
    await act(async () => {
      send.click();
    });
    assert.deepEqual(sent, ["do not wait for session_end"]);
    assert.match(
      host.querySelector('[data-testid="session-pending-user"]')?.textContent ?? "",
      /do not wait for session_end/,
    );

    await act(async () => {
      root.render(
        createElement(
          SessionPane,
          paneProps({
            coachMode: "live",
            messages: [],
            onSend: (text: string) => sent.push(text),
          }),
        ),
      );
    });
    assert.equal(host.querySelectorAll('[data-testid="session-pending-user"]').length, 1);
    assert.match(
      host.querySelector('[data-testid="session-pending-user"]')?.textContent ?? "",
      /do not wait for session_end/,
    );
    root.unmount();
  });

  it("live composer uses the same send path and shows a user bubble immediately", async () => {
    const sent: string[] = [];
    const { host, root } = await renderPane({
      coachMode: "live",
      onSend: (text: string) => sent.push(text),
    });
    const box = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    assert.ok(box);
    box.value = "live ping";
    await act(async () => {
      dispatchComposerKey(box, { ctrlKey: true });
    });
    assert.deepEqual(sent, ["live ping"]);
    assert.match(host.textContent ?? "", /已连接模型代理|Model proxy connected/);
    assert.match(host.querySelector('[data-testid="session-pending-user"]')?.textContent ?? "", /live ping/);
    root.unmount();
  });

  it("shows a pending bubble again when the same text is sent after echo", async () => {
    const sent: string[] = [];
    const { host, root } = await renderPane({
      onSend: (text: string) => sent.push(text),
    });
    const box = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    assert.ok(box);
    box.value = "下一节";
    await act(async () => {
      dispatchComposerKey(box, { ctrlKey: true });
    });
    assert.equal(host.querySelectorAll('[data-testid="session-pending-user"]').length, 1);

    await act(async () => {
      root.render(
        createElement(
          SessionPane,
          paneProps({
            messages: [{ id: "u1", role: "user", text: "下一节", createdAt: 1 }],
            onSend: (text: string) => sent.push(text),
          }),
        ),
      );
    });
    assert.equal(host.querySelector('[data-testid="session-pending-user"]'), null);
    assert.match(host.textContent ?? "", /下一节/);

    const boxAfter = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    assert.ok(boxAfter);
    boxAfter.value = "下一节";
    await act(async () => {
      dispatchComposerKey(boxAfter, { ctrlKey: true });
    });
    assert.deepEqual(sent, ["下一节", "下一节"]);
    assert.equal(host.querySelectorAll('[data-testid="session-pending-user"]').length, 1);
    root.unmount();
  });

  it("does not send while IME is composing", async () => {
    const sent: string[] = [];
    const { host, root } = await renderPane({
      onSend: (text: string) => sent.push(text),
    });
    const box = host.querySelector<HTMLTextAreaElement>('[data-testid="session-composer"]');
    assert.ok(box);
    box.value = "组成中";
    await act(async () => {
      dispatchComposerKey(box, { ctrlKey: true, isComposing: true });
    });
    assert.deepEqual(sent, []);
    assert.equal(box.value, "组成中");
    root.unmount();
  });
});
