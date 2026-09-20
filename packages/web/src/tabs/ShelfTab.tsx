import { useRef, useState } from "react";
import type { ExportFormat, TopicSummary } from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useWideLayout } from "@/lib/use-outline-rail";
import { phaseText, useLocale, useT } from "@/i18n";
import { cn, formatTime } from "@/lib/utils";
import { Library, Upload } from "lucide-react";

export function ShelfTab({
  topic,
  topics,
  drawerOpen,
  onDrawerOpen,
  onImportHtml,
  onSwitch,
  onExport,
  importing,
}: {
  topic: TopicSummary | null;
  topics: TopicSummary[];
  drawerOpen: boolean;
  onDrawerOpen: (open: boolean) => void;
  onImportHtml: (html: string, title?: string) => Promise<void> | void;
  onSwitch: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
  importing?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const wide = useWideLayout();
  const [exportId, setExportId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pasteHtml, setPasteHtml] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 shelf-atmosphere" aria-hidden />
      <header className={cn("relative z-10 border-b border-paper-line px-3", wide ? "py-2" : "py-3")}>
        <section
          data-testid="shelf-hero"
          data-layout={wide ? "wide" : "narrow"}
          className={cn(
            "hero-topic shelf-hero-enter relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[1.35rem] border border-paper-line/90 pl-5",
            wide ? "min-h-16 px-4 py-2" : "px-4 py-4",
          )}
        >
          <span aria-hidden className={cn("hero-accent", wide && "hero-accent--wide")} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cinnabar">
              {t("shelf.brand")}
            </p>
            <h1 className="mt-1 font-serif text-[1.45rem] leading-tight tracking-tight">
              {topic ? topic.title : t("shelf.emptyTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-paper-muted">
              {topic ? t("shelf.currentHint") : t("shelf.emptyHint")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="relative z-10 shrink-0 self-center"
            data-testid="open-shelf-drawer"
            aria-label={t("shelf.openDrawer")}
            onClick={() => onDrawerOpen(true)}
          >
            {t("shelf.manage")}
          </Button>
        </section>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden" data-testid="shelf-stage">
        <div className="quantum-scroll h-full min-h-0 overflow-y-auto px-5 py-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            <button
              type="button"
              data-testid="shelf-import-open"
              onClick={() => setImportOpen(true)}
              className="shelf-card-enter group relative w-full overflow-hidden rounded-2xl border border-dashed border-cinnabar/35 bg-paper-deep/50 px-5 py-6 text-left transition-[border-color,transform] duration-300 hover:border-cinnabar/70 hover:bg-paper-deep/80"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-cinnabar/10 p-2 text-cinnabar transition-transform duration-300 group-hover:scale-105">
                  <Upload className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-serif text-lg text-cinnabar">{t("shelf.importTitle")}</div>
                  <p className="mt-1 text-sm text-paper-muted">{t("shelf.importHint")}</p>
                </div>
              </div>
            </button>

            {topics.length === 0 ? (
              <p className="py-8 text-center text-sm text-paper-muted" data-testid="shelf-empty">
                {t("shelf.noBooks")}
              </p>
            ) : (
              <ul className="space-y-3" data-testid="shelf-list">
                {topics.map((item, index) => (
                  <li
                    key={item.id}
                    className="shelf-card-enter rounded-2xl border border-paper-line bg-white/40 px-4 py-3 backdrop-blur-[2px]"
                    style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                    data-testid="shelf-book-card"
                    data-current={topic?.id === item.id ? "true" : "false"}
                  >
                    <div className="flex items-start gap-3">
                      <Library className="mt-1 h-4 w-4 shrink-0 text-pine" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{item.title}</div>
                        <p className="mt-1 text-xs text-paper-muted">
                          {phaseText(item.phase, t)} · {formatTime(item.updatedAt, locale)}
                          {topic?.id === item.id ? ` · ${t("shelf.currentBadge")}` : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={topic?.id === item.id ? "pine" : "outline"}
                            data-testid="shelf-switch"
                            onClick={() => onSwitch(item.id)}
                          >
                            {t("shelf.switch")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExportId(item.id)}>
                            {t("shelf.export")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Drawer
        contained
        open={drawerOpen}
        side="right"
        title={t("shelf.drawerTitle")}
        onClose={() => onDrawerOpen(false)}
      >
        <div className="space-y-3 p-3">
          <button
            type="button"
            data-testid="shelf-drawer-import"
            onClick={() => {
              onDrawerOpen(false);
              setImportOpen(true);
            }}
            className="w-full rounded-lg border border-dashed border-cinnabar/40 bg-paper-deep px-3 py-4 text-left"
          >
            <div className="font-serif text-base text-cinnabar">{t("shelf.importTitle")}</div>
            <p className="mt-1 text-xs text-paper-muted">{t("shelf.importHint")}</p>
          </button>
          {topics.map((item) => (
            <article key={item.id} className="rounded-lg border border-paper-line p-3">
              <div className="font-medium">{item.title}</div>
              <p className="mt-1 text-xs text-paper-muted">
                {phaseText(item.phase, t)} · {formatTime(item.updatedAt, locale)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSwitch(item.id);
                    onDrawerOpen(false);
                  }}
                >
                  {t("shelf.switch")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setExportId(item.id)}>
                  {t("shelf.export")}
                </Button>
              </div>
            </article>
          ))}
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
    </div>
  );
}
