import { useState, type ReactNode } from "react";
import { Library } from "lucide-react";
import type {
  BoundaryRecord,
  ExportFormat,
  NoteRecord,
  OutlineNode,
  SectionRecord,
  TopicSummary,
} from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { countOutlineLeaves } from "@/lib/session-display";
import { formatTime, phaseLabel } from "@/lib/utils";

export function BooksTab({
  topic,
  section,
  notes,
  outline,
  boundaries,
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
  outline: OutlineNode[];
  boundaries: BoundaryRecord[];
  topics: TopicSummary[];
  drawerOpen: boolean;
  onDrawerOpen: (open: boolean) => void;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
}) {
  const [exportId, setExportId] = useState<string | null>(null);
  const goal =
    boundaries.find((b) => b.kind === "goal_outcome" || b.kind === "goal")?.answer.trim() || "";
  const leaves = countOutlineLeaves(outline);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-paper-line px-3 py-3">
        <div className="flex items-stretch gap-2">
          <TopicHero topic={topic} goal={goal} noteCount={notes.length} leaves={leaves} />
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0"
            aria-label="打开主题抽屉"
            onClick={() => onDrawerOpen(true)}
          >
            <Library className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {!topic ? (
          <p className="mx-auto max-w-md py-10 text-center text-sm text-paper-muted">
            主题抽屉从右侧打开。笔记只由助手 append_note 写入。
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            <section>
              {section ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper-ink/90">
                  {section.bodyMd.slice(0, 800)}
                  {section.bodyMd.length > 800 ? "…" : ""}
                </p>
              ) : (
                <p className="text-sm text-paper-muted">这一主题还没有投影正文。</p>
              )}
            </section>
            <section>
              <h2 className="font-serif text-base">笔记</h2>
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
                      <p className="mt-1 text-[11px] text-paper-muted">
                        {n.type} · {n.reasonCode} · {formatTime(n.createdAt)}
                      </p>
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

function TopicHero({
  topic,
  goal,
  noteCount,
  leaves,
}: {
  topic: TopicSummary | null;
  goal: string;
  noteCount: number;
  leaves: { ready: number; total: number };
}) {
  return (
    <section className="hero-topic relative min-w-0 flex-1 overflow-hidden rounded-[1.35rem] border border-paper-line/90 px-4 py-4 pl-5">
      <span aria-hidden className="hero-accent" />
      <p className="text-[11px] font-semibold tracking-[0.18em] text-cinnabar">当前主题</p>
      {topic ? (
        <>
          <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">{topic.title}</h1>
          {goal ? (
            <p className="mt-2 line-clamp-2 text-sm text-paper-ink/80">{goal}</p>
          ) : (
            <p className="mt-2 text-sm text-paper-muted">边界未齐时，先打开学习页右上角会话。</p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaChip>
              章节 {leaves.ready}/{leaves.total || "—"}
            </MetaChip>
            <MetaChip>笔记 {noteCount}</MetaChip>
            <MetaChip>
              {phaseLabel(topic.phase)}
              {topic.exportState !== "idle" ? ` · 导出 ${topic.exportState}` : ""}
            </MetaChip>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-1.5 font-serif text-[1.65rem] leading-tight">还没有当前主题</h1>
          <p className="mt-2 text-sm text-paper-muted">点右侧打开主题抽屉，先「新建主题」。</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MetaChip>章节 —</MetaChip>
            <MetaChip>笔记 0</MetaChip>
            <MetaChip>未开始</MetaChip>
          </div>
        </>
      )}
    </section>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="meta-chip inline-flex items-center rounded-full border border-cinnabar/15 bg-white/55 px-2.5 py-0.5 text-[11px] text-paper-ink/80">
      {children}
    </span>
  );
}
