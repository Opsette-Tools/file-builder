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
