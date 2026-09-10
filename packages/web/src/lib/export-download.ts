export type ExportResponse = {
  ok?: boolean;
  format?: string;
  filename?: string;
  downloadPath?: string;
  error?: string;
};

/** Fake-green: ok:true without a real /api/exports/ path is not a download. */
export function exportDownloadPath(result: ExportResponse): string | null {
  if (!result.ok) return null;
  const path = result.downloadPath?.trim() ?? "";
  if (!path.startsWith("/api/exports/")) return null;
  if (path.includes("..")) return null;
  return path;
}

export function triggerExportDownload(path: string, filename?: string): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = path;
  if (filename) link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
