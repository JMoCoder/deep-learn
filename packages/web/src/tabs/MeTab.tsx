import { useState, type FormEvent } from "react";
import type { PublicSettings } from "@quantum/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useSetLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function MeTab({
  settings,
  onSave,
}: {
  settings: PublicSettings;
  onSave: (next: {
    provider: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
    clearApiKey?: boolean;
  }) => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
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
      setSaved(t("me.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("me.saveFailed"));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header data-testid="me-top-region" className="border-b border-paper-line px-5 py-4">
        <h1 className="font-serif text-2xl">{t("me.title")}</h1>
        <p className="mt-2 text-sm text-paper-muted">{t("me.lead")}</p>
      </header>

      <div className="quantum-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div data-testid="me-body" className="w-full space-y-10">
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
