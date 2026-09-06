const PREFIX = "quantum.boundary-card.confirmed.";

export function readBoundaryConfirmed(topicId: string | null): boolean {
  if (!topicId || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(`${PREFIX}${topicId}`) === "1";
  } catch {
    return false;
  }
}

export function writeBoundaryConfirmed(topicId: string, confirmed: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = `${PREFIX}${topicId}`;
    if (confirmed) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}
