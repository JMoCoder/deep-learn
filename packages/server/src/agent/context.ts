import type { Store } from "../store/repos.js";
import { build_tutor_context, renderTutorContext } from "./tutor-context.js";

/** Pack L0–L3 before each user turn. L4 stays deferred. */
export function assembleSessionContext(store: Store, topicId: string): string {
  const ctx = build_tutor_context(store, topicId, { includeL4: false });
  return ctx ? renderTutorContext(ctx) : "当前没有主题。";
}
