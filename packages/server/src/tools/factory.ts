import type { AgentTool } from "@mariozechner/pi-agent-core";
import { FINALIZE_GATE_SENTENCE, type ExportFormat, type OutlineDraftNode } from "@quantum/shared";
import { Type } from "typebox";
import { exportTopic } from "../export/index.js";
import { questionFor } from "../learning/boundary-interview.js";
import {
  evaluateFinalize,
  mergeAnswersIntoRecords,
  snapshotFromRecords,
} from "../learning/boundary-snapshot.js";
import { evaluateOutlineDraft } from "../learning/outline-constraints.js";
import { storedOutlineToDraft, trimOutlineToLeafCap } from "../learning/outline-from-boundaries.js";
import { collectPrereqEdges, ensureDraftPrereqEdges } from "../learning/prereq-edges.js";
import { evaluateAppendNote } from "../learning/note-policy.js";
import { flattenOutline } from "../store/repos.js";
import { addTurnCitation, peekTurnMeta } from "../agent/turn-meta.js";
import { topicHitsScopeOut } from "../learning/scope-out.js";
import type { SessionRuntime } from "../agent/types.js";

function refuseTurnLocked(runtime: SessionRuntime, extraText?: string): boolean {
  const topic = runtime.requireTopic();
  const meta = peekTurnMeta(topic.id);
  if (meta.strategy === "REFUSE_OFFSCOPE") return true;
  const texts = [meta.userText, extraText].filter((t): t is string => Boolean(t?.trim()));
  return texts.some((text) => topicHitsScopeOut(runtime.store, topic.id, text));
}

const Kind = Type.Union([
  Type.Literal("goal"),
  Type.Literal("prior"),
  Type.Literal("time"),
  Type.Literal("depth"),
  Type.Literal("constraint"),
  Type.Literal("success"),
  Type.Literal("goal_outcome"),
  Type.Literal("prior_level"),
  Type.Literal("scope_out"),
  Type.Literal("chunk_budget"),
  Type.Literal("motivation"),
  Type.Literal("success_evidence"),
  Type.Literal("prior_known"),
  Type.Literal("prior_gaps"),
  Type.Literal("scope_in"),
  Type.Literal("time_budget"),
  Type.Literal("modality"),
]);

