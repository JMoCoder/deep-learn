/**
 * Cold-start cache for Learn gates and the current-topic pointer.
 *
 * UI truth is only GET /api/state (currentTopicId, boundaryConfirmed,
 * boundaryFinalized) and server phase / boundary events. These keys are
 * overwritten after every successful state fetch. On conflict, state always
 * wins — storage must not alone decide “card confirmed” or “current topic”.
 */
const CONFIRMED_PREFIX = "quantum.boundary-card.confirmed.";
const FINALIZED_PREFIX = "quantum.boundary-card.finalized.";
const TOPIC_PTR = "quantum.current-topic-id";
const ANCHOR_PREFIX = "quantum.topic-anchor.";

function readSessionFlag(key: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string, on: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (on) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function readBoundaryConfirmed(topicId: string | null): boolean {
  if (!topicId) return false;
  return readSessionFlag(`${CONFIRMED_PREFIX}${topicId}`);
}

export function writeBoundaryConfirmed(topicId: string, confirmed: boolean): void {
  writeSessionFlag(`${CONFIRMED_PREFIX}${topicId}`, confirmed);
}

export function readBoundaryFinalized(topicId: string | null): boolean {
  if (!topicId) return false;
  return readSessionFlag(`${FINALIZED_PREFIX}${topicId}`);
}

export function writeBoundaryFinalized(topicId: string, finalized: boolean): void {
  writeSessionFlag(`${FINALIZED_PREFIX}${topicId}`, finalized);
}

/** Last /api/state.currentTopicId. Cold-start hint — not a substitute for app_state. */
export function readCachedTopicId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(TOPIC_PTR);
  } catch {
    return null;
  }
}

export function writeCachedTopicId(id: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (id) localStorage.setItem(TOPIC_PTR, id);
    else localStorage.removeItem(TOPIC_PTR);
  } catch {
    /* private mode */
  }
}

export function readTopicAnchor(topicId: string | null): string | null {
  if (!topicId || typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`${ANCHOR_PREFIX}${topicId}`);
  } catch {
    return null;
  }
}

export function writeTopicAnchor(topicId: string, title: string): void {
  if (typeof sessionStorage === "undefined") return;
  const trimmed = title.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(`${ANCHOR_PREFIX}${topicId}`, trimmed);
  } catch {
    /* private mode */
  }
}

/** Mirror GET /api/state onto the cache. Call after every successful fetch. */
export function overwriteGateCacheFromState(state: {
  currentTopicId: string | null;
  boundaryConfirmed: boolean;
  boundaryFinalized: boolean;
}): void {
  writeCachedTopicId(state.currentTopicId);
  if (!state.currentTopicId) return;
  writeBoundaryConfirmed(state.currentTopicId, state.boundaryConfirmed);
  writeBoundaryFinalized(state.currentTopicId, state.boundaryFinalized);
}
