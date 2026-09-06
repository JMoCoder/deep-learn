import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  citationLabel,
  citationsFromTool,
  citationsFromWire,
  visibleCitations,
} from "./session-display.ts";

describe("session-display citations", () => {
  it("drops empty and placeholder cites", () => {
    assert.deepEqual(visibleCitations([]), []);
    assert.deepEqual(visibleCitations(undefined), []);
    assert.deepEqual(
      visibleCitations([
        { title: "" },
        { title: "当前章节" },
        { title: "当前大纲" },
        { title: "叠加", section_id: "s1" },
      ]),
      [{ title: "叠加", section_id: "s1" }],
    );
  });

  it("does not invent a cite from tool dump text", () => {
    assert.deepEqual(citationsFromTool("get_section", "# 节\n\n很长的正文……"), []);
    assert.deepEqual(citationsFromTool("list_outline", ""), []);
    assert.deepEqual(citationsFromTool("append_note", "已追加"), []);
  });

  it("keeps wire section_id and prefers outline titles", () => {
    const titles = new Map([["sec-1", "测量前后"]]);
    const cites = citationsFromWire([{ section_id: "sec-1" }, { section_id: "" }], titles);
    assert.equal(cites.length, 1);
    assert.equal(cites[0]?.section_id, "sec-1");
    assert.equal(cites[0]?.title, "测量前后");
    assert.equal(citationLabel({ section_id: "sec-1" }, titles), "测量前后");
  });
});
