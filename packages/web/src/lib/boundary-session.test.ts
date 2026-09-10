import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readBoundaryConfirmed,
  readBoundaryFinalized,
  readCachedTopicId,
  readTopicAnchor,
  writeBoundaryConfirmed,
  writeBoundaryFinalized,
  writeCachedTopicId,
  writeTopicAnchor,
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

describe("1.3 topic + finalize cache (not UI truth)", () => {
  it("stores a cold-start hint that adoptServerLearnState can overwrite", () => {
    const session = new MemoryStore();
    const local = new MemoryStore();
    (globalThis as { sessionStorage: Storage }).sessionStorage = session;
    (globalThis as { localStorage: Storage }).localStorage = local;

    writeCachedTopicId("topic-1");
    writeBoundaryFinalized("topic-1", true);
    writeBoundaryConfirmed("topic-1", false);

    assert.equal(readCachedTopicId(), "topic-1");
    assert.equal(readBoundaryFinalized("topic-1"), true);
    assert.equal(readBoundaryConfirmed("topic-1"), false);

    writeCachedTopicId(null);
    assert.equal(readCachedTopicId(), null);

    writeTopicAnchor("topic-1", "测量入门");
    assert.equal(readTopicAnchor("topic-1"), "测量入门");
    assert.equal(readTopicAnchor("topic-2"), null);
  });
});
