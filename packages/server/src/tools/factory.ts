import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ExportFormat, OutlineDraftNode } from "@quantum/shared";
import { Type } from "typebox";
import { exportTopic } from "../export/index.js";
import { questionFor } from "../learning/boundary-interview.js";
import {
  evaluateFinalize,
  mergeAnswersIntoRecords,
  snapshotFromRecords,
} from "../learning/boundary-snapshot.js";
import { evaluateOutlineDraft } from "../learning/outline-constraints.js";
import { evaluateAppendNote } from "../learning/note-policy.js";
import { flattenOutline } from "../store/repos.js";
import type { SessionRuntime } from "../agent/types.js";

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
      "写入 BoundarySnapshot 并进入 outline_draft。必填：goal_outcome, prior_level, scope_out, depth, chunk_budget。缺则 ok:false，不改相位。",
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
      const check = evaluateFinalize(merged);
      if (!check.ok) {
        return textResult(`还不能定稿，缺少：${check.missing.join(", ")}`, {
          ok: false,
          missing: check.missing,
          snapshot: check.snapshot,
        });
      }
      runtime.store.finalizeBoundaries(topic.id, merged);
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
      const constraints = evaluateOutlineDraft(args.nodes, snapshot);
      if (!constraints.ok) {
        return textResult(`大纲未通过约束：${constraints.errors.join("；")}`, {
          ok: false,
          errors: constraints.errors,
          leafCount: constraints.leafCount,
          leafCap: constraints.leafCap,
        });
      }
      runtime.store.replaceOutline(topic.id, args.title, args.nodes, "draft");
      runtime.emit({ type: "outline_updated", topicId: topic.id });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult(`已起草大纲「${args.title}」，共 ${args.nodes.length} 个一级节点。`, {
        ok: true,
        leafCount: constraints.leafCount,
        leafCap: constraints.leafCap,
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
      const outline = runtime.store.getOutline(topic.id);
      if (outline.length === 0) throw new Error("还没有大纲，先 draft_outline");
      const args = params as { title?: string };
      runtime.store.finalizeOutline(topic.id, args.title);
      runtime.emit({
        type: "phase_changed",
        topicId: topic.id,
        phase: "learning",
        exportState: "idle",
      });
      runtime.emit({ type: "outline_updated", topicId: topic.id });
      runtime.emit({ type: "topic_updated", topicId: topic.id });
      return textResult("大纲已锁定，进入学习。请为第一片叶子 generate_section。");
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
      const node = flattenOutline(runtime.store.getOutline(topic.id)).find(
        (n) => n.id === args.outline_node_id,
      );
      if (!node) throw new Error(`找不到大纲节点 ${args.outline_node_id}`);
      const cap = node.targetChars > 0 ? node.targetChars : 0;
      const body = cap > 0 && args.body_md.length > cap ? args.body_md.slice(0, cap) : args.body_md;
      const section = runtime.store.upsertSection(
        topic.id,
        args.outline_node_id,
        args.title || node.title,
        body,
      );
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
      "唯一写笔记的途径。学习者没有「记一笔」按钮。记下卡点、对照或值得导出的句子。禁止写入密钥。",
    parameters: Type.Object({
      body: Type.String(),
      section_id: Type.Optional(Type.String()),
      reason_code: Type.Union([
        Type.Literal(1),
        Type.Literal(2),
        Type.Literal(3),
        Type.Literal(4),
        Type.Literal("friction"),
        Type.Literal("contrast"),
        Type.Literal("checkpoint"),
        Type.Literal("transfer"),
        Type.Literal("correction"),
        Type.Literal("export_worthy"),
        Type.Literal("unspecified"),
      ]),
    }),
    execute: async (_id, params) => {
      const topic = runtime.requireTopic();
      const args = params as {
        body: string;
        section_id?: string;
        reason_code?: unknown;
      };
      const judged = evaluateAppendNote(args.body, args.reason_code);
      if (!judged.ok) {
        return textResult(judged.error ?? "笔记未写入", {
          ok: false,
          reason_code: judged.reason_code,
        });
      }
      const note = runtime.store.appendNote(
        topic.id,
        judged.body,
        args.section_id,
        judged.reason_name,
      );
      runtime.emit({ type: "note_appended", topicId: topic.id, noteId: note.id });
      return textResult(`已追加笔记 ${note.id}`, {
        ok: true,
        note_id: note.id,
        reason_code: judged.reason_code,
        reason_name: judged.reason_name,
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
