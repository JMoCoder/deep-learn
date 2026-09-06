import Markdown from "react-markdown";
import { List, Sparkles } from "lucide-react";
import type { OutlineNode, SectionRecord, SessionMessage, TopicSummary } from "@quantum/shared";
import { Drawer } from "@/components/Drawer";
import { OutlineTree } from "@/components/OutlineTree";
import { SessionPane } from "@/components/SessionPane";
import { Button } from "@/components/ui/button";

export function LearnTab({
  topic,
  section,
  outline,
  currentSectionId,
  outlineOpen,
  sessionOpen,
  onOutlineOpen,
  onSessionOpen,
  onSelectSection,
  messages,
  streaming,
  busy,
  coachMode,
  error,
  onSend,
}: {
  topic: TopicSummary | null;
  section: SectionRecord | null;
  outline: OutlineNode[];
  currentSectionId: string | null;
  outlineOpen: boolean;
  sessionOpen: boolean;
  onOutlineOpen: (open: boolean) => void;
  onSessionOpen: (open: boolean) => void;
  onSelectSection: (id: string) => void;
  messages: SessionMessage[];
  streaming: string;
  busy: boolean;
  coachMode: "stub" | "live";
  error: string | null;
  onSend: (text: string) => void;
}) {
  const center = topic
    ? `${topic.title}·${section?.title ?? "章节"}`
    : "主题·章节";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-paper-line px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="打开大纲"
          onClick={() => onOutlineOpen(true)}
        >
          <List className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-center font-serif text-[15px]">{center}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="打开会话"
          onClick={() => onSessionOpen(true)}
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {!topic ? (
          <Empty
            title="还没有当前主题"
            body="打开「书籍」，从右侧抽屉点「新建主题」。会话入口只在顶栏右侧，不会出现在正文里。"
          />
        ) : !section ? (
          <Empty
            title="正文尚未投影"
            body="大纲确定后，助手会把章节写到这里。若还在访谈，请点右上角继续对话。"
          />
        ) : (
          <article className="prose-quantum mx-auto max-w-2xl">
            <Markdown>{section.bodyMd}</Markdown>
          </article>
        )}
      </div>

      <Drawer
        open={outlineOpen}
        side="left"
        title="大纲"
        onClose={() => onOutlineOpen(false)}
      >
        <OutlineTree
          nodes={outline}
          currentId={currentSectionId}
          onSelect={(id) => {
            onSelectSection(id);
            onOutlineOpen(false);
          }}
        />
      </Drawer>

      <Drawer
        open={sessionOpen}
        side="right"
        title="学习会话"
        onClose={() => onSessionOpen(false)}
      >
        <SessionPane
          messages={messages}
          streaming={streaming}
          busy={busy}
          coachMode={coachMode}
          error={error}
          onSend={onSend}
        />
      </Drawer>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-muted">{body}</p>
    </div>
  );
}
