import type { BoundaryKind } from "@quantum/shared";
import {
  BOUNDARY_SCRIPT,
  nextBoundaryKind,
  questionFor,
} from "../learning/boundary-interview.js";
import { outlineFromBoundaries } from "../learning/outline-from-boundaries.js";
import { scaffoldSectionBody } from "../learning/section-scaffold.js";
import { flattenOutline, type Store } from "../store/repos.js";

export type CoachToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type CoachPlan = {
  text: string;
  tool?: CoachToolCall;
};

export type CoachTurnInput = {
  lastUserText: string;
  lastRole: string;
  lastToolName?: string;
};

/**
 * Local coach for no-key mode. Drives the same tools as a live model.
 * After a tool result, only advance when the next phase step is required —
 * never repeat append_note / ask_boundary against the same user turn.
 */
export function planCoachTurn(store: Store, topicId: string, input: CoachTurnInput | string): CoachPlan {
  const turn = typeof input === "string" ? { lastUserText: input, lastRole: "user" } : input;
  const topic = store.requireTopic(topicId);
  const last = turn.lastUserText.trim();

  if (turn.lastRole === "toolResult") {
    return planAfterTool(store, topicId, turn.lastToolName ?? "", last);
  }

  if (topic.phase === "boundary_interview") {
    return planInterview(store, topicId, last);
  }
  if (topic.phase === "outline_draft") {
    return planOutline(store, topicId, last);
  }
  return planLearning(store, topicId, last);
}

function planAfterTool(store: Store, topicId: string, toolName: string, last: string): CoachPlan {
  const topic = store.requireTopic(topicId);
  if (toolName === "ask_boundary") {
    const asked = [...store.listBoundaries(topicId)].reverse().find((b) => b.status === "asked");
    return { text: asked?.question ?? "请直接回答这一问。" };
  }
  if (toolName === "finalize_boundary" || (topic.phase === "outline_draft" && store.getOutline(topicId).length === 0)) {
    return planOutline(store, topicId, last);
  }
  if (toolName === "draft_outline") {
    return { text: "大纲已起草。要改结构直接说；确认就回复「可以」。" };
  }
  if (toolName === "finalize_outline") {
    return planLearning(store, topicId, "请开始");
  }
  if (toolName === "generate_section") {
    const section = store.getCurrentSectionId();
    const rec = section ? store.getSection(section) : null;
    return { text: rec ? `「${rec.title}」已投影到学习页。卡住就直接说。` : "正文已写入。" };
  }
  if (toolName === "append_note") {
    return { text: "已记下。还可以继续问这一节，或说「下一节」。" };
  }
  if (toolName === "export_topic") {
    return { text: "导出已完成，可从下载链接取回。" };
  }
  return { text: "继续。" };
}

function planInterview(store: Store, topicId: string, last: string): CoachPlan {
  const existing = store.listBoundaries(topicId);
  const askedUnanswered = [...existing].reverse().find((b) => b.status === "asked" && !b.answer.trim());

  if (askedUnanswered && (!last || looksLikeKickoff(last))) {
    return { text: askedUnanswered.question };
  }

  if (askedUnanswered && last && !looksLikeKickoff(last)) {
    const next = nextKindAfter(askedUnanswered.kind);
    if (next) {
      return {
        text: "记下这一答，继续下一问。",
        tool: {
          name: "ask_boundary",
          args: {
            kind: next,
            question: questionFor(next),
            record_previous: { kind: askedUnanswered.kind, answer: last },
          },
        },
      };
    }
    const answers = existing.map((b) => ({
      kind: b.kind,
      question: b.question,
      answer: b.kind === askedUnanswered.kind ? last : b.answer,
    }));
    if (!answers.some((a) => a.kind === askedUnanswered.kind)) {
      answers.push({
        kind: askedUnanswered.kind,
        question: askedUnanswered.question,
        answer: last,
      });
    }
    return {
      text: "目标与先验已经够起草大纲。我先锁定边界。",
      tool: { name: "finalize_boundary", args: { answers } },
    };
  }

  const next = nextBoundaryKind(existing) ?? BOUNDARY_SCRIPT[0]!.kind;
  const q = questionFor(next);
  return {
    text:
      existing.length === 0
        ? "先把学习边界问清楚，再写大纲。一次一问。"
        : "下一问：",
    tool: { name: "ask_boundary", args: { kind: next, question: q } },
  };
}

function planOutline(store: Store, topicId: string, last: string): CoachPlan {
  const outline = store.getOutline(topicId);
  if (outline.length === 0) {
    const drafted = outlineFromBoundaries(store.listBoundaries(topicId));
    return {
      text: "按定向 → 先修 → 核心 → 应用 → 迁移起草。确认后说「可以」我就锁定。",
      tool: { name: "draft_outline", args: drafted },
    };
  }
  if (last && !looksLikeKickoff(last) && /(可以|锁定|定稿|开始学|行|好的|确认)/.test(last)) {
    return {
      text: "锁定大纲，进入学习。",
      tool: { name: "finalize_outline", args: { title: store.requireTopic(topicId).title } },
    };
  }
  return {
    text: "大纲已在左侧。要改结构直接说；若可以，回复「可以」我再 finalize_outline。",
  };
}

function planLearning(store: Store, topicId: string, last: string): CoachPlan {
  const topic = store.requireTopic(topicId);
  const outline = flattenOutline(store.getOutline(topicId));
  const currentId = store.getCurrentSectionId() ?? outline[0]?.id;
  const currentNode = outline.find((n) => n.id === currentId) ?? outline[0];
  const section = currentId ? store.getSectionByOutline(currentId) : null;

  if (/导出|epub|markdown|html/.test(last)) {
    const format = last.includes("html") ? "html" : last.includes("epub") ? "epub" : "md";
    return {
      text: "按你的格式导出当前主题。",
      tool: { name: "export_topic", args: { format } },
    };
  }

  if (!section && currentNode) {
    return {
      text: "先把当前叶子投影到学习页。",
      tool: {
        name: "generate_section",
        args: {
          outline_node_id: currentNode.id,
          title: currentNode.title,
          body_md: scaffoldSectionBody(
            currentNode,
            topic.title,
            store.listBoundaries(topicId),
            outline,
          ),
        },
      },
    };
  }

  if (last && !looksLikeKickoff(last) && !/(可以|锁定|定稿|开始学)/.test(last) && section) {
    return {
      text: "记下这一下，并继续围着当前节。",
      tool: {
        name: "append_note",
        args: {
          section_id: section.id,
          body: last.slice(0, 500),
          reason_code: "friction",
        },
      },
    };
  }

  return {
    text: section
      ? `当前在「${section.title}」。正文在中间画布。直接说卡点或要下一节。`
      : "大纲已锁定。说一声，我就生成第一节。",
  };
}

function nextKindAfter(kind: BoundaryKind): BoundaryKind | null {
  const idx = BOUNDARY_SCRIPT.findIndex((s) => s.kind === kind);
  return BOUNDARY_SCRIPT[idx + 1]?.kind ?? null;
}

function looksLikeKickoff(text: string): boolean {
  return /开始边界|新建主题|继续引导|请开始/.test(text);
}
