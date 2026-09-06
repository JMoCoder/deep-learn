import {
  isRefuseOffscopeSignal,
  noteTypeFromReason,
  parseNoteReasonCode,
  type NoteType,
  type OutlineNode,
  type SessionMessage,
  type TutorStrategy,
} from "@quantum/shared";

export type LiveSessionRow = {
  id: string;
  kind: "tool" | "cite" | "note" | "refuse";
  toolName?: string;
  title: string;
  summary: string;
  status: "running" | "done" | "error";
  strategy?: TutorStrategy;
  citations?: Citation[];
  createdAt: number;
};

export type Citation = {
  title: string;
  url?: string;
};

const CITE_TOOLS = new Set(["generate_section", "get_section", "list_outline"]);

const TOOL_LABEL: Record<string, string> = {
  ask_boundary: "访谈边界",
  finalize_boundary: "锁定边界",
  draft_outline: "起草大纲",
  finalize_outline: "锁定大纲",
  generate_section: "生成章节",
  get_section: "读取章节",
  list_outline: "列出大纲",
  append_note: "写入笔记",
  summarize_notes_for_export: "整理笔记",
  export_topic: "导出主题",
};

const STRATEGY_LABEL: Record<TutorStrategy, string> = {
  PROBE: "探问",
  SCAFFOLD: "搭架",
  GROUND: "落地",
  ELABORATE: "展开",
  CONTRAST: "对照",
  CHECK: "核对",
  REDIRECT: "转向",
  HOLD: "等待",
  ADVANCE: "推进",
  NOTEWORTHY: "值得记下",
  REFUSE_OFFSCOPE: "拒+回流",
};

export function toolLabel(name?: string): string {
  if (!name) return "工具";
  return TOOL_LABEL[name] ?? name;
}

export function strategyLabel(strategy: TutorStrategy): string {
  return STRATEGY_LABEL[strategy];
}

export function isCiteTool(name?: string): boolean {
  return Boolean(name && CITE_TOOLS.has(name));
}

export function strategyFromTool(toolName?: string): TutorStrategy | null {
  switch (toolName) {
    case "ask_boundary":
      return "PROBE";
    case "finalize_boundary":
    case "draft_outline":
    case "finalize_outline":
      return "SCAFFOLD";
    case "generate_section":
    case "get_section":
    case "list_outline":
      return "GROUND";
    case "append_note":
      return "CHECK";
    case "summarize_notes_for_export":
    case "export_topic":
      return "HOLD";
    default:
      return null;
  }
}

export function uiNoteType(reason: unknown, fallback?: string): NoteType {
  const code = parseNoteReasonCode(reason);
  if (code) return noteTypeFromReason(code);
  if (fallback === "思考" || fallback === "疑问" || fallback === "拓展") return fallback;
  return "思考";
}

export function citationLabel(cite: { section_id: string; note_id?: string }): string {
  return cite.note_id ? `章节 ${cite.section_id} · 笔记 ${cite.note_id}` : `章节 ${cite.section_id}`;
}

export function lastStrategy(
  messages: SessionMessage[],
  liveRows: LiveSessionRow[],
): TutorStrategy {
  for (let i = liveRows.length - 1; i >= 0; i -= 1) {
    const row = liveRows[i];
    if (row?.strategy) return row.strategy;
    const next = strategyFromTool(row?.toolName);
    if (next) return next;
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.strategy) return m.strategy;
    if (m?.role === "tool") {
      const next = strategyFromTool(m.toolName);
      if (next) return next;
    }
  }
  return "HOLD";
}

export function citationsFromTool(toolName: string, summary: string): Citation[] {
  if (!isCiteTool(toolName)) return [];
  const urls = summary.match(/https?:\/\/[^\s)]+/g) ?? [];
  if (urls.length) {
    return [...new Set(urls)].map((url) => ({ title: url, url }));
  }
  const trimmed = summary.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      sources?: Array<{ title?: string; url?: string }>;
      citations?: Array<{ title?: string; url?: string }>;
    };
    const list = parsed.sources ?? parsed.citations ?? [];
    if (list.length) {
      return list.map((item) => ({
        title: item.title || item.url || "来源",
        url: item.url,
      }));
    }
  } catch {
    /* not json */
  }
  if (trimmed) return [{ title: trimmed.slice(0, 140) }];
  return [{ title: toolName === "list_outline" ? "当前大纲" : "当前章节" }];
}

export function countOutlineLeaves(nodes: OutlineNode[]): { ready: number; total: number } {
  let ready = 0;
  let total = 0;
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      if (node.children.length === 0) {
        total += 1;
        if (node.status === "ready") ready += 1;
      } else {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return { ready, total };
}

export function visibleLiveRows(
  messages: SessionMessage[],
  liveRows: LiveSessionRow[],
): LiveSessionRow[] {
  const persisted = new Set(
    messages
      .filter((m) => m.role === "tool")
      .map((m) => `${m.toolName ?? ""}:${m.text.slice(0, 80)}`),
  );
  return liveRows.filter((row) => {
    if (row.kind === "refuse") return true;
    if (row.status === "running") return true;
    if (row.kind === "tool") {
      return !persisted.has(`${row.toolName ?? ""}:${row.summary.slice(0, 80)}`);
    }
    if (row.kind === "cite" || row.kind === "note") {
      return !messages.some(
        (m) => m.role === "tool" && m.toolName === row.toolName && row.status === "done",
      );
    }
    return true;
  });
}

export function messageIsRefuse(message: Pick<SessionMessage, "strategy" | "text" | "toolName">): boolean {
  return isRefuseOffscopeSignal({
    strategy: message.strategy,
    text: message.text,
    toolName: message.toolName,
  });
}
