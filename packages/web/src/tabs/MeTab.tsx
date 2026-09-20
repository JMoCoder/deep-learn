import { useEffect, useState, type FormEvent } from "react";
import type { PublicSettings, TopicSummary } from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useLocale, useSetLocale, useT } from "@/i18n";
import { cn, formatTime } from "@/lib/utils";

export function MeTab({
  settings,
  onSave,
  onUnarchive,
  onDeleteArchived,
}: {
  settings: PublicSettings;
  onSave: (next: {
    provider: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
    clearApiKey?: boolean;
  }) => Promise<void>;
  onUnarchive: (id: string) => Promise<void>;
  onDeleteArchived: (id: string) => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState<TopicSummary[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refreshArchived() {
    try {
      setArchived(await api.archivedTopics());
    } catch {
      setArchived([]);
    }
  }

  useEffect(() => {
    void refreshArchived();
  }, []);

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
      setSaved(t("me.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("me.saveFailed"));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div data-testid="me-body" className="w-full space-y-10">
          <header>
            <h1 className="font-serif text-2xl tracking-tight">{t("me.title")}</h1>
            <p className="mt-2 text-sm text-paper-muted">{t("me.lead")}</p>
          </header>

          <section className="space-y-3" data-testid="me-columns">
            <h2 className="font-serif text-lg">{t("me.columns")}</h2>
            <p className="text-sm text-paper-muted">{t("me.columnsLead")}</p>
            {archived.length === 0 ? (
              <p className="text-sm text-paper-muted" data-testid="me-columns-empty">
                {t("me.columnsEmpty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {archived.map((item) => (
                  <li
                    key={item.id}
                    data-testid="me-archived-card"
                    className="rounded-xl border border-paper-line bg-paper-deep/40 px-4 py-3"
                  >
                    <div className="font-medium">{item.title}</div>
                    <p className="mt-1 text-xs text-paper-muted">
                      {formatTime(item.updatedAt, locale)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="me-unarchive"
                        onClick={() => void onUnarchive(item.id).then(() => refreshArchived())}
                      >
                        {t("me.unarchive")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="me-delete"
                        className="text-cinnabar"
                        onClick={() => setDeleteId(item.id)}
                      >
                        {t("me.deleteForever")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg">{t("me.language")}</h2>
            <p className="text-sm text-paper-muted">{t("me.languageHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="locale-zh"
                variant={locale === "zh" ? "default" : "outline"}
                onClick={() => setLocale("zh")}
              >
                {t("me.languageZh")}
              </Button>
              <Button
                type="button"
                data-testid="locale-en"
                variant={locale === "en" ? "default" : "outline"}
                onClick={() => setLocale("en")}
              >
                {t("me.languageEn")}
              </Button>
            </div>
          </section>

          <form onSubmit={submit} className="space-y-3">
            <h2 className="font-serif text-lg">{t("me.model")}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("me.provider")} name="provider" defaultValue={settings.provider} />
              <Field label={t("me.modelId")} name="modelId" defaultValue={settings.modelId} />
              <Field
                label={t("me.baseUrl")}
                name="baseUrl"
                defaultValue={settings.baseUrl}
                placeholder={t("me.baseUrlPlaceholder")}
                className="md:col-span-2"
              />
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="apiKey">
                  {settings.hasApiKey ? t("me.apiKeyConfigured") : t("me.apiKeyMissing")}
                </Label>
                <Input id="apiKey" name="apiKey" type="password" autoComplete="off" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-paper-muted">
              <input type="checkbox" name="clearApiKey" />
              {t("me.clearKey")}
            </label>
            {saved ? <p className="text-sm text-pine">{saved}</p> : null}
            {error ? <p className="text-sm text-cinnabar">{error}</p> : null}
            <Button type="submit">{t("me.save")}</Button>
          </form>
        </div>
      </div>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent title={t("me.deleteConfirmTitle")}>
          <p className="text-sm text-paper-muted">{t("me.deleteConfirmBody")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              {t("shelf.cancel")}
            </Button>
            <Button
              data-testid="me-delete-confirm"
              onClick={() => {
                if (!deleteId) return;
                const id = deleteId;
                setDeleteId(null);
                void onDeleteArchived(id).then(() => refreshArchived());
              }}
            >
              {t("me.deleteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
