import type { BoundaryKind, ExportFormat } from "./tools.js";
import type { ExportSubstate, OutlineNodeStatus, TopicPhase } from "./phases.js";

export type TopicSummary = {
  id: string;
  title: string;
  phase: TopicPhase;
  exportState: ExportSubstate;
  createdAt: number;
  updatedAt: number;
};

export type BoundaryRecord = {
  id: string;
  topicId: string;
  kind: BoundaryKind;
  question: string;
  answer: string;
  status: "asked" | "answered" | "finalized";
  sortOrder: number;
  createdAt: number;
};

export type OutlineNode = {
  id: string;
  topicId: string;
  parentId: string | null;
  title: string;
  intent: string;
  sortOrder: number;
  status: OutlineNodeStatus;
  children: OutlineNode[];
};

export type SectionRecord = {
  id: string;
  topicId: string;
  outlineNodeId: string;
  title: string;
  bodyMd: string;
  generatedAt: number;
};

export type NoteRecord = {
  id: string;
  topicId: string;
  sectionId: string | null;
  body: string;
  createdAt: number;
};

export type SessionMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  toolName?: string;
  createdAt: number;
};

export type AppSnapshot = {
  currentTopicId: string | null;
  topic: TopicSummary | null;
  currentSectionId: string | null;
  coachMode: "stub" | "live";
  settings: PublicSettings;
};

export type PublicSettings = {
  provider: string;
  modelId: string;
  baseUrl: string;
  hasApiKey: boolean;
};

export type SettingsInput = {
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey?: string;
  clearApiKey?: boolean;
};

export type TopicDetail = {
  topic: TopicSummary;
  boundaries: BoundaryRecord[];
  outline: OutlineNode[];
  currentSection: SectionRecord | null;
  notes: NoteRecord[];
};

export type ExportResult = {
  format: ExportFormat;
  filename: string;
  downloadPath: string;
};

export type HeatmapDay = {
  date: string;
  count: number;
};
