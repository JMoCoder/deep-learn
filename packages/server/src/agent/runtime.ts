import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { SessionEvent, SessionMessage, TopicSummary } from "@quantum/shared";
import { createQuantumTools } from "../tools/factory.js";
import type { Store } from "../store/repos.js";
import { bus } from "./bus.js";
import { assembleSessionContext } from "./context.js";
import { modelFromSettings, stubModel } from "./model.js";
import { baseSystemPrompt, phasePrompt } from "./prompts.js";
import { safeLog } from "../redact.js";
import { createStubStreamFn } from "./stub-stream.js";
import { topicHitsScopeOut } from "../learning/scope-out.js";
import { beginTurn, endTurn, peekTurnMeta, setTurnStrategy } from "./turn-meta.js";
import { build_tutor_context } from "./tutor-context.js";
import type { SessionRuntime } from "./types.js";

export class AgentHost {
  private agents = new Map<string, Agent>();
  private controllers = new Map<string, AbortController>();
  private tails = new Map<string, Promise<void>>();

  constructor(private readonly store: Store) {}

  dropAll(): void {
    for (const agent of this.agents.values()) {
      try {
        agent.abort();
      } catch {
        /* ignore */
      }
    }
    this.agents.clear();
  }

  abort(topicId: string): void {
    this.agents.get(topicId)?.abort();
    this.controllers.get(topicId)?.abort();
  }

  messagesForClient(topicId: string): SessionMessage[] {
    const agent = this.agents.get(topicId);
    const raw = agent?.state.messages ?? (this.store.getSessionMessages(topicId) as AgentMessage[]);
    return toClientMessages(raw);
  }

  async prompt(topicId: string, text: string): Promise<void> {
    const prev = this.tails.get(topicId) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(() => this.runPrompt(topicId, text));
    this.tails.set(topicId, run);
    await run;
  }

