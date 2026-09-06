import type { SessionEvent, TopicSummary } from "@quantum/shared";
import type { Store } from "../store/repos.js";

export type SessionRuntime = {
  store: Store;
  topicId: string;
  requireTopic: () => TopicSummary;
  emit: (event: SessionEvent) => void;
};
