export type Locale = "zh" | "en";

export const LOCALES: readonly Locale[] = ["zh", "en"];
/** Fallback when the browser language is missing or neither zh nor en. */
export const DEFAULT_LOCALE: Locale = "zh";
export const STORAGE_KEY = "quantum.locale";

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

export function detectBrowserLocale(
  languages: readonly string[] | undefined = typeof navigator !== "undefined"
    ? [...(navigator.languages ?? []), navigator.language]
    : [],
): Locale {
  for (const raw of languages) {
    const lang = String(raw ?? "").toLowerCase();
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("zh")) return "zh";
  }
  return DEFAULT_LOCALE;
}

/** Stored preference wins; otherwise browser language; otherwise zh-CN. */
export function readStoredLocale(): Locale {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isLocale(raw)) return raw;
    }
  } catch {
    /* private mode / SSR */
  }
  return detectBrowserLocale();
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore quota */
  }
}

export function htmlLang(locale: Locale): string {
  return locale === "en" ? "en" : "zh-CN";
}
