import type { DatabaseSync } from "node:sqlite";
import type {
  BoundaryKind,
  BoundaryRecord,
  ExportSubstate,
  HeatmapDay,
  NoteReasonCode,
  NoteRecord,
  NoteType,
  OutlineDraftNode,
  OutlineNode,
  OutlineNodeStatus,
  PublicSettings,
  SectionRecord,
  TopicPhase,
  TopicSummary,
} from "@quantum/shared";
import { noteTypeFromReason, parseNoteReasonCode } from "@quantum/shared";
import { id } from "../ids.js";
import {
  resolveDependsOnIds,
  sequentialLeafDependsOn,
} from "../learning/prereq-edges.js";
import { getDb } from "./db.js";

export type ModelSettings = {
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
};

const DEFAULT_SETTINGS: ModelSettings = {
  provider: "openai",
  modelId: "gpt-4o-mini",
  baseUrl: "",
  apiKey: "",
};

type Row = Record<string, unknown>;

export class Store {
  constructor(private readonly db: DatabaseSync = getDb()) {}

  private now(): number {
    return Date.now();
  }

  getSettings(): ModelSettings {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = 'model'")
      .get() as { value: string } | undefined;
    if (!row) {
      const seeded = {
        ...DEFAULT_SETTINGS,
        provider: process.env.QUANTUM_MODEL_PROVIDER ?? DEFAULT_SETTINGS.provider,
        modelId: process.env.QUANTUM_MODEL_ID ?? DEFAULT_SETTINGS.modelId,
        baseUrl: process.env.QUANTUM_MODEL_BASE_URL ?? DEFAULT_SETTINGS.baseUrl,
        apiKey: process.env.QUANTUM_MODEL_API_KEY ?? DEFAULT_SETTINGS.apiKey,
      };
      this.putSettings(seeded);
      return seeded;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  }

  putSettings(next: ModelSettings): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('model', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(JSON.stringify(next));
  }

  publicSettings(): PublicSettings {
    const s = this.getSettings();
    return {
      provider: s.provider,
      modelId: s.modelId,
      baseUrl: s.baseUrl,
      hasApiKey: Boolean(s.apiKey),
    };
  }

  hasLiveModel(): boolean {
    return Boolean(this.getSettings().apiKey);
  }

  getCurrentTopicId(): string | null {
    const row = this.db
      .prepare("SELECT current_topic_id FROM app_state WHERE id = 1")
      .get() as { current_topic_id: string | null };
    return row.current_topic_id ?? null;
  }

  getCurrentSectionId(): string | null {
    const row = this.db
      .prepare("SELECT current_section_id FROM app_state WHERE id = 1")
      .get() as { current_section_id: string | null };
    return row.current_section_id ?? null;
  }

  setCurrentTopic(topicId: string | null): void {
    this.db
      .prepare(
        "UPDATE app_state SET current_topic_id = ?, current_section_id = CASE WHEN ? IS NULL THEN NULL ELSE current_section_id END WHERE id = 1",
      )
      .run(topicId, topicId);
  }

  setCurrentSection(sectionId: string | null): void {
    this.db
      .prepare("UPDATE app_state SET current_section_id = ? WHERE id = 1")
      .run(sectionId);
  }

  listTopics(): TopicSummary[] {
    const rows = this.db
      .prepare("SELECT * FROM topics ORDER BY updated_at DESC")
      .all() as Row[];
    return rows.map(topicFromRow);
  }

  getTopic(idValue: string): TopicSummary | null {
    const row = this.db.prepare("SELECT * FROM topics WHERE id = ?").get(idValue) as
      | Row
      | undefined;
    return row ? topicFromRow(row) : null;
  }

  requireTopic(idValue: string): TopicSummary {
    const topic = this.getTopic(idValue);
    if (!topic) throw new Error(`主题不存在: ${idValue}`);
    return topic;
  }

  createTopic(title = "未命名主题"): TopicSummary {
    const topicId = id("top");
    const ts = this.now();
    this.db
      .prepare(
        "INSERT INTO topics (id, title, phase, export_state, created_at, updated_at) VALUES (?, ?, 'boundary_interview', 'idle', ?, ?)",
      )
      .run(topicId, title, ts, ts);
    this.setCurrentTopic(topicId);
    this.setCurrentSection(null);
    return this.requireTopic(topicId);
  }

  updateTopic(
    topicId: string,
    patch: Partial<Pick<TopicSummary, "title" | "phase" | "exportState">>,
  ): TopicSummary {
    const current = this.requireTopic(topicId);
    const next = {
      title: patch.title ?? current.title,
      phase: patch.phase ?? current.phase,
      exportState: patch.exportState ?? current.exportState,
    };
    this.db
      .prepare(
        "UPDATE topics SET title = ?, phase = ?, export_state = ?, updated_at = ? WHERE id = ?",
      )
      .run(next.title, next.phase, next.exportState, this.now(), topicId);
    return this.requireTopic(topicId);
  }

  touchTopic(topicId: string): void {
    this.db.prepare("UPDATE topics SET updated_at = ? WHERE id = ?").run(this.now(), topicId);
  }

  getTopicGates(topicId: string): { boundaryConfirmed: boolean; boundaryFinalized: boolean } {
    const row = this.db
      .prepare("SELECT boundary_confirmed, boundary_finalized FROM topics WHERE id = ?")
      .get(topicId) as { boundary_confirmed: number; boundary_finalized: number } | undefined;
    return {
      boundaryConfirmed: Boolean(row?.boundary_confirmed),
      boundaryFinalized: Boolean(row?.boundary_finalized),
    };
  }

  setTopicGates(
    topicId: string,
    patch: { boundaryConfirmed?: boolean; boundaryFinalized?: boolean },
  ): void {
    this.requireTopic(topicId);
    const current = this.getTopicGates(topicId);
    const confirmed = patch.boundaryConfirmed ?? current.boundaryConfirmed;
    const finalized = patch.boundaryFinalized ?? current.boundaryFinalized;
    this.db
      .prepare(
        "UPDATE topics SET boundary_confirmed = ?, boundary_finalized = ?, updated_at = ? WHERE id = ?",
      )
      .run(confirmed ? 1 : 0, finalized ? 1 : 0, this.now(), topicId);
  }

  listBoundaries(topicId: string): BoundaryRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM boundaries WHERE topic_id = ? ORDER BY sort_order ASC")
      .all(topicId) as Row[];
    return rows.map(boundaryFromRow);
  }

