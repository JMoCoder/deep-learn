import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { htmlLang, readStoredLocale, writeStoredLocale, type Locale } from "./locale.ts";
import { translate, type TFunction, type Vars } from "./translate.ts";
import type { MessageKey } from "./messages.ts";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = htmlLang(locale);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", translate(locale, "meta.description"));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const setLocale = (next: Locale) => {
      writeStoredLocale(next);
      setLocaleState(next);
    };
    return {
      locale,
      setLocale,
      t: (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? readStoredLocale();
}

export function useSetLocale(): (next: Locale) => void {
  const ctx = useContext(LocaleContext);
  return ctx?.setLocale ?? writeStoredLocale;
}

export function useT(): TFunction {
  const ctx = useContext(LocaleContext);
  const locale = ctx?.locale ?? readStoredLocale();
  const provided = ctx?.t;
  return useMemo(
    () => provided ?? ((key: MessageKey, vars?: Vars) => translate(locale, key, vars)),
    [provided, locale],
  );
}
