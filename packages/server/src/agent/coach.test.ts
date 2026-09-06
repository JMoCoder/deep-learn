import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { planCoachTurn } from "./coach.js";

describe("coach boundary → outline", () => {
  it("asks goal first, waits, then records prior", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("量子场入门");
    const first = planCoachTurn(store, topic.id, "学习者刚新建主题。请开始边界访谈。");
    assert.equal(first.tool?.name, "ask_boundary");
    assert.equal((first.tool?.args as { kind: string }).kind, "goal");

    store.askBoundary(topic.id, "goal", "目标？");
    const wait = planCoachTurn(store, topic.id, "学习者刚新建主题。请开始边界访谈。");
    assert.equal(wait.tool, undefined);

    const next = planCoachTurn(store, topic.id, "我能给同事讲清自旋与测量");
    assert.equal(next.tool?.name, "ask_boundary");
    assert.equal((next.tool?.args as { kind: string }).kind, "prior");
  });

  it("drafts then finalizes outline after confirmation", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("主题");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "g", answer: "我能独立推一遍" },
      { kind: "prior", question: "p", answer: "只会定义" },
      { kind: "time", question: "t", answer: "每周 3 小时" },
    ]);
    const draft = planCoachTurn(store, topic.id, "边界已齐");
    assert.equal(draft.tool?.name, "draft_outline");
    const args = draft.tool?.args as { title: string; nodes: unknown[] };
    store.replaceOutline(topic.id, args.title, args.nodes as never, "draft");
    const lock = planCoachTurn(store, topic.id, "可以");
    assert.equal(lock.tool?.name, "finalize_outline");
  });
});
