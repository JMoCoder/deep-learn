import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionMessage } from "@quantum/shared";
import {
  booksNoteMetaLine,
  citationLabel,
  citationsFromTool,
  citationsFromWire,
  decorateAssistantMessage,
  lastStrategy,
  strategyChipView,
  strategyLabel,
  uiNoteType,
  visibleCitations,
  visibleLiveRows,
  type LiveSessionRow,
} from "./session-display.ts";

function assistant(partial: Partial<SessionMessage> & { text: string }): SessionMessage {
  return {
    id: partial.id ?? "a1",
    role: "assistant",
    createdAt: 1,
    ...partial,
  };
}

function user(text: string): SessionMessage {
  return { id: "u1", role: "user", text, createdAt: 1 };
}

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

describe("2.7 refuse chip never paints GROUND", () => {
  it("REFUSE_OFFSCOPE signal wins over get_section GROUND inference", () => {
    const messages = [
      user("顺便把弦论也讲一遍"),
      assistant({
        text: "这个问题落在排除区（弦论），这次不展开。",
        strategy: "REFUSE_OFFSCOPE",
      }),
    ];
    const liveRows: LiveSessionRow[] = [
      {
        id: "tutor-meta",
        kind: "tool",
        toolName: "get_section",
        title: "GROUND",
        summary: "",
        status: "done",
        strategy: "GROUND",
        createdAt: 2,
      },
    ];
    const strategy = lastStrategy(messages, liveRows);
    assert.equal(strategy, "REFUSE_OFFSCOPE");
    const chip = strategyChipView(strategy);
    assert.equal(chip.strategy, "REFUSE_OFFSCOPE");
    assert.equal(chip.code, "REFUSE");
    assert.equal(chip.label, "拒");
    assert.equal(chip.code.includes("GROUND"), false);
    assert.equal(chip.label.includes("落地"), false);
    assert.equal(strategyLabel(strategy).includes("落地"), false);
  });

  it("compat 排除区 copy without strategy is still refuse, not GROUND", () => {
    const messages = [
      user("顺便把弦论也讲一遍"),
      assistant({ text: "这个问题落在排除区（弦论），这次不展开。" }),
      {
        id: "t1",
        role: "tool" as const,
        toolName: "get_section",
        text: "# 节",
        createdAt: 2,
      },
    ];
    const strategy = lastStrategy(messages, []);
    assert.equal(strategy, "REFUSE_OFFSCOPE");
    const chip = strategyChipView("GROUND", { text: messages[1]!.text });
    assert.equal(chip.code, "REFUSE");
    assert.notEqual(chip.code, "GROUND");
    assert.notEqual(chip.label, "落地");
  });

  it("decorateAssistantMessage strips cites and refuses GROUND overlay", () => {
    const painted = decorateAssistantMessage(
      assistant({
        text: "这个问题落在排除区（弦论），这次不展开。",
        strategy: "GROUND",
        citations: [{ section_id: "s1" }],
      }),
      { strategy: "GROUND", citations: [{ section_id: "s1" }] },
    );
    assert.equal(painted.strategy, "REFUSE_OFFSCOPE");
    assert.deepEqual(painted.citations, []);
    const chip = strategyChipView(painted.strategy ?? "HOLD", { text: painted.text });
    assert.equal(chip.label, "拒");
    assert.match(JSON.stringify(chip), /REFUSE|拒/);
    assert.equal(JSON.stringify(chip).includes("GROUND"), false);
    assert.equal(JSON.stringify(chip).includes("落地"), false);
  });

  it("hides cite/note live rows on a refuse turn", () => {
    const messages = [
      user("顺便把弦论也讲一遍"),
      assistant({ text: "REFUSE_OFFSCOPE：弦论不讲", strategy: "REFUSE_OFFSCOPE" }),
    ];
    const rows: LiveSessionRow[] = [
      {
        id: "tutor-refuse",
        kind: "refuse",
        title: "拒",
        summary: "弦论不讲",
        status: "done",
        strategy: "REFUSE_OFFSCOPE",
        createdAt: 1,
      },
      {
        id: "tutor-cites",
        kind: "cite",
        title: "引用",
        summary: "第一节",
        status: "done",
        citations: [{ title: "第一节", section_id: "s1" }],
        createdAt: 2,
      },
      {
        id: "note-1",
        kind: "note",
        toolName: "append_note",
        title: "思考",
        summary: "记下这一节",
        status: "done",
        createdAt: 3,
      },
    ];
    const visible = visibleLiveRows(messages, rows);
    assert.equal(visible.some((r) => r.kind === "cite"), false);
    assert.equal(visible.some((r) => r.kind === "note"), false);
    assert.equal(visible.some((r) => r.kind === "refuse"), true);
  });
});

describe("books note meta (reason_code copy)", () => {
  it("maps 1→思考, 2/4→疑问, 3→拓展 and never prints a bare digit", () => {
    const cases = [
      [1, "思考"],
      [2, "疑问"],
      [3, "拓展"],
      [4, "疑问"],
    ] as const;
    for (const [code, label] of cases) {
      assert.equal(uiNoteType(code), label);
      const line = booksNoteMetaLine(code, undefined, "9/10 15:44");
      assert.equal(line, `${label} · 9/10 15:44`);
      assert.equal(/(^| · )[1-4]( · |$)/.test(line), false);
    }
  });
});
