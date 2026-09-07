import "../test/register-dom.ts";
import assert from "node:assert/strict";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
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
