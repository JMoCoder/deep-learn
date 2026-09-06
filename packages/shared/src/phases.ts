export const TOPIC_PHASES = [
  "idle",
  "boundary_interview",
  "outline_draft",
  "learning",
] as const;

export type TopicPhase = (typeof TOPIC_PHASES)[number];

export const EXPORT_SUBSTATES = ["idle", "exporting", "ready"] as const;
export type ExportSubstate = (typeof EXPORT_SUBSTATES)[number];

export const OUTLINE_NODE_STATUSES = [
  "draft",
  "finalized",
  "generating",
  "ready",
] as const;

export type OutlineNodeStatus = (typeof OUTLINE_NODE_STATUSES)[number];
