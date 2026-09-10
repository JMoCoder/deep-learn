import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import JSZip from "jszip";
import type { ExportFormat, ExportResult } from "@quantum/shared";
import { digestBoundaries } from "../learning/boundary-interview.js";
import { flattenOutline, type Store } from "../store/repos.js";
import { resolveExportFile } from "./safe-path.js";

export async function exportTopic(
  store: Store,
  topicId: string,
  format: ExportFormat,
): Promise<ExportResult> {
  const topic = store.requireTopic(topicId);
  const boundaries = store.listBoundaries(topicId);
  const outline = store.getOutline(topicId);
  const notes = store.listNotes(topicId);
  const sections = flattenOutline(outline)
    .map((node) => store.getSectionByOutline(node.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const md = [
    `# ${topic.title}`,
    "",
    `阶段：${topic.phase}`,
    "",
    "## 边界",
    digestBoundaries(boundaries),
    "",
    "## 大纲",
    ...flattenOutline(outline).map((n) => `- ${n.parentId ? "  " : ""}${n.title} — ${n.intent}`),
    "",
    "## 正文",
    ...sections.flatMap((s) => [`### ${s.title}`, "", s.bodyMd, ""]),
    "## 笔记（仅 append_note）",
    notes.length === 0
      ? "（无）"
      : notes.map((n) => `- [${n.type}/${n.reasonCode}] ${n.body}`).join("\n"),
    "",
  ].join("\n");

  const filename =
    format === "md" ? `${topicId}.md` : format === "html" ? `${topicId}.html` : `${topicId}.epub`;
  const abs = resolveExportFile(topicId, filename);
  if (!abs) throw new Error("export path escaped exports root");
  mkdirSync(dirname(abs), { recursive: true });

  if (format === "md") {
    writeFileSync(abs, md, "utf8");
    assertRealExportFile(abs, "md");
  } else if (format === "html") {
    writeFileSync(abs, wrapHtml(topic.title, md), "utf8");
    assertRealExportFile(abs, "html");
  } else {
    const zip = await buildEpub(topic.title, md, sections.map((s) => ({ title: s.title, body: s.bodyMd })));
    writeFileSync(abs, zip);
    assertRealExportFile(abs, "epub");
  }

  return {
    format,
    filename,
    downloadPath: `/api/exports/${topicId}/${filename}`,
  };
}

/** Non-empty, recognizable artifact. Empty shells fail instead of fake-green. */
export function assertRealExportFile(abs: string, format: ExportFormat): void {
  const stat = statSync(abs);
  if (stat.size <= 0) throw new Error(`${format} export produced an empty file`);
  if (format === "md") {
    const text = readFileSync(abs, "utf8");
    if (!text.trim().startsWith("#")) throw new Error("md export is not usable markdown");
    return;
  }
  if (format === "html") {
    const html = readFileSync(abs, "utf8");
    if (!/<!doctype html>/i.test(html) || !/<body[\s>]/i.test(html) || !/<title>/.test(html)) {
      throw new Error("html export is not a real HTML file");
    }
    const visible = html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
    if (visible.length < 8) throw new Error("html export is an empty shell");
    return;
  }
  const buf = readFileSync(abs);
  if (buf.length < 64 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("epub export is not a real zip/epub file");
  }
}

function wrapHtml(title: string, md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeXml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.6;white-space:pre-wrap}</style>
</head><body><pre>${escaped}</pre></body></html>`;
}

async function buildEpub(
  title: string,
  _md: string,
  chapters: Array<{ title: string; body: string }>,
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")?.file(
    "container.xml",
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const oebps = zip.folder("OEBPS")!;
  const safeChapters = chapters.length > 0 ? chapters : [{ title, body: "（尚无正文）" }];
  const manifest = safeChapters
    .map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("");
  const spine = safeChapters.map((_, i) => `<itemref idref="c${i}"/>`).join("");
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">quantum-${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>${manifest}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest>
  <spine>${spine}</spine>
</package>`,
  );
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><nav><ol>${safeChapters
      .map((c, i) => `<li><a href="c${i}.xhtml">${escapeXml(c.title)}</a></li>`)
      .join("")}</ol></nav></body></html>`,
  );
  safeChapters.forEach((c, i) => {
    oebps.file(
      `c${i}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(c.title)}</title></head><body><h1>${escapeXml(c.title)}</h1><pre>${escapeXml(c.body)}</pre></body></html>`,
    );
  });
  return Buffer.from(await zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" }));
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
