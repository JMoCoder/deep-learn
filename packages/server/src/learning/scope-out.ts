import { refuseRedirectCopy } from "@quantum/shared";
import { snapshotFromRecords } from "./boundary-snapshot.js";
import { scopeOutTerms } from "./outline-constraints.js";
import type { Store } from "../store/repos.js";

/**
 * Chat-side needles. Reuses outline scope_out splitting, and also
 * breaks 「和/与/及」so a packed answer still matches a single keyword.
 */
export function scopeOutNeedles(scopeOut: string): string[] {
  const out = new Set<string>();
  for (const term of scopeOutTerms(scopeOut)) {
    out.add(term);
    for (const part of term.split(/[和与及]/)) {
      const piece = part.trim();
      if (piece.length >= 2) out.add(piece);
    }
  }
  return [...out];
}

export function hitsScopeOut(text: string, scopeOut: string): boolean {
  const hay = text.trim().toLowerCase();
  if (!hay) return false;
  return scopeOutNeedles(scopeOut).some((term) => hay.includes(term.toLowerCase()));
}

export function topicHitsScopeOut(store: Store, topicId: string, text: string): boolean {
  const snapshot = snapshotFromRecords(store.listBoundaries(topicId));
  return hitsScopeOut(text, snapshot.scope_out);
}

export function learningRefuseReply(store: Store, topicId: string, currentTitle?: string | null): string {
  const snapshot = snapshotFromRecords(store.listBoundaries(topicId));
  const copy = refuseRedirectCopy({
    scopeIn: snapshot.scope_in,
    scopeOut: snapshot.scope_out,
  });
  const here = currentTitle?.trim() ? `当前节是「${currentTitle.trim()}」。` : "";
  return [copy.refuse, `${here}${copy.redirect}`].filter(Boolean).join("\n");
}
