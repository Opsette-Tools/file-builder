/**
 * Lightweight file-type detection for the bundler's type badge. Not exhaustive —
 * just enough to label a row ("PDF", "PNG", "HTML"…) so a user can confirm the
 * tool knows what they dropped. Falls back to the uppercased extension, then to
 * a generic "FILE".
 */

const EXT_LABELS: Record<string, string> = {
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  webp: "WebP",
  gif: "GIF",
  svg: "SVG",
  ico: "ICO",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  js: "JS",
  json: "JSON",
  txt: "TXT",
  md: "MD",
  csv: "CSV",
  zip: "ZIP",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  ppt: "PPT",
  pptx: "PPTX",
  mp4: "MP4",
  mov: "MOV",
  mp3: "MP3",
  wav: "WAV",
  woff: "FONT",
  woff2: "FONT",
  ttf: "FONT",
  otf: "FONT",
};

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** A short, human badge for a file. Prefers extension, then MIME family. */
export function typeBadge(name: string, mime: string): string {
  const ext = extOf(name);
  if (ext && EXT_LABELS[ext]) return EXT_LABELS[ext];
  if (ext) return ext.toUpperCase();
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("text/")) return "TEXT";
  return "FILE";
}

/** Broad category for coloring the badge (image / doc / other). */
export function typeKind(name: string, mime: string): "image" | "doc" | "other" {
  const ext = extOf(name);
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(ext) || mime.startsWith("image/")) {
    return "image";
  }
  if (["pdf", "html", "htm", "doc", "docx", "txt", "md", "csv"].includes(ext)) return "doc";
  return "other";
}

/**
 * How a file should be RENDERED in the preview gallery — a finer distinction than
 * `typeKind` (which only colors a badge). Each value maps to one branch of the
 * FilePreview renderer:
 *   - "image": raster/vector the browser draws natively via an <img> object-URL.
 *   - "pdf":   first page rendered to pixels through pdf.js.
 *   - "html":  a true visual render inside a locked-down (scriptless) <iframe>.
 *   - "text":  plain-text-ish content shown in a mono block (txt/md/csv/json/…,
 *              and .vcf, which is just plain text so it previews for free).
 *   - "none":  can't be rendered in-browser without heavy tooling (fonts, video,
 *              audio, office docs, archives) — shown as an icon placeholder.
 */
export type PreviewKind = "image" | "pdf" | "html" | "text" | "none";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "bmp", "avif"];
// Note: .vcf (and .ics) are technically plain text, but they render as raw
// "BEGIN:VCARD…" field soup — not a meaningful preview — so they're deliberately
// left OUT here and fall through to the clean icon placeholder instead.
const TEXT_EXTS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "js", "mjs", "cjs", "ts",
  "jsx", "tsx", "css", "scss", "less", "xml", "yml", "yaml",
  "log", "env", "toml", "ini", "srt",
];

/** Classify a file into a single rendering strategy for the preview gallery. */
export function previewKind(name: string, mime: string): PreviewKind {
  const ext = extOf(name);
  // vCard/iCal are plain text but preview as unreadable field soup — always send
  // them to the icon placeholder, even if the browser tags them text/*.
  if (ext === "vcf" || ext === "ics" || mime === "text/vcard" || mime === "text/calendar") {
    return "none";
  }
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (IMAGE_EXTS.includes(ext) || (mime.startsWith("image/") && mime !== "image/svg+xml") || mime === "image/svg+xml") {
    return "image";
  }
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (TEXT_EXTS.includes(ext) || mime.startsWith("text/") || mime === "application/json") {
    return "text";
  }
  return "none";
}