  askBoundary(
    topicId: string,
    kind: BoundaryKind,
    question: string,
    previous?: { kind: BoundaryKind; answer: string },
  ): BoundaryRecord {
    if (previous) {
      this.recordBoundaryAnswer(topicId, previous.kind, previous.answer);
    }
    const existing = this.listBoundaries(topicId).find((b) => b.kind === kind);
    const ts = this.now();
    if (existing) {
      this.db
        .prepare(
          "UPDATE boundaries SET question = ?, status = 'asked', created_at = ? WHERE id = ?",
        )
        .run(question, ts, existing.id);
      this.touchTopic(topicId);
      return this.listBoundaries(topicId).find((b) => b.id === existing.id)!;
    }
    const rowId = id("bnd");
    const sort = this.listBoundaries(topicId).length;
    this.db
      .prepare(
        "INSERT INTO boundaries (id, topic_id, kind, question, answer, status, sort_order, created_at) VALUES (?, ?, ?, ?, '', 'asked', ?, ?)",
      )
      .run(rowId, topicId, kind, question, sort, ts);
    this.touchTopic(topicId);
    return this.listBoundaries(topicId).find((b) => b.id === rowId)!;
  }

  recordBoundaryAnswer(topicId: string, kind: BoundaryKind, answer: string): void {
    const trimmed = answer.trim();
    if (!trimmed) return;
    const existing = this.listBoundaries(topicId).find((b) => b.kind === kind);
    const ts = this.now();
    if (existing) {
      this.db
        .prepare("UPDATE boundaries SET answer = ?, status = 'answered' WHERE id = ?")
        .run(trimmed, existing.id);
      this.touchTopic(topicId);
      return;
    }
    const rowId = id("bnd");
    const sort = this.listBoundaries(topicId).length;
    this.db
      .prepare(
        "INSERT INTO boundaries (id, topic_id, kind, question, answer, status, sort_order, created_at) VALUES (?, ?, ?, ?, ?, 'answered', ?, ?)",
      )
      .run(rowId, topicId, kind, "", trimmed, sort, ts);
    this.touchTopic(topicId);
  }

