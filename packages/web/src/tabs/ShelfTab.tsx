import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { ExportFormat, OutlineNode, TopicSummary } from "@quantum/shared";
import { Archive, Upload } from "lucide-react";
import { Drawer } from "@/components/Drawer";
import { OutlineTree } from "@/components/OutlineTree";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { phaseText, useLocale, useT } from "@/i18n";
import { cn, formatTime } from "@/lib/utils";

export function ShelfTab({
  topic,
  topics,
  onImportHtml,
  onSwitch,
  onExport,
  onArchive,
  importing,
}: {
  topic: TopicSummary | null;
  topics: TopicSummary[];
  onImportHtml: (html: string, title?: string) => Promise<void> | void;
  onSwitch: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
  onArchive: (id: string) => Promise<void> | void;
  importing?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [exportId, setExportId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pasteHtml, setPasteHtml] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOutline, setPreviewOutline] = useState<OutlineNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewTopic = topics.find((item) => item.id === previewId) ?? null;

  useEffect(() => {
    if (!previewId) {
      setPreviewOutline([]);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void api
      .topic(previewId)
      .then((detail) => {
        if (!cancelled) setPreviewOutline(detail.outline);
      })
      .catch(() => {
        if (!cancelled) setPreviewOutline([]);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewId]);

  async function submitPaste() {
    setImportError(null);
    const html = pasteHtml.trim();
    if (!html) {
      setImportError(t("shelf.importNeedHtml"));
      return;
    }
    try {
      await onImportHtml(html, pasteTitle.trim() || undefined);
      setPasteHtml("");
      setPasteTitle("");
      setImportOpen(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t("shelf.importFailed"));
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setImportError(null);
    try {
      const html = await file.text();
      const title = file.name.replace(/\.html?$/i, "") || undefined;
      await onImportHtml(html, title);
      setImportOpen(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t("shelf.importFailed"));
    }
  }

  function stop(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 shelf-atmosphere" aria-hidden />
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden" data-testid="shelf-stage">
        <div className="quantum-scroll h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
          <div
            data-testid="shelf-grid"
            className="grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16.5rem),1fr))]"
          >
            <button
              type="button"
              data-testid="shelf-import-open"
              onClick={() => setImportOpen(true)}
              className="shelf-card-enter group relative min-h-[11rem] overflow-hidden rounded-2xl border border-dashed border-cinnabar/40 bg-paper-deep/55 px-5 py-5 text-left transition-[border-color,transform,background-color] duration-300 hover:-translate-y-0.5 hover:border-cinnabar/70 hover:bg-paper-deep/85"
            >
              <span className="inline-flex rounded-lg bg-cinnabar/10 p-2 text-cinnabar transition-transform duration-300 group-hover:scale-105">
                <Upload className="h-5 w-5" />
              </span>
              <div className="mt-4 font-serif text-lg text-cinnabar">{t("shelf.importTitle")}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">{t("shelf.importHint")}</p>
            </button>

            {topics.map((item, index) => (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                data-testid="shelf-book-card"
                data-current={topic?.id === item.id ? "true" : "false"}
                className={cn(
                  "shelf-card-enter group relative flex min-h-[11rem] cursor-pointer flex-col rounded-2xl border bg-white/45 px-4 py-4 text-left backdrop-blur-[2px] transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-cinnabar/35 hover:shadow-[0_12px_28px_#2b2a2610]",
                  topic?.id === item.id ? "border-cinnabar/40" : "border-paper-line",
                )}
                style={{ animationDelay: `${Math.min(index + 1, 8) * 35}ms` }}
                onClick={() => setPreviewId(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewId(item.id);
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-cinnabar/80">
                    {topic?.id === item.id ? t("shelf.currentBadge") : t("shelf.brand")}
                  </p>
                  <h2 className="mt-2 font-serif text-[1.2rem] leading-snug tracking-tight">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-xs text-paper-muted">
                    {phaseText(item.phase, t)} · {formatTime(item.updatedAt, locale)}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 border-t border-paper-line/80 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-cinnabar"
                    data-testid="shelf-switch"
                    onClick={(e) => {
                      stop(e);
                      onSwitch(item.id);
                    }}
                  >
                    {t("shelf.switch")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    data-testid="shelf-export"
                    onClick={(e) => {
                      stop(e);
                      setExportId(item.id);
                    }}
                  >
                    {t("shelf.export")}
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-paper-muted hover:text-cinnabar"
                    data-testid="shelf-archive"
                    aria-label={t("shelf.archive")}
                    onClick={(e) => {
                      stop(e);
                      setArchiveId(item.id);
                    }}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {topics.length === 0 ? (
            <p className="mt-8 text-center text-sm text-paper-muted" data-testid="shelf-empty">
              {t("shelf.noBooks")}
            </p>
          ) : null}
        </div>
      </div>

      <Drawer
        contained
        open={Boolean(previewId)}
        side="right"
        title={previewTopic?.title ?? t("shelf.outlinePreview")}
        onClose={() => setPreviewId(null)}
      >
        <div className="flex h-full min-h-0 flex-col" data-testid="shelf-outline-drawer">
          <div className="border-b border-paper-line px-3 py-3">
            <p className="text-xs text-paper-muted">{t("shelf.outlinePreview")}</p>
            <Button
              className="mt-3 w-full"
              data-testid="shelf-preview-switch"
              onClick={() => {
                if (!previewId) return;
                const id = previewId;
                setPreviewId(null);
                onSwitch(id);
              }}
            >
              {t("shelf.switchToLearn")}
            </Button>
          </div>
          <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto">
            {previewLoading ? (
              <p className="px-4 py-6 text-sm text-paper-muted">{t("shelf.importing")}</p>
            ) : (
              <OutlineTree nodes={previewOutline} currentId={null} onSelect={() => {}} />
            )}
          </div>
        </div>
      </Drawer>

      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent title={t("shelf.importTitle")}>
          <p className="text-sm text-paper-muted">{t("shelf.importDialogHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              data-testid="shelf-import-file"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {t("shelf.chooseFile")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".html,text/html"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="mt-4 block text-xs font-medium text-paper-muted">
            {t("shelf.pasteTitle")}
            <input
              data-testid="shelf-import-title"
              className="mt-1 w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-paper-ink"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder={t("shelf.pasteTitlePlaceholder")}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-paper-muted">
            {t("shelf.pasteHtml")}
            <Textarea
              data-testid="shelf-import-html"
              className="mt-1 min-h-36 font-mono text-xs"
              value={pasteHtml}
              onChange={(e) => setPasteHtml(e.target.value)}
              placeholder="<html>…</html>"
            />
          </label>
          {importError ? (
            <p className="mt-2 text-xs text-cinnabar" data-testid="shelf-import-error">
              {importError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              {t("shelf.cancel")}
            </Button>
            <Button data-testid="shelf-import-submit" disabled={importing} onClick={() => void submitPaste()}>
              {importing ? t("shelf.importing") : t("shelf.importSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(exportId)} onOpenChange={(o) => !o && setExportId(null)}>
        <DialogContent title={t("shelf.exportTitle")}>
          <p className="text-sm text-paper-muted">{t("shelf.exportHint")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["md", "html", "epub"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                onClick={() => {
                  if (exportId) onExport(exportId, format);
                  setExportId(null);
                }}
              >
                {format}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveId)} onOpenChange={(o) => !o && setArchiveId(null)}>
        <DialogContent title={t("shelf.archiveConfirmTitle")}>
          <p className="text-sm text-paper-muted">{t("shelf.archiveConfirmBody")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setArchiveId(null)}>
              {t("shelf.cancel")}
            </Button>
            <Button
              data-testid="shelf-archive-confirm"
              onClick={() => {
                if (!archiveId) return;
                const id = archiveId;
                setArchiveId(null);
                void onArchive(id);
              }}
            >
              {t("shelf.archiveConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
