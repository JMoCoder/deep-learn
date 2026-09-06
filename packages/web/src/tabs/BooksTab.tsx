import { useState } from "react";
import { Library } from "lucide-react";
import type { ExportFormat, NoteRecord, SectionRecord, TopicSummary } from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatTime, phaseLabel } from "@/lib/utils";

export function BooksTab({
  topic,
  section,
  notes,
  topics,
  drawerOpen,
  onDrawerOpen,
  onCreate,
  onSwitch,
  onExport,
}: {
  topic: TopicSummary | null;
  section: SectionRecord | null;
  notes: NoteRecord[];
  topics: TopicSummary[];
  drawerOpen: boolean;
  onDrawerOpen: (open: boolean) => void;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
}) {
  const [exportId, setExportId] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-paper-line px-4 py-3">
        <h1 className="font-serif text-lg">书籍</h1>
        <Button variant="ghost" size="icon" aria-label="打开主题" onClick={() => onDrawerOpen(true)}>
          <Library className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {!topic ? (
          <p className="mx-auto max-w-md py-16 text-center text-sm text-paper-muted">
            当前没有主题。从右侧抽屉新建一个，向导会开始边界访谈。
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            <section>
              <p className="text-xs text-paper-muted">
                {phaseLabel(topic.phase)}
                {topic.exportState !== "idle" ? ` · 导出 ${topic.exportState}` : ""}
              </p>
              <h2 className="mt-1 font-serif text-2xl">{topic.title}</h2>
              {section ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-paper-ink/90">
                  {section.bodyMd.slice(0, 800)}
                  {section.bodyMd.length > 800 ? "…" : ""}
                </p>
              ) : (
                <p className="mt-4 text-sm text-paper-muted">这一主题还没有投影正文。</p>
              )}
            </section>
            <section>
              <h3 className="font-serif text-base">笔记</h3>
              <p className="mt-1 text-xs text-paper-muted">
                只由助手通过 append_note 写入。这里没有「记一笔」。
              </p>
              {notes.length === 0 ? (
                <p className="mt-3 text-sm text-paper-muted">还没有笔记。</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-paper-line bg-paper-deep/50 px-3 py-2 text-sm">
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-paper-muted">{formatTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} side="right" title="主题" onClose={() => onDrawerOpen(false)}>
        <div className="space-y-3 p-3">
          <button
            type="button"
            onClick={() => {
              onCreate();
              onDrawerOpen(false);
            }}
            className="w-full rounded-lg border border-dashed border-cinnabar/40 bg-paper-deep px-3 py-4 text-left"
          >
            <div className="font-serif text-base text-cinnabar">新建主题</div>
            <p className="mt-1 text-xs text-paper-muted">设为当前主题，并从边界访谈开始。</p>
          </button>
          {topics.map((item) => (
            <article key={item.id} className="rounded-lg border border-paper-line p-3">
              <div className="font-medium">{item.title}</div>
              <p className="mt-1 text-xs text-paper-muted">
                {phaseLabel(item.phase)} · {formatTime(item.updatedAt)}
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
                  切换
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setExportId(item.id)}>
                  导出
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Drawer>

      <Dialog open={Boolean(exportId)} onOpenChange={(o) => !o && setExportId(null)}>
        <DialogContent title="导出主题">
          <p className="text-sm text-paper-muted">
            由工具 export_topic 生成，格式 md / html / epub。完成后可从会话或下载链接取回。
          </p>
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
