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
  section_id?: string;
  note_id?: string;
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
  REFUSE_OFFSCOPE: "拒",
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
      return null;
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

export function citationLabel(
  cite: { section_id: string; note_id?: string },
  titles?: Map<string, string>,
): string {
  const name = titles?.get(cite.section_id);
  const head = name || `章节 ${cite.section_id.slice(0, 8)}`;
  return cite.note_id ? `${head} · 笔记` : head;
}

export function citationsFromWire(
  cites: Array<{ section_id: string; note_id?: string }> | undefined,
  titles?: Map<string, string>,
): Citation[] {
  if (!cites?.length) return [];
  return cites
    .filter((c) => c.section_id?.trim())
    .map((c) => ({
      section_id: c.section_id,
      note_id: c.note_id,
      title: citationLabel(c, titles),
    }));
}

export function visibleCitations(cites: Citation[] | undefined | null): Citation[] {
  if (!cites?.length) return [];
  return cites.filter((c) => {
    const title = (c.title ?? "").trim();
    if (c.section_id?.trim()) return title !== "当前章节" && title !== "当前大纲";
    if (!title) return false;
    if (title === "当前章节" || title === "当前大纲") return false;
    return true;
  });
}

export function looksLikeRefuseCopy(text?: string | null): boolean {
  const t = text ?? "";
  if (/\bREFUSE_OFFSCOPE\b/.test(t)) return true;
  return /排除区|踩界|超出当前学习边界|这次不展开/.test(t);
}

export function strategyChipView(
  strategy: TutorStrategy,
  extras?: { text?: string | null; toolName?: string | null },
): { strategy: TutorStrategy; code: string; label: string } {
  if (
    strategy === "REFUSE_OFFSCOPE" ||
    isRefuseOffscopeSignal({
      strategy,
      text: extras?.text,
      toolName: extras?.toolName,
    }) ||
    looksLikeRefuseCopy(extras?.text)
  ) {
    return { strategy: "REFUSE_OFFSCOPE", code: "REFUSE", label: "拒" };
  }
  return { strategy, code: strategy, label: strategyLabel(strategy) };
}

function rowLooksRefuse(row: LiveSessionRow): boolean {
  if (row.kind === "refuse") return true;
  if (
    isRefuseOffscopeSignal({
      strategy: row.strategy,
      text: row.summary,
      toolName: row.toolName,
    })
  ) {
    return true;
  }
  return looksLikeRefuseCopy(row.summary);
}

function latestTurnMessages(messages: SessionMessage[]): SessionMessage[] {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      lastUser = i;
      break;
    }
  }
  return lastUser >= 0 ? messages.slice(lastUser) : messages;
}

/** REFUSE on this turn beats tool-inferred GROUND (get_section / list_outline). */
export function lastStrategy(
  messages: SessionMessage[],
  liveRows: LiveSessionRow[],
): TutorStrategy {
  if (liveRows.some(rowLooksRefuse) || latestTurnMessages(messages).some(messageIsRefuse)) {
    return "REFUSE_OFFSCOPE";
  }
  for (let i = liveRows.length - 1; i >= 0; i -= 1) {
    const row = liveRows[i];
    if (row?.strategy) return row.strategy;
    const next = strategyFromTool(row?.toolName);
    if (next) return next;
  }
  const tail = latestTurnMessages(messages);
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const m = tail[i];
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
  const trimmed = summary.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as {
      sources?: Array<{ title?: string; url?: string; section_id?: string }>;
      citations?: Array<{ title?: string; url?: string; section_id?: string }>;
    };
    const list = parsed.sources ?? parsed.citations ?? [];
    return visibleCitations(
      list
        .filter((item) => item.section_id || item.url || item.title)
        .map((item) => ({
          title: item.title || item.url || "",
          url: item.url,
          section_id: item.section_id,
        })),
    );
  } catch {
    /* tool dumps are not cites */
  }
  return [];
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
  const refused =
    liveRows.some(rowLooksRefuse) || latestTurnMessages(messages).some(messageIsRefuse);
  return liveRows.filter((row) => {
    if (refused && (row.kind === "cite" || row.kind === "note")) return false;
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

export function messageIsRefuse(
  message: Pick<SessionMessage, "strategy" | "text" | "toolName"> & { role?: SessionMessage["role"] },
): boolean {
  if (message.role === "user") return false;
  if (
    isRefuseOffscopeSignal({
      strategy: message.strategy,
      text: message.text,
      toolName: message.toolName,
    })
  ) {
    return true;
  }
  if (message.toolName === "append_note") return false;
  return looksLikeRefuseCopy(message.text);
}

export function decorateAssistantMessage(
  message: SessionMessage,
  overlay?: { strategy?: TutorStrategy; citations?: SessionMessage["citations"] },
): SessionMessage {
  const strategy = message.strategy ?? overlay?.strategy;
  const citations = message.citations?.length ? message.citations : overlay?.citations;
  const merged: SessionMessage = { ...message, strategy, citations };
  if (messageIsRefuse(merged) || messageIsRefuse(message)) {
    return { ...merged, strategy: "REFUSE_OFFSCOPE", citations: [] };
  }
  return merged;
}
