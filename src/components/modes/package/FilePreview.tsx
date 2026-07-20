import { useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import {
  FileOutlined,
  FontSizeOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileZipOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  IdcardOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { loadPdfDocument, renderPageToDataUrl } from "@/lib/pdfjs";
import { extOf, previewKind, type PreviewKind } from "./fileType";

/**
 * FilePreview — the reusable, per-file visual renderer that powers the bundle
 * preview gallery and lightbox. One component, one dispatch on `previewKind`, so
 * every surface that wants to *show* a bundled file reads from the same place
 * (globalize, don't hardcode). It renders lazily and revokes every object URL it
 * creates on unmount.
 *
 *   image → <img> object-URL (raster + SVG both draw natively)
 *   pdf   → first page rasterized by pdf.js
 *   html  → true render inside a scriptless sandboxed <iframe>
 *   text  → first chunk of decoded text in a mono block
 *   none  → a clean icon placeholder (fonts, media, office docs, archives)
 *
 * `variant` only changes sizing/limits: a "thumb" renders a compact, cheap
 * preview for the gallery grid; a "full" renders a larger, higher-fidelity one
 * for the zoomed lightbox.
 */

const PDF_THUMB_SCALE = 0.7;
const PDF_FULL_SCALE = 1.6;
const TEXT_THUMB_CHARS = 1200;
const TEXT_FULL_CHARS = 20000;

export function FilePreview({
  file,
  name,
  variant = "thumb",
}: {
  file: File;
  /** The output name (drives extension-based classification + placeholder). */
  name: string;
  variant?: "thumb" | "full";
}) {
  const kind = previewKind(name, file.type);
  return (
    <div className="fb-prev" data-variant={variant} data-kind={kind}>
      <PreviewBody file={file} name={name} kind={kind} variant={variant} />
    </div>
  );
}

function PreviewBody({
  file,
  name,
  kind,
  variant,
}: {
  file: File;
  name: string;
  kind: PreviewKind;
  variant: "thumb" | "full";
}) {
  switch (kind) {
    case "image":
      return <ImagePreview file={file} name={name} />;
    case "pdf":
      return <PdfPreview file={file} variant={variant} />;
    case "html":
      return <HtmlPreview file={file} name={name} variant={variant} />;
    case "text":
      return <TextPreview file={file} variant={variant} />;
    default:
      return <PlaceholderPreview name={name} mime={file.type} />;
  }
}

/* ------------------------------------------------------------------- shared */

function Loading() {
  return (
    <div className="fb-prev-loading">
      <Spin size="small" />
    </div>
  );
}

function Broken({ label }: { label: string }) {
  return (
    <div className="fb-prev-none">
      <FileOutlined className="fb-prev-none-icon" />
      <span className="fb-prev-none-label">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- image */

function ImagePreview({ file, name }: { file: File; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (failed) return <Broken label={`Couldn't preview ${name}`} />;
  if (!url) return <Loading />;
  return (
    <img
      className="fb-prev-img"
      src={url}
      alt={name}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/* ---------------------------------------------------------------------- pdf */

function PdfPreview({ file, variant }: { file: File; variant: "thumb" | "full" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadPdfDocument(buf);
        const scale = variant === "full" ? PDF_FULL_SCALE : PDF_THUMB_SCALE;
        const { url: u } = await renderPageToDataUrl(doc, 1, scale);
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        created = u;
        setUrl(u);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file, variant]);

  if (failed) return <Broken label="Couldn't render this PDF" />;
  if (!url) return <Loading />;
  return <img className="fb-prev-img" src={url} alt="PDF first page" draggable={false} />;
}

/* --------------------------------------------------------------------- html */

function HtmlPreview({
  file,
  name,
  variant,
}: {
  file: File;
  name: string;
  variant: "thumb" | "full";
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    file
      .text()
      .then((t) => {
        if (alive) setHtml(t);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [file]);

  if (failed) return <Broken label={`Couldn't read ${name}`} />;
  if (html === null) return <Loading />;

  // srcDoc + an empty sandbox: the markup renders visually, but scripts, forms,
  // popups, and same-origin access are all disabled — a preview can never run
  // code or reach anything. A thumb scales the page down so the whole layout is
  // visible in the small card; the full view renders at 1:1.
  return (
    <div className="fb-prev-html" data-variant={variant}>
      <iframe
        className="fb-prev-html-frame"
        title="HTML preview"
        sandbox=""
        srcDoc={html}
      />
    </div>
  );
}

/* --------------------------------------------------------------------- text */

function TextPreview({ file, variant }: { file: File; variant: "thumb" | "full" }) {
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const limit = variant === "full" ? TEXT_FULL_CHARS : TEXT_THUMB_CHARS;
    file
      .text()
      .then((t) => {
        if (!alive) return;
        setTruncated(t.length > limit);
        setText(t.slice(0, limit));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [file, variant]);

  if (failed) return <Broken label="Couldn't read this file" />;
  if (text === null) return <Loading />;
  return (
    <pre className="fb-prev-text" data-variant={variant}>
      {text}
      {truncated && <span className="fb-prev-text-more">…</span>}
    </pre>
  );
}

/* ------------------------------------------------------------- placeholder */

const PLACEHOLDER_ICONS: Record<string, React.ReactNode> = {
  woff: <FontSizeOutlined />,
  woff2: <FontSizeOutlined />,
  ttf: <FontSizeOutlined />,
  otf: <FontSizeOutlined />,
  zip: <FileZipOutlined />,
  rar: <FileZipOutlined />,
  "7z": <FileZipOutlined />,
  doc: <FileWordOutlined />,
  docx: <FileWordOutlined />,
  xls: <FileExcelOutlined />,
  xlsx: <FileExcelOutlined />,
  ppt: <FilePptOutlined />,
  pptx: <FilePptOutlined />,
  vcf: <IdcardOutlined />,
  ics: <CalendarOutlined />,
};

// A friendlier label than ".vcf file" for a few known kinds.
const PLACEHOLDER_LABELS: Record<string, string> = {
  vcf: "Contact card",
  ics: "Calendar file",
};

function placeholderIcon(ext: string, mime: string): React.ReactNode {
  if (PLACEHOLDER_ICONS[ext]) return PLACEHOLDER_ICONS[ext];
  if (mime.startsWith("video/")) return <VideoCameraOutlined />;
  if (mime.startsWith("audio/")) return <SoundOutlined />;
  return <FileOutlined />;
}

function PlaceholderPreview({ name, mime }: { name: string; mime: string }) {
  const ext = extOf(name);
  const label = PLACEHOLDER_LABELS[ext] ?? (ext ? `.${ext} file` : "File");
  return (
    <div className="fb-prev-none">
      <span className="fb-prev-none-icon">{placeholderIcon(ext, mime)}</span>
      <span className="fb-prev-none-label">{label}</span>
      <span className="fb-prev-none-sub">No inline preview</span>
    </div>
  );
}
