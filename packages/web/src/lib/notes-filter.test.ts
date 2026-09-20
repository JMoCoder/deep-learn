import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NoteRecord } from "@quantum/shared";
import { filterNotes } from "./notes-filter.ts";

const notes: NoteRecord[] = [
  {
    id: "a",
    topicId: "t",
    sectionId: "s1",
    body: "一",
    reasonCode: 1,
    type: "思考",
    kind: "formal",
    createdAt: 1,
  },
  {
    id: "b",
    topicId: "t",
    sectionId: "s2",
    body: "二",
    reasonCode: 1,
    type: "思考",
    kind: "highlight",
    createdAt: 2,
  },
  {
    id: "c",
    topicId: "t",
    sectionId: null,
    body: "三",
    reasonCode: 1,
    type: "思考",
    kind: "thinking",
    createdAt: 3,
  },
];

describe("filterNotes", () => {
  it("scopes to section or whole book", () => {
    assert.deepEqual(
      filterNotes(notes, { scope: "section", kind: "all", sectionId: "s1" }).map((n) => n.id),
      ["a"],
    );
    assert.deepEqual(
      filterNotes(notes, { scope: "book", kind: "all", sectionId: "s1" }).map((n) => n.id),
      ["a", "b", "c"],
    );
  });

  it("filters by kind", () => {
    assert.deepEqual(
      filterNotes(notes, { scope: "book", kind: "highlight", sectionId: null }).map((n) => n.id),
      ["b"],
    );
  });
});