  /** Write answers without changing phase. Used when finalize_boundary is rejected. */
  upsertBoundaryAnswers(
    topicId: string,
    answers: Array<{ kind: BoundaryKind; question: string; answer: string }>,
  ): BoundaryRecord[] {
    for (const item of answers) {
      const trimmed = item.answer.trim();
      const existing = this.listBoundaries(topicId).find((b) => b.kind === item.kind);
      if (existing) {
        const question = item.question.trim() || existing.question;
        const answer = trimmed || existing.answer;
        const status = answer ? "answered" : existing.status;
        this.db
          .prepare("UPDATE boundaries SET question = ?, answer = ?, status = ? WHERE id = ?")
          .run(question, answer, status, existing.id);
      } else if (trimmed) {
        const rowId = id("bnd");
        const sort = this.listBoundaries(topicId).length;
        this.db
          .prepare(
            "INSERT INTO boundaries (id, topic_id, kind, question, answer, status, sort_order, created_at) VALUES (?, ?, ?, ?, ?, 'answered', ?, ?)",
          )
          .run(rowId, topicId, item.kind, item.question, trimmed, sort, this.now());
      }
    }
    this.touchTopic(topicId);
    return this.listBoundaries(topicId);
  }

  finalizeBoundaries(
    topicId: string,
    answers: Array<{ kind: BoundaryKind; question: string; answer: string }>,
  ): BoundaryRecord[] {
    for (const item of answers) {
      const existing = this.listBoundaries(topicId).find((b) => b.kind === item.kind);
      if (existing) {
        this.db
          .prepare(
            "UPDATE boundaries SET question = ?, answer = ?, status = 'finalized' WHERE id = ?",
          )
          .run(item.question, item.answer.trim(), existing.id);
      } else {
        const rowId = id("bnd");
        const sort = this.listBoundaries(topicId).length;
        this.db
          .prepare(
            "INSERT INTO boundaries (id, topic_id, kind, question, answer, status, sort_order, created_at) VALUES (?, ?, ?, ?, ?, 'finalized', ?, ?)",
          )
          .run(rowId, topicId, item.kind, item.question, item.answer.trim(), sort, this.now());
      }
    }
    this.db
      .prepare(
        "UPDATE boundaries SET status = 'finalized' WHERE topic_id = ? AND answer != ''",
      )
      .run(topicId);
    this.updateTopic(topicId, { phase: "outline_draft" });
    this.setTopicGates(topicId, { boundaryConfirmed: false, boundaryFinalized: true });
    return this.listBoundaries(topicId);
  }

  replaceOutline(
    topicId: string,
    title: string,
    nodes: OutlineDraftNode[],
    status: OutlineNodeStatus,
  ): OutlineNode[] {
    this.db.prepare("DELETE FROM outline_nodes WHERE topic_id = ?").run(topicId);
    const insert = (
      node: OutlineDraftNode,
      parentId: string | null,
      index: number,
    ): string => {
      const nodeId = id("out");
      this.db
        .prepare(
          "INSERT INTO outline_nodes (id, topic_id, parent_id, title, intent, objective, depends_on, target_chars, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          nodeId,
          topicId,
          parentId,
          node.title,
          node.intent,
          node.objective ?? node.intent,
          JSON.stringify(node.depends_on ?? []),
          node.target_chars ?? 0,
          index,
          status,
        );
      (node.children ?? []).forEach((child, childIndex) => insert(child, nodeId, childIndex));
      return nodeId;
    };
    nodes.forEach((node, index) => insert(node, null, index));
    this.updateTopic(topicId, { title });
    this.writeDependsOn(topicId, resolveDependsOnIds(nodes, this.getOutline(topicId)));
    return this.getOutline(topicId);
  }

