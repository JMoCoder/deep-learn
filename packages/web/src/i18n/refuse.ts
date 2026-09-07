import { refuseRedirectCopy } from "@quantum/shared";
import type { Locale } from "./locale.ts";
import { translate } from "./translate.ts";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** PWA chrome for refuse+redirect. Agent `text` is kept as-is (follows user language). */
export function localizedRefuseCopy(
  locale: Locale,
  input: { scopeIn?: string; scopeOut?: string; text?: string },
): { title: string; refuse: string; redirect: string } {
  if (locale === "zh") return refuseRedirectCopy(input);
  const scopeIn = input.scopeIn?.trim();
  const scopeOut = input.scopeOut?.trim();
  const refuse = input.text?.trim()
    ? clip(input.text.trim(), 160)
    : scopeOut
      ? translate(locale, "refuse.scopeOut", { scope: clip(scopeOut, 40) })
      : translate(locale, "refuse.fallback");
  const redirect = scopeIn
    ? translate(locale, "refuse.redirectScope", { scope: clip(scopeIn, 80) })
    : translate(locale, "refuse.redirectDefault");
  return { title: translate(locale, "refuse.title"), refuse, redirect };
}
