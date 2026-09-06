import { useState, type FormEvent } from "react";
import type { HeatmapDay, PublicSettings } from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function MeTab({
  settings,
  heatmap,
  onSave,
}: {
  settings: PublicSettings;
  heatmap: HeatmapDay[];
  onSave: (next: {
    provider: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
    clearApiKey?: boolean;
  }) => Promise<void>;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const apiKey = String(data.get("apiKey") ?? "");
    const clear = data.get("clearApiKey") === "on";
    try {
      await onSave({
        provider: String(data.get("provider") ?? ""),
        modelId: String(data.get("modelId") ?? ""),
        baseUrl: String(data.get("baseUrl") ?? ""),
        apiKey: apiKey || undefined,
        clearApiKey: clear,
      });
      setSaved("已保存。密钥只留在服务器，不会写进日志或工具参数。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
      <div className="mx-auto max-w-lg space-y-10">
        <section>
          <h1 className="font-serif text-2xl">我的</h1>
          <p className="mt-2 text-sm text-paper-muted">模型代理与占位热力图。密钥不要贴到会话里。</p>
        </section>

        <form onSubmit={submit} className="space-y-3">
          <h2 className="font-serif text-lg">模型代理</h2>
          <Field label="Provider" name="provider" defaultValue={settings.provider} />
          <Field label="Model ID" name="modelId" defaultValue={settings.modelId} />
          <Field
            label="Base URL（可选，OpenAI 兼容代理）"
            name="baseUrl"
            defaultValue={settings.baseUrl}
            placeholder="https://…"
          />
          <div className="space-y-1">
            <Label htmlFor="apiKey">
              API Key {settings.hasApiKey ? "（已配置，留空则保持）" : "（未配置，走本地引导）"}
            </Label>
            <Input id="apiKey" name="apiKey" type="password" autoComplete="off" />
          </div>
          <label className="flex items-center gap-2 text-sm text-paper-muted">
            <input type="checkbox" name="clearApiKey" />
            清除已存密钥
          </label>
          {saved ? <p className="text-sm text-pine">{saved}</p> : null}
          {error ? <p className="text-sm text-cinnabar">{error}</p> : null}
          <Button type="submit">保存</Button>
        </form>

        <section>
          <h2 className="font-serif text-lg">学习热力图</h2>
          <p className="mt-1 text-xs text-paper-muted">
            占位。格子按学习活动粗记，不是间隔复习科学。详见 docs/cores.md。
          </p>
          <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
            {heatmap.map((d) => (
              <div
                key={d.date}
                title={`${d.date} · ${d.count}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-[2px]",
                  d.count === 0 && "bg-paper-line",
                  d.count === 1 && "bg-cinnabar-soft/50",
                  d.count >= 2 && d.count < 5 && "bg-cinnabar-soft",
                  d.count >= 5 && "bg-cinnabar",
                )}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
