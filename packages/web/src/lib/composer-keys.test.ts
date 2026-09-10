import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composerKeyShouldSend } from "./composer-keys.ts";

function key(partial: Partial<Parameters<typeof composerKeyShouldSend>[0]> & { key: string }) {
  return { ctrlKey: false, metaKey: false, isComposing: false, ...partial };
}

describe("composer send keys", () => {
  it("sends only on Ctrl+Enter or Cmd+Enter", () => {
    assert.equal(composerKeyShouldSend(key({ key: "Enter", ctrlKey: true })), true);
    assert.equal(composerKeyShouldSend(key({ key: "Enter", metaKey: true })), true);
    assert.equal(composerKeyShouldSend(key({ key: "Enter", ctrlKey: true, metaKey: true })), true);
  });

  it("treats bare Enter and Shift+Enter as newline (not send)", () => {
    assert.equal(composerKeyShouldSend(key({ key: "Enter" })), false);
    assert.equal(composerKeyShouldSend(key({ key: "Enter", ctrlKey: false, metaKey: false })), false);
    assert.equal(composerKeyShouldSend(key({ key: "Enter", shiftKey: true })), false);
  });

  it("ignores non-Enter keys even with modifiers", () => {
    assert.equal(composerKeyShouldSend(key({ key: "a", ctrlKey: true })), false);
    assert.equal(composerKeyShouldSend(key({ key: "Tab", metaKey: true })), false);
    assert.equal(composerKeyShouldSend(key({ key: "Escape" })), false);
  });

  it("does not send while an IME is composing", () => {
    assert.equal(composerKeyShouldSend(key({ key: "Enter", ctrlKey: true, isComposing: true })), false);
    assert.equal(
      composerKeyShouldSend(
        key({ key: "Enter", metaKey: true, nativeEvent: { isComposing: true } }),
      ),
      false,
    );
  });
});
