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
});
