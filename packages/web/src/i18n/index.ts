export type { Locale } from "./locale.ts";
export {
  DEFAULT_LOCALE,
  LOCALES,
  STORAGE_KEY,
  detectBrowserLocale,
  htmlLang,
  isLocale,
  readStoredLocale,
  writeStoredLocale,
} from "./locale.ts";
export type { MessageKey } from "./messages.ts";
export { messages } from "./messages.ts";
export type { TFunction, Vars } from "./translate.ts";
export { isMessageKey, translate } from "./translate.ts";
export { LocaleProvider, useLocale, useSetLocale, useT } from "./context.tsx";
export {
  chipLabel,
  composerPlaceholderText,
  dimLabel,
  fieldLabel,
  phaseText,
  strategyText,
  toolText,
} from "./helpers.ts";
export { localizedRefuseCopy } from "./refuse.ts";
