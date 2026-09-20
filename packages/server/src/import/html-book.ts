import type { OutlineDraftNode, TopicSummary } from "@quantum/shared";
import { flattenOutline, type Store } from "../store/repos.js";

export type HtmlBookSection = {
  title: string;
  bodyMd: string;
};

export type ParsedHtmlBook = {
  title: string;
  sections: HtmlBookSection[];
};

const MAX_HTML_CHARS = 2_000_000;

/** Strip tags and decode a few common entities for readable markdown-ish body. */
export function htmlFragmentToMd(fragment: string): string {
  let text = fragment
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|header|footer|main|ul|ol|table|thead|tbody|tr)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function extractTitle(html: string, fallback: string): string {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag?.[1]) {
    const t = htmlFragmentToMd(titleTag[1]).trim();
    if (t) return t.slice(0, 200);
  }
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const t = htmlFragmentToMd(h1[1]).trim();
    if (t) return t.slice(0, 200);
  }
  return fallback;
}

function bodyInner(html: string): string {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body?.[1] ?? html;
}

/**
 * Split an HTML document into titled sections by h1/h2.
 * Fallback: one section from the whole body when no headings exist.
 */
export function parseHtmlBook(html: string, titleHint?: string): ParsedHtmlBook {
  if (html.length > MAX_HTML_CHARS) {
    throw new Error(`HTML too large (max ${MAX_HTML_CHARS} chars)`);
  }
  const title = (titleHint?.trim() || extractTitle(html, "Imported book")).slice(0, 200);
  const inner = bodyInner(html);
  const headingRe = /<(h[12])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = [...inner.matchAll(headingRe)];
  if (matches.length === 0) {
    const body = htmlFragmentToMd(inner);
    return {
      title,
      sections: [{ title: title, bodyMd: body || "_(empty document)_" }],
    };
  }

  const sections: HtmlBookSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? inner.length) : inner.length;
    const heading = htmlFragmentToMd(match[2] ?? "").trim() || `Section ${i + 1}`;
    const body = htmlFragmentToMd(inner.slice(start, end));
    sections.push({ title: heading.slice(0, 200), bodyMd: body || "_(empty section)_" });
  }
  return { title, sections };
}

export function importHtmlBook(
  store: Store,
  html: string,
  titleHint?: string,
): { topic: TopicSummary; sectionCount: number } {
  const parsed = parseHtmlBook(html, titleHint);
  const topic = store.createTopic(parsed.title);
  const nodes: OutlineDraftNode[] = parsed.sections.map((s, index) => ({
    title: s.title,
    intent: index === 0 ? "imported" : "chapter",
    objective: s.title,
    target_chars: Math.max(s.bodyMd.length, 1),
  }));
  store.replaceOutline(topic.id, parsed.title, nodes, "finalized");
  const outline = store.finalizeOutline(topic.id, parsed.title);
  const leaves = flattenOutline(outline).filter((n) => n.children.length === 0);
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    const section = parsed.sections[i] ?? parsed.sections[parsed.sections.length - 1]!;
    store.upsertSection(topic.id, leaf.id, section.title, section.bodyMd);
  }
  store.setTopicGates(topic.id, { boundaryConfirmed: true, boundaryFinalized: true });
  return { topic: store.requireTopic(topic.id), sectionCount: leaves.length };
}