  finalizeOutline(topicId: string, title?: string): OutlineNode[] {
    this.db
      .prepare("UPDATE outline_nodes SET status = 'finalized' WHERE topic_id = ?")
      .run(topicId);
    this.updateTopic(topicId, {
      phase: "learning",
      title: title || this.requireTopic(topicId).title,
    });
    let outline = this.getOutline(topicId);
    const hasEdge = flattenOutline(outline).some((n) => n.dependsOn.length > 0);
    if (!hasEdge) {
      this.writeDependsOn(topicId, sequentialLeafDependsOn(outline));
      outline = this.getOutline(topicId);
    }
    const firstLeaf = firstLeafId(outline);
    if (firstLeaf) this.setCurrentSection(firstLeaf);
    return outline;
  }

  private writeDependsOn(topicId: string, byId: Map<string, string[]>): void {
    const stmt = this.db.prepare("UPDATE outline_nodes SET depends_on = ? WHERE id = ? AND topic_id = ?");
    for (const [nodeId, deps] of byId) {
      stmt.run(JSON.stringify(deps), nodeId, topicId);
    }
  }

  getOutline(topicId: string): OutlineNode[] {
    const rows = this.db
      .prepare("SELECT * FROM outline_nodes WHERE topic_id = ? ORDER BY sort_order ASC")
      .all(topicId) as Row[];
    const mapped = rows.map(outlineFromRow);
    const byId = new Map(mapped.map((n) => [n.id, n]));
    const roots: OutlineNode[] = [];
    for (const node of mapped) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  getOutlineFlat(topicId: string): OutlineNode[] {
    const rows = this.db
      .prepare("SELECT * FROM outline_nodes WHERE topic_id = ? ORDER BY sort_order ASC")
      .all(topicId) as Row[];
    return rows.map((row) => ({ ...outlineFromRow(row), children: [] }));
  }

  upsertSection(
    topicId: string,
    outlineNodeId: string,
    title: string,
    bodyMd: string,
  ): SectionRecord {
    const existing = this.db
      .prepare("SELECT id FROM sections WHERE outline_node_id = ?")
      .get(outlineNodeId) as { id: string } | undefined;
    const ts = this.now();
    const sectionId = existing?.id ?? outlineNodeId;
    if (existing) {
      this.db
        .prepare(
          "UPDATE sections SET title = ?, body_md = ?, generated_at = ? WHERE id = ?",
        )
        .run(title, bodyMd, ts, sectionId);
    } else {
      this.db
        .prepare(
          "INSERT INTO sections (id, topic_id, outline_node_id, title, body_md, generated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(sectionId, topicId, outlineNodeId, title, bodyMd, ts);
    }
    this.db
      .prepare("UPDATE outline_nodes SET status = 'ready', title = ? WHERE id = ?")
      .run(title, outlineNodeId);
    this.setCurrentSection(sectionId);
    this.touchTopic(topicId);
    this.bumpActivity();
    return this.getSectionByOutline(outlineNodeId)!;
  }

  getSectionByOutline(outlineNodeId: string): SectionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM sections WHERE outline_node_id = ?")
      .get(outlineNodeId) as Row | undefined;
    return row ? sectionFromRow(row) : null;
  }

  getSection(sectionId: string): SectionRecord | null {
    const row = this.db.prepare("SELECT * FROM sections WHERE id = ?").get(sectionId) as
      | Row
      | undefined;
    return row ? sectionFromRow(row) : null;
  }

  appendNote(
    topicId: string,
    body: string,
    sectionId?: string,
    reasonCode: NoteReasonCode = 1,
  ): NoteRecord {
    const noteId = id("note");
    const ts = this.now();
    const type = noteTypeFromReason(reasonCode);
    this.db
      .prepare(
        "INSERT INTO notes (id, topic_id, section_id, body, source, reason_code, note_type, created_at) VALUES (?, ?, ?, ?, 'append_note', ?, ?, ?)",
      )
      .run(noteId, topicId, sectionId ?? null, body.trim(), String(reasonCode), type, ts);
    this.touchTopic(topicId);
    this.bumpActivity();
    return this.listNotes(topicId).find((n) => n.id === noteId)!;
  }

  listNotes(topicId: string): NoteRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM notes WHERE topic_id = ? ORDER BY created_at ASC")
      .all(topicId) as Row[];
    return rows.map(noteFromRow);
  }

