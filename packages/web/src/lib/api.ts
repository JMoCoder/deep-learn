import {
  CLIENT_SSE_EVENTS,
  type AppSnapshot,
  type PublicSettings,
  type SessionEvent,
  type SessionMessage,
  type SettingsInput,
  type TopicDetail,
  type TopicProjection,
  type TopicSummary,
} from "@quantum/shared";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => req<AppSnapshot>("/api/state"),
  topics: () => req<TopicSummary[]>("/api/topics"),
  topic: (id: string) => req<TopicDetail>(`/api/topics/${id}`),
  createTopic: (title?: string) =>
    req<TopicSummary>("/api/topics", { method: "POST", body: JSON.stringify({ title }) }),
  renameTopic: (id: string, title: string) =>
    req<TopicSummary>(`/api/topics/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  switchTopic: (id: string) => req(`/api/topics/${id}/switch`, { method: "POST" }),
  confirmBoundary: (id: string) =>
    req<{ ok: boolean; topicId: string; boundaryConfirmed: boolean; boundaryFinalized: boolean }>(
      `/api/topics/${id}/confirm-boundary`,
      { method: "POST" },
    ),
  selectSection: (topicId: string, sectionId: string) =>
    req(`/api/topics/${topicId}/select-section`, {
      method: "POST",
      body: JSON.stringify({ sectionId }),
    }),
  settings: () => req<PublicSettings>("/api/settings"),
  saveSettings: (body: SettingsInput) =>
    req<PublicSettings>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
  messages: () => req<SessionMessage[]>("/api/session/messages"),
  prompt: (text: string) =>
    req<{ ok: boolean }>("/api/session/prompt", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  abort: () => req("/api/session/abort", { method: "POST" }),
  requestExport: (topicId: string, format: "md" | "html" | "epub") =>
    req(`/api/topics/${topicId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
  projection: () => req<TopicProjection>("/api/topics/current/projection"),
};

/** Frozen domain names only. Aliases like topic_updated / section_updated / outline_updated / tool_* are ignored.
 * REFUSE_OFFSCOPE is a `message.strategy` (or compat text), not an 8th domain event. */
export const WEB_SSE_EVENTS = CLIENT_SSE_EVENTS;

/** Stream transport for composer + tutor metadata (`strategy`, `citations[]`). Not domain aliases. */
const STREAM_SSE_EVENTS = [
  "session_start",
  "session_end",
  "text_delta",
  "message",
  "error",
  "tool_end",
] as const;

export function connectEvents(onEvent: (event: SessionEvent) => void): () => void {
  const es = new EventSource("/api/session/events");
  const types = [...WEB_SSE_EVENTS, ...STREAM_SSE_EVENTS];
  for (const type of types) {
    es.addEventListener(type, (raw) => {
      try {
        onEvent(JSON.parse((raw as MessageEvent).data) as SessionEvent);
      } catch {
        /* ignore malformed */
      }
    });
  }
  return () => es.close();
}
