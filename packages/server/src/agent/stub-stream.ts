import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import type { Store } from "../store/repos.js";
import { planCoachTurn, type CoachPlan } from "./coach.js";
import { setTurnStrategy } from "./turn-meta.js";

export function createStubStreamFn(store: Store, topicId: string) {
  return (
    model: Model<string>,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream => {
    const stream = createAssistantMessageEventStream();

    void (async () => {
      const output = emptyAssistant(model);
      try {
        const plan = planCoachTurn(store, topicId, lastTurn(context));
        if (plan.strategy) setTurnStrategy(topicId, plan.strategy);
        stream.push({ type: "start", partial: output });
        await emitPlan(stream, output, plan, options?.signal);
        if (options?.signal?.aborted) {
          output.stopReason = "aborted";
          stream.push({ type: "error", reason: "aborted", error: output });
        } else {
          stream.push({
            type: "done",
            reason: output.stopReason as "stop" | "length" | "toolUse",
            message: output,
          });
        }
        stream.end();
      } catch (error) {
        output.stopReason = options?.signal?.aborted ? "aborted" : "error";
        output.errorMessage = error instanceof Error ? error.message : String(error);
        stream.push({ type: "error", reason: output.stopReason, error: output });
        stream.end();
      }
    })();

    return stream;
  };
}

function emptyAssistant(model: Model<string>): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

async function emitPlan(
  stream: AssistantMessageEventStream,
  output: AssistantMessage,
  plan: CoachPlan,
  signal?: AbortSignal,
): Promise<void> {
  if (plan.text) {
    const block = { type: "text" as const, text: plan.text };
    output.content.push(block);
    stream.push({ type: "text_start", contentIndex: 0, partial: output });
    stream.push({ type: "text_delta", contentIndex: 0, delta: plan.text, partial: output });
    stream.push({ type: "text_end", contentIndex: 0, content: plan.text, partial: output });
  }

  if (plan.tool) {
    const id = `stub_${Date.now()}`;
    const args = JSON.stringify(plan.tool.args);
    const block = {
      type: "toolCall" as const,
      id,
      name: plan.tool.name,
      arguments: plan.tool.args,
    };
    output.content.push(block);
    output.stopReason = "toolUse";
    const contentIndex = output.content.length - 1;
    stream.push({
      type: "toolcall_start",
      contentIndex,
      id,
      toolName: plan.tool.name,
      partial: output,
    } as never);
    stream.push({
      type: "toolcall_delta",
      contentIndex,
      delta: args,
      partial: output,
    } as never);
    stream.push({
      type: "toolcall_end",
      contentIndex,
      toolCall: { id, name: plan.tool.name, arguments: plan.tool.args },
      partial: output,
    } as never);
  }

  void signal;
}

function lastTurn(context: Context): {
  lastUserText: string;
  lastRole: string;
  lastToolName?: string;
} {
  const last = context.messages[context.messages.length - 1];
  return {
    lastUserText: lastUserText(context),
    lastRole: last && "role" in last ? String(last.role) : "none",
    lastToolName:
      last && last.role === "toolResult" && "toolName" in last
        ? String(last.toolName)
        : undefined,
  };
}

function lastUserText(context: Context): string {
  for (let i = context.messages.length - 1; i >= 0; i--) {
    const msg = context.messages[i];
    if (msg && msg.role === "user") {
      const content = msg.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
          .join("\n");
      }
    }
  }
  return "";
}
