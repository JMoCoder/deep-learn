import type { BoundaryKind, TutorStrategy } from "@quantum/shared";
import {
  TOPIC_ANCHOR_QUESTION,
  isDefaultTopicTitle,
  looksLikeLeafRedraft,
  looksLikeOutlineConfirm,
  topicTitleFromUtterance,
} from "@quantum/shared";
import {
  BOUNDARY_SCRIPT,
  isLoadKind,
  nextBoundaryKind,
  questionFor,
} from "../learning/boundary-interview.js";
import { evaluateFinalize, snapshotFromRecords } from "../learning/boundary-snapshot.js";
import { evaluateOutlineDraft } from "../learning/outline-constraints.js";
import { outlineFromBoundaries, storedOutlineToDraft } from "../learning/outline-from-boundaries.js";
import { scaffoldSectionBody } from "../learning/section-scaffold.js";
import { learningRefuseReply, topicHitsScopeOut } from "../learning/scope-out.js";
import { flattenOutline, type Store } from "../store/repos.js";

export type CoachToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type CoachPlan = {
  text: string;
  tool?: CoachToolCall;
  strategy?: TutorStrategy;
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

  if (topic.phase === "learning" && last && topicHitsScopeOut(store, topicId, last)) {
    const outline = flattenOutline(store.getOutline(topicId));
    const currentId = store.getCurrentSectionId() ?? outline[0]?.id;
    const currentNode = outline.find((n) => n.id === currentId) ?? outline[0];
    const section = currentId ? store.getSectionByOutline(currentId) : null;
    return {
      text: learningRefuseReply(store, topicId, section?.title ?? currentNode?.title),
      strategy: "REFUSE_OFFSCOPE",
    };
  }

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
  if (toolName === "finalize_boundary") {
    if (topic.phase !== "outline_draft") {
      const check = evaluateFinalize(store.listBoundaries(topicId));
      return {
        text: check.missing.length
          ? `还不能定稿，缺少：${check.missing.join("、")}。末维已记下，补缺口后再锁定。`
          : "边界还没锁定。末维已记下，缺的维补一句即可。",
      };
    }
    return planOutline(store, topicId, last);
  }
  if (topic.phase === "outline_draft" && store.getOutline(topicId).length === 0 && toolName !== "draft_outline") {
    return planOutline(store, topicId, last);
  }
  if (toolName === "draft_outline") {
    const snapshot = snapshotFromRecords(store.listBoundaries(topicId));
    const stored = store.getOutline(topicId);
    if (stored.length === 0) {
      return {
        text: "这一稿没落盘。说「减叶」或「重拟」我按负荷上限再砍一刀，不要回「可以」。",
      };
    }
    const check = evaluateOutlineDraft(storedOutlineToDraft(stored), snapshot);
    if (!check.ok) {
      const drafted = outlineFromBoundaries(store.listBoundaries(topicId));
      return {
        text: "上一稿超负荷预算。已按上限砍叶重拟，请再看一眼。",
        strategy: "SCAFFOLD",
        tool: { name: "draft_outline", args: drafted },
      };
    }
    return { text: "大纲已起草。要改结构或减叶直接说；确认就回复「可以」。" };
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
  const topicAsk = planTopicAnchor(store, topicId, last);
  if (topicAsk) return topicAsk;

  const existing = store.listBoundaries(topicId);
  const askedUnanswered = [...existing].reverse().find((b) => b.status === "asked" && !b.answer.trim());

  if (askedUnanswered && (!last || looksLikeKickoff(last))) {
    return { text: askedUnanswered.question };
  }

  if (askedUnanswered && last && !looksLikeKickoff(last)) {
    // Persist before finalize so a rejected gate does not leave 负荷 stuck on「在问」.
    store.recordBoundaryAnswer(topicId, askedUnanswered.kind, last);
    const recorded = store.listBoundaries(topicId);
    const next = nextKindAfter(askedUnanswered.kind) ?? nextBoundaryKind(recorded);
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
    return finalizeInterviewPlan(recorded);
  }

  const next = nextBoundaryKind(existing);
  if (!next && existing.length > 0) {
    return finalizeInterviewPlan(existing);
  }

  const kind = next ?? BOUNDARY_SCRIPT[0]!.kind;
  const q = questionFor(kind);
  return {
    text:
      existing.length === 0
        ? "先把学习边界问清楚，再写大纲。一次一问。"
        : "下一问：",
    tool: { name: "ask_boundary", args: { kind, question: q } },
  };
}

/** Untitled new topics lock a title first. Never skip from name+difficulty to an outline. */
function planTopicAnchor(store: Store, topicId: string, last: string): CoachPlan | null {
  const topic = store.requireTopic(topicId);
  if (!isDefaultTopicTitle(topic.title)) return null;
  if (store.listBoundaries(topicId).length > 0) return null;
  if (!last || looksLikeKickoff(last)) {
    return { text: TOPIC_ANCHOR_QUESTION };
  }
  const title = topicTitleFromUtterance(last);
  if (title) store.updateTopic(topicId, { title });
  const locked = store.requireTopic(topicId).title;
  return {
    text: `好，就学「${locked}」。先把学习边界问清楚，再写大纲。一次一问。不会只凭主题名和难度出大纲。`,
    tool: {
      name: "ask_boundary",
      args: { kind: "motivation", question: questionFor("motivation") },
    },
  };
}

function finalizeInterviewPlan(
  rows: Array<{ kind: string; question: string; answer: string }>,
): CoachPlan {
  return {
    text: "八维已经问过。我先锁定边界，你再确认边界卡。",
    tool: {
      name: "finalize_boundary",
      args: {
        answers: rows.map((b) => ({
          kind: b.kind,
          question: b.question,
          answer: b.answer,
        })),
      },
    },
  };
}

function planOutline(store: Store, topicId: string, last: string): CoachPlan {
  const boundaries = store.listBoundaries(topicId);
  const drafted = outlineFromBoundaries(boundaries);
  const snapshot = snapshotFromRecords(boundaries);
  const stored = store.getOutline(topicId);
  const check =
    stored.length > 0
      ? evaluateOutlineDraft(storedOutlineToDraft(stored), snapshot)
      : { ok: false, errors: ["还没有落盘大纲"], leafCount: 0, leafCap: 0 };

  if (stored.length === 0 || !check.ok || looksLikeLeafRedraft(last)) {
    return {
      text: check.ok
        ? "按负荷预算砍叶重拟。"
        : stored.length === 0
          ? "按定向 → 先修 → 核心 → 应用 → 迁移起草。确认后说「可以」我就锁定。"
          : "超负荷预算，正在按上限砍叶重拟。",
      strategy: "SCAFFOLD",
      tool: { name: "draft_outline", args: drafted },
    };
  }

  if (last && !looksLikeKickoff(last) && looksLikeOutlineConfirm(last)) {
    return {
      text: "锁定大纲，进入学习。",
      tool: { name: "finalize_outline", args: { title: store.requireTopic(topicId).title } },
    };
  }
  return {
    text: "大纲已在左侧。超负荷就说「减叶」或「重拟」；约束通过后再回复「可以」。",
  };
}

function planLearning(store: Store, topicId: string, last: string): CoachPlan {
  const topic = store.requireTopic(topicId);
  const outline = flattenOutline(store.getOutline(topicId));
  const currentId = store.getCurrentSectionId() ?? outline[0]?.id;
  const currentNode = outline.find((n) => n.id === currentId) ?? outline[0];
  const section = currentId ? store.getSectionByOutline(currentId) : null;

  if (last && !looksLikeKickoff(last) && topicHitsScopeOut(store, topicId, last)) {
    return {
      text: learningRefuseReply(store, topicId, section?.title ?? currentNode?.title),
      strategy: "REFUSE_OFFSCOPE",
    };
  }

  if (/导出|epub|markdown|html/.test(last)) {
    const format = last.includes("html") ? "html" : last.includes("epub") ? "epub" : "md";
    return {
      text: "按你的格式导出当前主题。",
      tool: { name: "export_topic", args: { format } },
    };
  }

  if (last && !looksLikeKickoff(last) && looksLikeAdvance(last)) {
    const next = nextUnprojectedLeaf(store, outline, currentNode?.id) ?? nextLeaf(outline, currentNode?.id);
    if (next) {
      return {
        text: `推进到「${next.title}」。`,
        strategy: "ADVANCE",
        tool: {
          name: "generate_section",
          args: {
            outline_node_id: next.id,
            title: next.title,
            body_md: scaffoldSectionBody(
              next,
              topic.title,
              store.listBoundaries(topicId),
              outline,
            ),
          },
        },
      };
    }
  }

  if (section && last && looksLikeGroundAsk(last)) {
    return {
      text: "对着落盘正文讲这一节。",
      strategy: "GROUND",
      tool: {
        name: "get_section",
        args: { outline_node_id: section.outlineNodeId },
      },
    };
  }

  if (!section && currentNode) {
    return {
      text: "先把当前叶子投影到学习页。",
      strategy: "SCAFFOLD",
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

  if (last && !looksLikeKickoff(last) && !looksLikeOutlineConfirm(last) && section) {
    if (topicHitsScopeOut(store, topicId, last)) {
      return {
        text: learningRefuseReply(store, topicId, section.title),
        strategy: "REFUSE_OFFSCOPE",
      };
    }
    return {
      text: "记下这一下，并继续围着当前节。",
      tool: {
        name: "append_note",
        args: {
          section_id: section.id,
          body: last.slice(0, 500),
          reason_code: 2,
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
  if (isLoadKind(kind)) return null;
  const idx = BOUNDARY_SCRIPT.findIndex((s) => s.kind === kind);
  if (idx < 0) return null;
  return BOUNDARY_SCRIPT[idx + 1]?.kind ?? null;
}

function looksLikeKickoff(text: string): boolean {
  return /开始边界|新建主题|继续引导|请开始/.test(text);
}

function looksLikeAdvance(text: string): boolean {
  return /下一节|下一块|下一叶|推进|继续下一/.test(text);
}

function looksLikeGroundAsk(text: string): boolean {
  return /这段|这一节|讲什么|什么意思|解释|复述|读盘|正文/.test(text);
}

function nextLeaf(
  outline: ReturnType<typeof flattenOutline>,
  currentId?: string,
): (typeof outline)[number] | undefined {
  if (!currentId) return outline.find((n) => n.children.length === 0);
  const leaves = outline.filter((n) => n.children.length === 0);
  const idx = leaves.findIndex((n) => n.id === currentId);
  return leaves[idx + 1] ?? leaves[idx];
}

function nextUnprojectedLeaf(
  store: Store,
  outline: ReturnType<typeof flattenOutline>,
  currentId?: string,
) {
  const leaves = outline.filter((n) => n.children.length === 0);
  const start = Math.max(0, leaves.findIndex((n) => n.id === currentId));
  return leaves.slice(start + 1).find((n) => !store.getSectionByOutline(n.id))
    ?? leaves.find((n) => !store.getSectionByOutline(n.id));
}
