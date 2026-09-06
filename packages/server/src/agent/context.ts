import type { Store } from "../store/repos.js";
import { build_tutor_context, renderTutorContext } from "./tutor-context.js";

/** @deprecated use build_tutor_context — kept as a string wrapper for prompts */
export function assembleSessionContext(store: Store, topicId: string): string {
  const ctx = build_tutor_context(store, topicId);
  return ctx ? renderTutorContext(ctx) : "当前没有主题。";
}