function textResult(text: string, details: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function createQuantumTools(runtime: SessionRuntime): AgentTool[] {
  const askBoundary: AgentTool = {
    name: "ask_boundary",
    label: "提问边界",
    description:
      "在 boundary_interview 阶段提出下一道边界问题。可同时写入学习者对上一问的回答。不要把密钥放进参数。",
    parameters: Type.Object({
      kind: Kind,
      question: Type.String({ description: "要问学习者的问题" }),
      record_previous: Type.Optional(
        Type.Object({
          kind: Kind,
          answer: Type.String(),
        }),
      ),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      if (topic.phase !== "boundary_interview") {
        throw new Error(`当前阶段是 ${topic.phase}，不能再问边界`);
      }
      const args = params as {
        kind: Parameters<typeof questionFor>[0];
        question: string;
        record_previous?: { kind: Parameters<typeof questionFor>[0]; answer: string };
      };
      const row = runtime.store.askBoundary(
        topic.id,
        args.kind,
        args.question || questionFor(args.kind),
        args.record_previous,
      );
      runtime.emit({ type: "outline_updated", topicId: topic.id });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult(`已记录问题 ${row.kind}：${row.question}`, { kind: row.kind });
    },
  };

  const finalizeBoundary: AgentTool = {
    name: "finalize_boundary",
    label: "锁定边界",
    description:
      `写入 BoundarySnapshot 并进入 outline_draft。${FINALIZE_GATE_SENTENCE} 八维是提问覆盖，不是定稿硬门。缺必填则不改相位。`,
    parameters: Type.Object({
      answers: Type.Array(
        Type.Object({
          kind: Kind,
          question: Type.String(),
          answer: Type.String(),
        }),
      ),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const args = params as {
        answers: Array<{ kind: Parameters<typeof questionFor>[0]; question: string; answer: string }>;
      };
      const merged = mergeAnswersIntoRecords(runtime.store.listBoundaries(topic.id), args.answers);
      // Persist the last dim (load / time) even when the gate rejects, so the chip leaves「在问」.
      runtime.store.upsertBoundaryAnswers(topic.id, merged);
      const check = evaluateFinalize(runtime.store.listBoundaries(topic.id));
      if (!check.ok) {
        return textResult(`还不能定稿，缺少：${check.missing.join(", ")}`, {
          ok: false,
          missing: check.missing,
          unasked: check.unasked,
          snapshot: check.snapshot,
        });
      }
      runtime.store.finalizeBoundaries(topic.id, merged);
      runtime.emit({
        type: "boundary_finalized",
        topic_id: topic.id,
        phase: "outline_draft",
        boundary_snapshot: check.snapshot,
      });
      runtime.emit({
        type: "phase_changed",
        topicId: topic.id,
        phase: "outline_draft",
        exportState: "idle",
      });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult("边界已锁定，进入大纲起草。", { ok: true, snapshot: check.snapshot });
    },
  };

  const draftOutline: AgentTool = {
    name: "draft_outline",
    label: "起草大纲",
    description: "用边界生成或改写大纲树。第一节点必须是定向，叶子带 intent。",
    parameters: Type.Object({
      title: Type.String(),
      nodes: Type.Array(
        Type.Object({
          title: Type.String(),
          intent: Type.String(),
          objective: Type.Optional(Type.String()),
          depends_on: Type.Optional(Type.Array(Type.String())),
          target_chars: Type.Optional(Type.Number()),
          children: Type.Optional(
            Type.Array(
              Type.Object({
                title: Type.String(),
                intent: Type.String(),
                objective: Type.Optional(Type.String()),
                depends_on: Type.Optional(Type.Array(Type.String())),
                target_chars: Type.Optional(Type.Number()),
              }),
            ),
          ),
        }),
      ),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      if (topic.phase !== "outline_draft" && topic.phase !== "learning") {
        throw new Error("只有大纲阶段或学习阶段可以起草大纲");
      }
      const args = params as {
        title: string;
        nodes: OutlineDraftNode[];
      };
      const snapshot = snapshotFromRecords(runtime.store.listBoundaries(topic.id));
      let nodes = ensureDraftPrereqEdges(args.nodes);
      let constraints = evaluateOutlineDraft(nodes, snapshot);
      if (!constraints.ok && constraints.leafCount > constraints.leafCap) {
        nodes = trimOutlineToLeafCap(nodes, constraints.leafCap);
        constraints = evaluateOutlineDraft(nodes, snapshot);
      }
      if (!constraints.ok) {
        return textResult(`大纲未通过约束：${constraints.errors.join("；")}`, {
          ok: false,
          errors: constraints.errors,
          leafCount: constraints.leafCount,
          leafCap: constraints.leafCap,
        });
      }
      const outline = runtime.store.replaceOutline(topic.id, args.title, nodes, "draft");
      runtime.emit({ type: "outline_updated", topicId: topic.id });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult(`已起草大纲「${args.title}」，共 ${args.nodes.length} 个一级节点。`, {
        ok: true,
        leafCount: constraints.leafCount,
        leafCap: constraints.leafCap,
        prereqEdges: collectPrereqEdges(outline).length,
      });
    },
  };

  const finalizeOutline: AgentTool = {
    name: "finalize_outline",
    label: "锁定大纲",
    description: "锁定大纲并进入 learning。之后用 generate_section 投影正文。",
    parameters: Type.Object({
      title: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const draft = runtime.store.getOutline(topic.id);
      if (draft.length === 0) throw new Error("还没有大纲，先 draft_outline");
      const snapshot = snapshotFromRecords(runtime.store.listBoundaries(topic.id));
      const check = evaluateOutlineDraft(storedOutlineToDraft(draft), snapshot);
      if (!check.ok) {
        return textResult(`大纲未通过约束：${check.errors.join("；")}`, {
          ok: false,
          errors: check.errors,
          leafCount: check.leafCount,
          leafCap: check.leafCap,
        });
      }
      const args = params as { title?: string };
      const outline = runtime.store.finalizeOutline(topic.id, args.title);
      runtime.emit({ type: "outline_finalized", topic_id: topic.id, phase: "learning" });
      runtime.emit({
        type: "phase_changed",
        topicId: topic.id,
        phase: "learning",
        exportState: "idle",
      });
      runtime.emit({ type: "outline_updated", topicId: topic.id });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult("大纲已锁定，进入学习。请为第一片叶子 generate_section。", {
        prereqEdges: collectPrereqEdges(outline).length,
      });
    },
  };

  const generateSection: AgentTool = {
    name: "generate_section",
    label: "生成章节",
    description: "把一节正文写入持久化存储，学习页会投影这篇，而不是聊天记录。",
    parameters: Type.Object({
      outline_node_id: Type.String(),
      title: Type.String(),
      body_md: Type.String(),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      if (topic.phase !== "learning") throw new Error("先 finalize_outline 再写正文");
      const args = params as { outline_node_id: string; title: string; body_md: string };
      if (refuseTurnLocked(runtime, `${args.title} ${args.body_md}`)) {
        return textResult("REFUSE_OFFSCOPE：踩了排除区，不生成无关节。", {
          ok: false,
          strategy: "REFUSE_OFFSCOPE",
        });
      }
      const node = flattenOutline(runtime.store.getOutline(topic.id)).find(
        (n) => n.id === args.outline_node_id,
      );
      if (!node) throw new Error(`找不到大纲节点 ${args.outline_node_id}`);
      const cap = node.targetChars > 0 ? node.targetChars : 0;
      const body = cap > 0 && args.body_md.length > cap ? args.body_md.slice(0, cap) : args.body_md;
      runtime.emit({
        type: "section_status",
        topic_id: topic.id,
        section_id: args.outline_node_id,
        status: "generating",
        outline_node_id: args.outline_node_id,
      });
      const section = runtime.store.upsertSection(
        topic.id,
        args.outline_node_id,
        args.title || node.title,
        body,
      );
      addTurnCitation(topic.id, { section_id: section.id });
      runtime.emit({
        type: "section_status",
        topic_id: topic.id,
        section_id: section.id,
        status: "ready",
        outline_node_id: args.outline_node_id,
      });
      runtime.emit({ type: "section_ready", topic_id: topic.id, section_id: section.id });
      runtime.emit({ type: "section_updated", topicId: topic.id, sectionId: section.id });
      return textResult(`已写入章节「${section.title}」。`);
    },
  };

  const getSection: AgentTool = {
    name: "get_section",
    label: "读取章节",
    description: "读取一节已生成的正文。",
    parameters: Type.Object({
      outline_node_id: Type.String(),
    }),
    execute: async (_id, params) => {
      const args = params as { outline_node_id: string };
      const section = runtime.store.getSectionByOutline(args.outline_node_id);
      if (!section) return textResult("这一节还没有正文。");
      addTurnCitation(runtime.requireTopic().id, { section_id: section.id });
      return textResult(`# ${section.title}\n\n${section.bodyMd}`);
    },
  };

  const listOutline: AgentTool = {
    name: "list_outline",
    label: "列出大纲",
    description: "返回当前主题大纲树（含 id，供 generate_section 使用）。",
    parameters: Type.Object({}),
    execute: async () => {
      const topic = runtime.requireTopic();
      const outline = runtime.store.getOutline(topic.id);
      return textResult(JSON.stringify(outline, null, 2), { count: flattenOutline(outline).length });
    },
  };

  const appendNote: AgentTool = {
    name: "append_note",
    label: "追加笔记",
    description:
      "唯一写笔记的途径。学习者没有「记一笔」按钮。reason_code 只能是 1–4（思考/疑问/拓展）。禁止写入密钥。",
    parameters: Type.Object({
      body: Type.String(),
      section_id: Type.Optional(Type.String()),
      reason_code: Type.Union([
        Type.Literal(1),
        Type.Literal(2),
        Type.Literal(3),
        Type.Literal(4),
        Type.Literal("1"),
        Type.Literal("2"),
        Type.Literal("3"),
        Type.Literal("4"),
      ]),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const args = params as {
        body: string;
        section_id?: string;
        reason_code?: unknown;
      };
      if (refuseTurnLocked(runtime, args.body)) {
        return textResult("REFUSE_OFFSCOPE：踩界内容不记笔记。", {
          ok: false,
          strategy: "REFUSE_OFFSCOPE",
        });
      }
      const judged = evaluateAppendNote(args.body, args.reason_code);
      if (!judged.ok || judged.reason_code === 0) {
        return textResult(judged.error ?? "笔记未写入", {
          ok: false,
          reason_code: judged.reason_code,
        });
      }
      const note = runtime.store.appendNote(
        topic.id,
        judged.body,
        args.section_id,
        judged.reason_code,
      );
      if (note.sectionId) {
        addTurnCitation(topic.id, { section_id: note.sectionId, note_id: note.id });
      }
      runtime.emit({
        type: "note_appended",
        note_id: note.id,
        note_type: note.type,
        reason_code: note.reasonCode,
        section_id: note.sectionId ?? undefined,
        topic_id: topic.id,
      });
      return textResult(`已追加笔记 ${note.id}`, {
        ok: true,
        note_id: note.id,
        type: note.type,
        reason_code: note.reasonCode,
        section_id: note.sectionId,
      });
    },
  };

  const summarizeNotes: AgentTool = {
    name: "summarize_notes_for_export",
    label: "汇总笔记",
    description: "压缩当前主题笔记，供导出前言使用。只读。",
    parameters: Type.Object({
      max_chars: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const args = params as { max_chars?: number };
      const notes = runtime.store.listNotes(topic.id);
      if (notes.length === 0) return textResult("还没有笔记。");
      const joined = notes.map((n, i) => `${i + 1}. ${n.body}`).join("\n");
      const max = args.max_chars ?? 2000;
      return textResult(joined.slice(0, max));
    },
  };

  const exportTool: AgentTool = {
    name: "export_topic",
    label: "导出主题",
    description: "导出当前主题为 md | html | epub。由书籍页导出弹窗触发，或在会话里调用。",
    parameters: Type.Object({
      format: Type.Union([Type.Literal("md"), Type.Literal("html"), Type.Literal("epub")]),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const args = params as { format: ExportFormat };
      runtime.store.updateTopic(topic.id, { exportState: "exporting" });
      const result = await exportTopic(runtime.store, topic.id, args.format);
      runtime.store.updateTopic(topic.id, { exportState: "ready" });
      runtime.emit({
        type: "export_ready",
        topicId: topic.id,
        format: result.format,
        filename: result.filename,
        downloadPath: result.downloadPath,
      });
      runtime.emit({
        type: "phase_changed",
        topicId: topic.id,
        phase: runtime.store.requireTopic(topic.id).phase,
        exportState: "ready",
      });
      return textResult(`已导出 ${result.filename}`, { ...result });
    },
  };

  return [
    askBoundary,
    finalizeBoundary,
    draftOutline,
    finalizeOutline,
    generateSection,
    getSection,
    listOutline,
    appendNote,
    summarizeNotes,
    exportTool,
  ];
}
