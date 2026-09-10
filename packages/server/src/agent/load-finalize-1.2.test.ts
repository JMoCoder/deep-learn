import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createQuantumTools } from "../tools/factory.js";
import { openMemoryDb } from "../store/db.js";
import { Store } from "../store/repos.js";
import { planCoachTurn } from "./coach.js";

const KICKOFF = "学习者刚新建主题。请开始边界访谈。";

const WALK_ANSWERS: Record<string, string> = {
  motivation: "因为工作要用",
  goal: "我能独立画一遍测量",
  success_evidence: "能给同事讲 10 分钟",
  prior: "只会定义",
  prior_gaps: "会：态矢量；不会：投影公设",
  scope_in: "测量公设",
  constraint: "弦论",
  depth: "能讲清",
  time: "每次 20 分钟",
  chunk_budget: "每周 3 小时",
};

function toolsFor(store: Store, topicId: string) {
  return createQuantumTools({
    store,
    topicId,
    requireTopic: () => store.requireTopic(topicId),
    emit: () => undefined,
  });
}

async function exec(tool: AgentTool, args: Record<string, unknown>) {
  return tool.execute("call", args as never);
}

async function walkToLoadAsked(store: Store, topicId: string): Promise<string> {
  const ask = toolsFor(store, topicId).find((t) => t.name === "ask_boundary")!;
  let pending: string | null = null;
  for (let i = 0; i < 16; i += 1) {
    const plan = planCoachTurn(store, topicId, pending ? WALK_ANSWERS[pending] ?? "答" : KICKOFF);
    if (plan.tool?.name === "finalize_boundary") {
      assert.fail("finalized before load dim was asked");
    }
    if (plan.tool?.name !== "ask_boundary") continue;
    const args = plan.tool.args as { kind: string; question: string; record_previous?: { kind: string; answer: string } };
    await exec(ask, args);
    pending = args.kind;
    if (args.kind === "time" || args.kind === "chunk_budget") return args.kind;
  }
  throw new Error("did not reach load dim");
}

describe("1.2 load-dim finalize", () => {
  it("answers time → persist load → finalize_boundary (not another ask)", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("负荷末维");
    const loadKind = await walkToLoadAsked(store, topic.id);
    const timeRow = store.listBoundaries(topic.id).find((b) => b.kind === loadKind);
    assert.equal(timeRow?.status, "asked");
    assert.equal(timeRow?.answer, "");

    const plan = planCoachTurn(store, topic.id, WALK_ANSWERS.time);
    assert.equal(plan.tool?.name, "finalize_boundary");
    const answers = (plan.tool?.args as { answers: Array<{ kind: string; answer: string }> }).answers;
    const load = answers.find((a) => a.kind === "time" || a.kind === "chunk_budget");
    assert.equal(load?.answer, WALK_ANSWERS.time);
    assert.equal(store.listBoundaries(topic.id).find((b) => b.kind === loadKind)?.status, "asked");
    assert.equal(store.listBoundaries(topic.id).find((b) => b.kind === loadKind)?.answer, "");

    const result = await exec(toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!, {
      answers,
    });
    assert.equal(result.details.ok, true);
    assert.equal(store.requireTopic(topic.id).phase, "outline_draft");
    assert.equal(store.listBoundaries(topic.id).find((b) => b.kind === loadKind)?.answer, WALK_ANSWERS.time);
  });

  it("chunk_budget as current kind finalizes, does not re-ask motivation", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("别名负荷");
    for (const [kind, answer] of Object.entries({
      motivation: WALK_ANSWERS.motivation,
      goal: WALK_ANSWERS.goal,
      success_evidence: WALK_ANSWERS.success_evidence,
      prior: WALK_ANSWERS.prior,
      prior_gaps: WALK_ANSWERS.prior_gaps,
      scope_in: WALK_ANSWERS.scope_in,
      constraint: WALK_ANSWERS.constraint,
      depth: WALK_ANSWERS.depth,
    })) {
      store.askBoundary(topic.id, kind as never, `${kind}?`);
      store.recordBoundaryAnswer(topic.id, kind as never, answer);
    }
    store.askBoundary(topic.id, "chunk_budget", "单次能啃多少？");
    const plan = planCoachTurn(store, topic.id, WALK_ANSWERS.chunk_budget);
    assert.equal(plan.tool?.name, "finalize_boundary");
    assert.notEqual((plan.tool?.args as { kind?: string }).kind, "motivation");
    const answers = (plan.tool?.args as { answers: Array<{ kind: string; answer: string }> }).answers;
    assert.equal(answers.find((a) => a.kind === "chunk_budget")?.answer, WALK_ANSWERS.chunk_budget);
  });

  it("rejected finalize still writes the load answer and stays in interview", async () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("缺深度");
    store.askBoundary(topic.id, "goal", "g");
    store.recordBoundaryAnswer(topic.id, "goal", "我能独立画一遍");
    store.askBoundary(topic.id, "prior", "p");
    store.recordBoundaryAnswer(topic.id, "prior", "零基础");
    store.askBoundary(topic.id, "constraint", "c");
    store.recordBoundaryAnswer(topic.id, "constraint", "弦论");
    store.askBoundary(topic.id, "time", "负荷？");

    const result = await exec(toolsFor(store, topic.id).find((t) => t.name === "finalize_boundary")!, {
      answers: [
        { kind: "goal", question: "g", answer: "我能独立画一遍" },
        { kind: "prior", question: "p", answer: "零基础" },
        { kind: "constraint", question: "c", answer: "弦论" },
        { kind: "time", question: "负荷？", answer: "每次 20 分钟" },
      ],
    });
    assert.equal(result.details.ok, false);
    assert.ok((result.details.missing as string[]).includes("depth"));
    assert.equal(store.requireTopic(topic.id).phase, "boundary_interview");
    const time = store.listBoundaries(topic.id).find((b) => b.kind === "time");
    assert.equal(time?.answer, "每次 20 分钟");
    assert.equal(time?.status, "answered");
  });

  it("planAfterTool does not draft outline after a failed finalize", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("失败不跳");
    store.askBoundary(topic.id, "time", "负荷？");
    store.recordBoundaryAnswer(topic.id, "time", "每周 3 小时");
    const after = planCoachTurn(store, topic.id, {
      lastUserText: "每周 3 小时",
      lastRole: "toolResult",
      lastToolName: "finalize_boundary",
    });
    assert.equal(store.requireTopic(topic.id).phase, "boundary_interview");
    assert.notEqual(after.tool?.name, "draft_outline");
    assert.match(after.text, /还不能定稿|还没锁定/);
  });

  it("retries finalize after a rejected gate instead of re-asking motivation", () => {
    const store = new Store(openMemoryDb());
    const topic = store.createTopic("重试锁定");
    for (const [kind, answer] of Object.entries(WALK_ANSWERS)) {
      if (kind === "chunk_budget") continue;
      store.askBoundary(topic.id, kind as never, `${kind}?`);
      store.recordBoundaryAnswer(topic.id, kind as never, answer);
    }
    assert.equal(store.requireTopic(topic.id).phase, "boundary_interview");
    const plan = planCoachTurn(store, topic.id, "再锁一次");
    assert.equal(plan.tool?.name, "finalize_boundary");
    const answers = (plan.tool?.args as { answers: Array<{ kind: string }> }).answers;
    assert.ok(answers.some((a) => a.kind === "time"));
    assert.ok(answers.some((a) => a.kind === "motivation"));
  });
});
