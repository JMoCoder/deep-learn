import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutlineNode } from "@quantum/shared";
import {
  edgesFromOutline,
  mergePrereqEdges,
  resolveDependsOnTitles,
  sectionHasProjectedBody,
} from "./prereq-display.ts";

function node(partial: Partial<OutlineNode> & { id: string; title: string }): OutlineNode {
  return {
    topicId: "t",
    parentId: null,
    intent: "",
    objective: "",
    dependsOn: [],
    targetChars: 0,
    sortOrder: 0,
    status: "draft",
    children: [],
    ...partial,
  };
}

describe("prereq-display", () => {
  it("builds readable edges from dependsOn ids", () => {
    const a = node({ id: "a", title: "定向" });
    const b = node({ id: "b", title: "先修", dependsOn: ["a"] });
    const edges = edgesFromOutline([a, b]);
    assert.equal(edges.length, 1);
    assert.equal(edges[0]?.from_title, "定向");
    assert.equal(edges[0]?.to_title, "先修");
  });

  it("prefers API prereq_edges when present", () => {
    const nodes = [node({ id: "a", title: "A" })];
    const api = [
      { from_id: "a", to_id: "b", from_title: "A", to_title: "B" },
    ];
    assert.deepEqual(mergePrereqEdges(api, nodes), api);
    assert.equal(mergePrereqEdges([], nodes).length, 0);
  });

  it("resolves dependsOn ids to titles and only treats ready/body as projected", () => {
    const titles = new Map([
      ["a", "定向"],
      ["b", "主干"],
    ]);
    assert.deepEqual(resolveDependsOnTitles(["a", "missing"], titles), ["定向", "missing"]);
    const ready = node({ id: "s1", title: "节", status: "ready" });
    assert.equal(sectionHasProjectedBody("s1", null, [ready]), true);
    assert.equal(
      sectionHasProjectedBody("s1", { id: "s1", outlineNodeId: "s1", bodyMd: "正文" }, []),
      true,
    );
    assert.equal(
      sectionHasProjectedBody("s1", { id: "s1", outlineNodeId: "s1", bodyMd: "   " }, []),
      false,
    );
  });
});
