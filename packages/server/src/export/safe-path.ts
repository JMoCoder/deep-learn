import { realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { config } from "../config.js";

/** Reject `..`, separators, absolute/drive paths, and empty segments. */
export function isSafeExportSegment(segment: string): boolean {
  if (!segment || segment !== segment.trim()) return false;
  if (segment.includes("\0")) return false;
  if (segment === "." || segment.includes("..")) return false;
  if (segment.includes("/") || segment.includes("\\")) return false;
  if (segment.startsWith("/") || /^[a-zA-Z]:/.test(segment)) return false;
  return true;
}

function isInsideRoot(abs: string, root: string): boolean {
  const normalizedAbs = resolve(abs);
  const normalizedRoot = resolve(root);
  return normalizedAbs === normalizedRoot || normalizedAbs.startsWith(normalizedRoot + sep);
}

export function exportsRoot(): string {
  return resolve(config.dataDir, "exports");
}

/**
 * Resolve a file under the exports root. After normalize/realpath the path
 * must remain inside that root. Returns null when the segments are unsafe
 * or the resolved/real path would escape.
 */
export function resolveExportFile(topicId: string, filename: string): string | null {
  if (!isSafeExportSegment(topicId) || !isSafeExportSegment(filename)) return null;
  const root = exportsRoot();
  let realRoot = root;
  try {
    realRoot = realpathSync(root);
  } catch {
    /* exports dir is created at boot; if missing, fall back to resolved root */
  }
  const abs = resolve(realRoot, topicId, filename);
  if (!isInsideRoot(abs, realRoot)) return null;
  try {
    const realFile = realpathSync(abs);
    if (!isInsideRoot(realFile, realRoot)) return null;
    return realFile;
  } catch {
    return abs;
  }
}