  private async runPrompt(topicId: string, text: string): Promise<void> {
    const topic = this.store.requireTopic(topicId);
    const agent = this.ensure(topic);
    this.refreshPrompt(agent, topic.id);
    const packed = build_tutor_context(this.store, topicId);
    const refuse =
      topic.phase === "learning" && topicHitsScopeOut(this.store, topicId, text);
    beginTurn(topicId, refuse ? "REFUSE_OFFSCOPE" : packed?.L0.strategyHint, text);
    if (refuse) setTurnStrategy(topicId, "REFUSE_OFFSCOPE");
    bus.emit({ type: "session_start", topicId });
    try {
      await agent.prompt(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      safeLog("agent.prompt.error", { message });
      bus.emit({ type: "error", message });
    } finally {
      this.store.saveSessionMessages(topicId, agent.state.messages);
      bus.emit({ type: "session_end", topicId });
      endTurn(topicId);
    }
  }

  async kickoff(topicId: string): Promise<void> {
    await this.prompt(topicId, "学习者刚新建主题。请开始边界访谈。");
  }

  private ensure(topic: TopicSummary): Agent {
    const existing = this.agents.get(topic.id);
    if (existing) {
      existing.state.tools = createQuantumTools(this.runtime(topic.id));
      return existing;
    }

    const settings = this.store.getSettings();
    const live = Boolean(settings.apiKey);
    const model = modelFromSettings(settings);
    const tools = createQuantumTools(this.runtime(topic.id));
    const saved = this.store.getSessionMessages(topic.id) as AgentMessage[];

    const agent = new Agent({
      initialState: {
        systemPrompt: this.composePrompt(topic.id),
        model: live ? model : stubModel(),
        thinkingLevel: "off",
        tools,
        messages: Array.isArray(saved) ? saved : [],
      },
      sessionId: topic.id,
      getApiKey: async () => this.store.getSettings().apiKey || undefined,
      streamFn: live
        ? (m, ctx, opt) =>
            streamSimple(m, ctx, {
              ...opt,
              apiKey: this.store.getSettings().apiKey,
            })
        : createStubStreamFn(this.store, topic.id),
      convertToLlm: (messages) =>
        messages.filter((m) => {
          const role = (m as { role?: string }).role;
          return role === "user" || role === "assistant" || role === "toolResult";
        }) as never,
    });

    agent.subscribe((event) => {
      this.forward(topic.id, event);
    });

    this.agents.set(topic.id, agent);
    return agent;
  }

  private runtime(topicId: string): SessionRuntime {
    return {
      store: this.store,
      topicId,
      requireTopic: () => this.store.requireTopic(topicId),
      emit: (event) => bus.emit(event),
    };
  }

  private composePrompt(topicId: string): string {
    const topic = this.store.requireTopic(topicId);
    return [baseSystemPrompt(), phasePrompt(topic.phase), assembleSessionContext(this.store, topicId)].join(
      "\n\n",
    );
  }

  private refreshPrompt(agent: Agent, topicId: string): void {
    agent.state.systemPrompt = this.composePrompt(topicId);
    const settings = this.store.getSettings();
    if (settings.apiKey) {
      agent.state.model = modelFromSettings(settings);
    }
  }

  private forward(topicId: string, event: AgentEvent): void {
    switch (event.type) {
      case "message_update": {
        const inner = event.assistantMessageEvent;
        if (inner && inner.type === "text_delta" && "delta" in inner) {
          bus.emit({ type: "text_delta", text: String(inner.delta ?? "") });
        }
        break;
      }
      case "message_end": {
        const msg = event.message as AgentMessage;
        const role = (msg as { role?: string }).role;
        if (role === "user" || role === "assistant") {
          const text = messageText(msg);
          if (text) {
            const packed = build_tutor_context(this.store, topicId);
            const metaNow = peekTurnMeta(topicId);
            const topicNow = this.store.getTopic(topicId);
            const userHit =
              topicNow?.phase === "learning" &&
              Boolean(metaNow.userText) &&
              topicHitsScopeOut(this.store, topicId, metaNow.userText ?? "");
            if (userHit) {
              setTurnStrategy(topicId, "REFUSE_OFFSCOPE");
            } else if (!metaNow.strategy && packed?.L0.strategyHint) {
              setTurnStrategy(topicId, packed.L0.strategyHint);
            }
            const meta = peekTurnMeta(topicId);
            bus.emit({
              type: "message",
              role,
              text,
              ...(role === "assistant"
                ? { strategy: meta.strategy, citations: meta.citations }
                : {}),
            });
          }
        }
        break;
      }
      case "tool_execution_start": {
        bus.emit({
          type: "tool_start",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
        });
        break;
      }
      case "tool_execution_end": {
        const summary = toolSummary(event);
        bus.emit({
          type: "tool_end",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          ok: !isToolError(event),
          summary,
        });
        break;
      }
      default:
        break;
    }
  }
}

function messageText(msg: AgentMessage): string {
  const content = (msg as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (block && typeof block === "object" && "type" in block) {
        const b = block as { type: string; text?: string };
        if (b.type === "text") return b.text ?? "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function toolSummary(event: AgentEvent): string {
  if (event.type !== "tool_execution_end") return "";
  const result = (event as { result?: { content?: Array<{ text?: string }> } }).result;
  const text = result?.content?.map((c) => c.text ?? "").join("") ?? "";
  return text.slice(0, 240);
}

function isToolError(event: AgentEvent): boolean {
  if (event.type !== "tool_execution_end") return false;
  return Boolean((event as { isError?: boolean }).isError);
}

function toClientMessages(raw: AgentMessage[]): SessionMessage[] {
  const out: SessionMessage[] = [];
  for (const [index, msg] of raw.entries()) {
    const role = (msg as { role?: string }).role;
    const ts = Number((msg as { timestamp?: number }).timestamp ?? Date.now());
    if (role === "user" || role === "assistant") {
      const text = messageText(msg);
      if (text) {
        out.push({ id: `m${index}`, role, text, createdAt: ts });
      }
    } else if (role === "toolResult") {
      const toolName = String((msg as { toolName?: string }).toolName ?? "tool");
      out.push({
        id: `m${index}`,
        role: "tool",
        toolName,
        text: messageText(msg) || toolName,
        createdAt: ts,
      });
    }
  }
  return out;
}
