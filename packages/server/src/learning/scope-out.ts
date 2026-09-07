import { refuseRedirectCopy } from "@quantum/shared";
import { snapshotFromRecords } from "./boundary-snapshot.js";
import { scopeOutTerms } from "./outline-constraints.js";
import type { Store } from "../store/repos.js";

const EMPTY_SCOPE = /^(没有|无|none|n\/a)$/i;
const STOP_TOKEN = /^(坚决|不碰|不要|不讲|不学|不看|排除|别讲|别碰|绕开|先不|那些|方向|相关|部分|内容|专题|什么)$/;
const PEEL =
  /^(坚决)?(不碰|不要|不讲|不学|不看|排除|别讲|别碰|绕开|先不|什么)[:：?\s？、，,]*/;

/**
 * Topic-word needles. 「坚决不碰弦论」/「排除：弦论」→「弦论」.
 * Also keeps the raw phrase so a full-string user echo still matches.
 */
export function scopeOutNeedles(scopeOut: string): string[] {
  const out = new Set<string>();
  for (const term of scopeOutTerms(scopeOut)) {
    addNeedle(out, term);
    for (const part of term.split(/[和与及]/)) addNeedle(out, part);
  }
  return [...out];
}

function trimPunct(raw: string): string {
  return raw.trim().replace(/^[。.!！?？,，、;；:："'“”]+|[。.!！?？,，、;；:："'“”]+$/g, "");
}

function peelStopwords(raw: string): string {
  let text = trimPunct(raw);
  for (let i = 0; i < 8; i += 1) {
    const next = trimPunct(text.replace(PEEL, ""));
    if (next === text) break;
    text = next;
  }
  return text;
}

function addNeedle(out: Set<string>, raw: string): void {
  const piece = trimPunct(raw);
  if (piece.length < 2 || EMPTY_SCOPE.test(piece)) return;
  out.add(piece);
  const peeled = peelStopwords(piece);
  if (peeled.length >= 2 && !EMPTY_SCOPE.test(peeled) && !STOP_TOKEN.test(peeled)) {
    out.add(peeled);
  }
  for (const match of piece.matchAll(/排除[:：]\s*([^；;\n]+)/g)) {
    const labeled = trimPunct(match[1] ?? "");
    if (labeled.length >= 2 && !EMPTY_SCOPE.test(labeled)) out.add(labeled);
  }
  for (const run of piece.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    const token = peelStopwords(run);
    if (token.length >= 2 && !EMPTY_SCOPE.test(token) && !STOP_TOKEN.test(token)) {
      out.add(token);
    }
  }
}

export function hitsScopeOut(text: string, scopeOut: string): boolean {
  const hay = text.trim().toLowerCase();
  if (!hay) return false;
  return scopeOutNeedles(scopeOut).some((term) => hay.includes(term.toLowerCase()));
}

/** Prefer packed snapshot.scope_out; also scan raw constraint / scope_out answers. */
export function topicHitsScopeOut(store: Store, topicId: string, text: string): boolean {
  const rows = store.listBoundaries(topicId);
  const snapshot = snapshotFromRecords(rows);
  const blobs = new Set<string>([snapshot.scope_out]);
  for (const row of rows) {
    if (row.kind === "constraint" || row.kind === "scope_out") blobs.add(row.answer);
  }
  return [...blobs].some((blob) => hitsScopeOut(text, blob));
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