  getSessionMessages(topicId: string): unknown[] {
    const row = this.db
      .prepare("SELECT messages_json FROM sessions WHERE topic_id = ?")
      .get(topicId) as { messages_json: string } | undefined;
    if (!row) return [];
    try {
      return JSON.parse(row.messages_json) as unknown[];
    } catch {
      return [];
    }
  }

  saveSessionMessages(topicId: string, messages: unknown[]): void {
    this.db
      .prepare(
        "INSERT INTO sessions (topic_id, messages_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(topic_id) DO UPDATE SET messages_json = excluded.messages_json, updated_at = excluded.updated_at",
      )
      .run(topicId, JSON.stringify(messages), this.now());
  }

  bumpActivity(day = new Date().toISOString().slice(0, 10)): void {
    this.db
      .prepare(
        "INSERT INTO activity_days (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1",
      )
      .run(day);
  }

  heatmap(days = 140): HeatmapDay[] {
    const rows = this.db.prepare("SELECT day, count FROM activity_days").all() as Array<{
      day: string;
      count: number;
    }>;
    const map = new Map(rows.map((r) => [r.day, r.count]));
    const out: HeatmapDay[] = [];
    const end = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, count: map.get(key) ?? 0 });
    }
    return out;
  }
}

function topicFromRow(row: Row): TopicSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    phase: row.phase as TopicPhase,
    exportState: row.export_state as ExportSubstate,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function boundaryFromRow(row: Row): BoundaryRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    kind: row.kind as BoundaryKind,
    question: String(row.question),
    answer: String(row.answer),
    status: row.status as BoundaryRecord["status"],
    sortOrder: Number(row.sort_order),
    createdAt: Number(row.created_at),
  };
}

function outlineFromRow(row: Row): OutlineNode {
  let dependsOn: string[] = [];
  try {
    dependsOn = JSON.parse(String(row.depends_on ?? "[]")) as string[];
  } catch {
    dependsOn = [];
  }
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    title: String(row.title),
    intent: String(row.intent),
    objective: String(row.objective ?? row.intent ?? ""),
    dependsOn,
    targetChars: Number(row.target_chars ?? 0),
    sortOrder: Number(row.sort_order),
    status: row.status as OutlineNodeStatus,
    children: [],
  };
}

function sectionFromRow(row: Row): SectionRecord {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    outlineNodeId: String(row.outline_node_id),
    title: String(row.title),
    bodyMd: String(row.body_md),
    generatedAt: Number(row.generated_at),
  };
}

function noteFromRow(row: Row): NoteRecord {
  const reasonCode = parseNoteReasonCode(row.reason_code) ?? 1;
  const storedType = row.note_type;
  const type: NoteType =
    storedType === "思考" || storedType === "疑问" || storedType === "拓展"
      ? storedType
      : noteTypeFromReason(reasonCode);
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    sectionId: row.section_id ? String(row.section_id) : null,
    body: String(row.body),
    reasonCode,
    type,
    createdAt: Number(row.created_at),
  };
}

export function firstLeafId(nodes: OutlineNode[]): string | null {
  for (const node of nodes) {
    if (node.children.length === 0) return node.id;
    const child = firstLeafId(node.children);
    if (child) return child;
  }
  return nodes[0]?.id ?? null;
}

export function flattenOutline(nodes: OutlineNode[]): OutlineNode[] {
  const out: OutlineNode[] = [];
  const walk = (list: OutlineNode[]) => {
    for (const node of list) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
