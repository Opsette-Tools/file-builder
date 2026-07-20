import * as pdfjs from "pdfjs-dist";
// Vite resolves this `?url` import to the emitted worker asset URL at build time,
// so the worker is bundled and served from our own origin (no CDN, no CORS) —
// which keeps the "nothing leaves your browser" promise honest.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * pdfjs.ts — one place that configures pdf.js (the RENDER side: turning PDF
 * bytes into pixels for on-screen thumbnails and the Sign & Fill canvas).
 *
 * pdf.js only renders — it never writes PDFs. All mutation (reorder, delete,
 * rotate, merge, stamp text/images, fill forms) goes through `pdf-ops.ts`, which
 * uses `pdf-lib`. The two never mix: pdf.js shows the document, pdf-lib rewrites
 * the bytes.
 */
export { pdfjs };

/** Load a PDF document from raw bytes for rendering. */
export async function loadPdfDocument(data: ArrayBuffer) {
  // pdf.js can detach/neuter the buffer it's handed, which corrupts any other
  // reader (e.g. pdf-lib) using the same bytes. Hand it a private copy.
  const copy = data.slice(0);
  return pdfjs.getDocument({ data: copy }).promise;
}

/**
 * Render one page of a loaded pdf.js document to a canvas at the given scale and
 * return it as a PNG object URL (for a thumbnail) plus the page's natural size.
 * The caller owns the returned URL and must revoke it.
 */
export async function renderPageToDataUrl(
  doc: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
  scale: number,
): Promise<{ url: string; width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Could not render the PDF page");
  return { url: URL.createObjectURL(blob), width: viewport.width, height: viewport.height };
}

/**
 * A positioned run of existing text on a page, in UNSCALED PDF points with a
 * TOP-LEFT origin (matching the Sign & Fill overlay model). This is what powers
 * click-to-match: click a run → read its real font size + box, pre-fill a
 * matching editable box on top.
 */
export interface PageTextItem {
  str: string;
  /** Top-left origin, PDF points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Font height in points (a good proxy for font size). */
  fontSize: number;
  /** pdf.js internal font id, e.g. "g_d0_f1" — resolve to a real name via fontMap. */
  fontName: string;
}

/**
 * Extract the positioned text runs of a page at scale 1 (points). Also returns a
 * map from pdf.js's internal font id to the font's actual family name, so a
 * click can suggest the closest library font.
 */
export async function getPageTextItems(
  doc: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageNumber: number,
): Promise<{ items: PageTextItem[]; fontMap: Record<string, string> }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const ph = viewport.height;

  const items: PageTextItem[] = [];
  for (const raw of content.items) {
    // pdf.js text items: { str, transform:[a,b,c,d,e,f], width, height, fontName }
    if (!("str" in raw)) continue;
    const it = raw as {
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName: string;
    };
    if (!it.str.trim()) continue;
    const [a, b, , d, e, f] = it.transform;
    // Font size ≈ vertical scale of the text matrix.
    const fontSize = Math.hypot(b, d) || Math.abs(d) || it.height || 10;
    // transform e,f is the text origin (baseline, bottom-left origin). Convert to
    // a top-left box: y_top = pageHeight - f - ascent. Use fontSize as the box
    // height and put the baseline ~0.8 down.
    const x = e;
    const yTopFromBottom = f + fontSize * 0.2; // rough top of glyphs above baseline
    const yTop = ph - yTopFromBottom;
    const width = it.width || fontSize * it.str.length * 0.5;
    items.push({
      str: it.str,
      x,
      y: yTop - fontSize * 0.8,
      width,
      height: fontSize,
      fontSize: Math.round(fontSize * (Math.hypot(a, b) ? 1 : 1)),
      fontName: it.fontName,
    });
  }

  // fontName → real family, from the page's font objects.
  const fontMap: Record<string, string> = {};
  try {
    const styles = content.styles as Record<string, { fontFamily?: string }>;
    for (const [id, style] of Object.entries(styles ?? {})) {
      if (style?.fontFamily) fontMap[id] = style.fontFamily;
    }
  } catch {
    /* styles may be absent; click-to-match falls back to a default family */
  }
  return { items, fontMap };
}
