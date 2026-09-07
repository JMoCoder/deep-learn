import type { Locale } from "./locale.ts";
import { messages, type MessageKey } from "./messages.ts";

export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const table = messages[locale] ?? messages.zh;
  let out = table[key] ?? messages.zh[key] ?? String(key);
  if (!vars) return out;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

export function isMessageKey(key: string): key is MessageKey {
  return key in messages.zh;
}
