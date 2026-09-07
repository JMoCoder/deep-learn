import { refuseRedirectCopy } from "@quantum/shared";
import { snapshotFromRecords } from "./boundary-snapshot.js";
import { scopeOutTerms } from "./outline-constraints.js";
import type { Store } from "../store/repos.js";

const EMPTY_SCOPE = /^(没有|无|none|n\/a)$/i;
const EXCLUDE_PREFIX = /^(坚决)?(不碰|不要|不讲|不学|不看|排除|别讲|别碰|绕开|先不)[:：\s]*/;
const EXCLUDE_SUFFIX = /(那些|方向|相关|部分|内容|专题)$/;

/**
 * Chat-side needles. Reuses outline scope_out splitting, and also
 * breaks 「和/与/及」so a packed answer still matches a single keyword.
 * Strips 排除/不碰 prefixes so 「排除弦论」 still hits user text that only says 弦论.
 */
export function scopeOutNeedles(scopeOut: string): string[] {
  const out = new Set<string>();
  for (const term of scopeOutTerms(scopeOut)) {
    addNeedle(out, term);
    for (const part of term.split(/[和与及]/)) addNeedle(out, part);
  }
  return [...out];
}

function addNeedle(out: Set<string>, raw: string): void {
  const piece = raw.trim().replace(/^[。.!！?？,，、;；:："'“”]+|[。.!！?？,，、;；:："'“”]+$/g, "");
  if (piece.length < 2 || EMPTY_SCOPE.test(piece)) return;
  out.add(piece);
  let stripped = piece.replace(EXCLUDE_PREFIX, "").trim();
  stripped = stripped.replace(EXCLUDE_SUFFIX, "").trim();
  stripped = stripped.replace(/^[。.!！?？,，、;；:："'“”]+|[。.!！?？,，、;；:："'“”]+$/g, "");
  if (stripped.length >= 2 && !EMPTY_SCOPE.test(stripped)) out.add(stripped);
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
