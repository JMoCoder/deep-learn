import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adoptServerLearnState,
  resolveAgainstCache,
} from "./learn-gates.ts";
import {
  overwriteGateCacheFromState,
  readBoundaryConfirmed,
  readBoundaryFinalized,
  readCachedTopicId,
  writeBoundaryConfirmed,
  writeBoundaryFinalized,
  writeCachedTopicId,
} from "./boundary-session.ts";

class MemoryStore implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

describe("confirm/pointer: /api/state always wins", () => {
  it("does not let a stale confirmed cache decide the card", () => {
    const session = new MemoryStore();
    const local = new MemoryStore();
    (globalThis as { sessionStorage: Storage }).sessionStorage = session;
    (globalThis as { localStorage: Storage }).localStorage = local;

    writeCachedTopicId("top_1");
    writeBoundaryConfirmed("top_1", true);
    writeBoundaryFinalized("top_1", true);

    const adopted = adoptServerLearnState({
      currentTopicId: "top_1",
      topic: { phase: "outline_draft" },
      boundaryConfirmed: false,
      boundaryFinalized: true,
    });

    assert.equal(adopted.currentTopicId, "top_1");
    assert.equal(adopted.boundaryConfirmed, false);
    assert.equal(adopted.boundaryFinalized, true);
    assert.equal(readBoundaryConfirmed("top_1"), false);
    assert.equal(readBoundaryFinalized("top_1"), true);
    assert.equal(resolveAgainstCache(false, true), false);
  });

  it("does not invent currentTopicId from localStorage when state is null", () => {
    const session = new MemoryStore();
    const local = new MemoryStore();
    (globalThis as { sessionStorage: Storage }).sessionStorage = session;
    (globalThis as { localStorage: Storage }).localStorage = local;

    writeCachedTopicId("top_stale");
    writeBoundaryConfirmed("top_stale", true);

    const adopted = adoptServerLearnState({
      currentTopicId: null,
      topic: null,
      boundaryConfirmed: false,
      boundaryFinalized: false,
    });

    assert.equal(adopted.currentTopicId, null);
    assert.equal(adopted.boundaryConfirmed, false);
    assert.equal(readCachedTopicId(), null);
    assert.equal(resolveAgainstCache(null, "top_stale"), null);
  });

  it("overwrites the cache after a successful state fetch", () => {
    const session = new MemoryStore();
    const local = new MemoryStore();
    (globalThis as { sessionStorage: Storage }).sessionStorage = session;
    (globalThis as { localStorage: Storage }).localStorage = local;

    overwriteGateCacheFromState({
      currentTopicId: "top_2",
      boundaryConfirmed: true,
      boundaryFinalized: true,
    });
    assert.equal(readCachedTopicId(), "top_2");
    assert.equal(readBoundaryConfirmed("top_2"), true);
    assert.equal(readBoundaryFinalized("top_2"), true);
  });
});
