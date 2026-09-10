import { bus } from "../agent/bus.js";
import type { Store } from "../store/repos.js";
import { createQuantumTools } from "./factory.js";

/** Run one Quantum tool with the same execute path the agent uses. */
export async function runTopicTool(
  store: Store,
  topicId: string,
  name: string,
  args: Record<string, unknown>,
) {
  const tools = createQuantumTools({
    store,
    topicId,
    requireTopic: () => store.requireTopic(topicId),
    emit: (event) => bus.emit(event),
  });
  const tool = tools.find((item) => item.name === name);
  if (!tool) throw new Error(`unknown tool ${name}`);
  return tool.execute("http-gate", args as never);
}
