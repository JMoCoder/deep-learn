import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { planCoachTurn } from "./coach.js";

describe("coach boundary → outline", () => {
  it("asks motivation first, then goal", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("量子场入门");
    const first = planCoachTurn(store, topic.id, "学习者刚新建主题。请开始边界访谈。");
    assert.equal(first.tool?.name, "ask_boundary");
    assert.equal((first.tool?.args as { kind: string }).kind, "motivation");

    store.askBoundary(topic.id, "motivation", "动机？");
    const wait = planCoachTurn(store, topic.id, "学习者刚新建主题。请开始边界访谈。");
    assert.equal(wait.tool, undefined);

    const next = planCoachTurn(store, topic.id, "工作要用测量");
    assert.equal(next.tool?.name, "ask_boundary");
    assert.equal((next.tool?.args as { kind: string }).kind, "goal");
  });

  it("walks all eight interview dimensions before finalize", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("八维");
    const kinds: string[] = [];
    let pending: { kind: string; question: string } | null = null;
    const answers: Record<string, string> = {
      motivation: "因为工作要用",
      goal: "我能独立画一遍测量",
      success_evidence: "能给同事讲 10 分钟",
      prior: "只会定义",
      prior_gaps: "会：态矢量；不会：投影公设",
      scope_in: "测量公设",
      constraint: "弦论",
      depth: "能讲清",
      time: "每次 20 分钟",
    };
    for (let i = 0; i < 12; i += 1) {
      const plan = planCoachTurn(
        store,
        topic.id,
        pending ? answers[pending.kind] ?? "答" : "学习者刚新建主题。请开始边界访谈。",
      );
      if (plan.tool?.name === "finalize_boundary") {
        const asked = (plan.tool.args as { answers: Array<{ kind: string }> }).answers.map((a) => a.kind);
        assert.ok(asked.includes("motivation"));
        assert.ok(asked.includes("success_evidence"));
        assert.ok(asked.includes("prior_gaps"));
        assert.ok(asked.includes("scope_in"));
        assert.ok(asked.includes("constraint"));
        assert.ok(kinds.includes("motivation"));
        return;
      }
      if (plan.tool?.name === "ask_boundary") {
        const args = plan.tool.args as { kind: string; question: string; record_previous?: { kind: string; answer: string } };
        kinds.push(args.kind);
        store.askBoundary(
          topic.id,
          args.kind as never,
          args.question,
          args.record_previous as never,
        );
        pending = { kind: args.kind, question: args.question };
      }
    }
    assert.fail(`did not finalize after asking ${kinds.join(",")}`);
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

  it("does not repeat append_note after a tool result", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("循环");
    store.finalizeBoundaries(topic.id, [
      { kind: "goal", question: "g", answer: "我能做" },
      { kind: "prior", question: "p", answer: "零基础" },
    ]);
    store.replaceOutline(topic.id, "我能做", [{ title: "定向", intent: "地图" }], "finalized");
    store.finalizeOutline(topic.id);
    const stop = planCoachTurn(store, topic.id, {
      lastUserText: "这里看不懂",
      lastRole: "toolResult",
      lastToolName: "append_note",
    });
    assert.equal(stop.tool, undefined);
  });
});
