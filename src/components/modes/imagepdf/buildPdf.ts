import { jsPDF } from "jspdf";
import { loadImage } from "@/lib/image-ops";
import type { PdfImageItem } from "./ImagesToPdfContext";

/**
 * Combine an ordered list of images into a single PDF, one image per page, in the
 * browser via jsPDF. Every image is first drawn to a canvas and re-encoded as
 * PNG (lossless) so formats jsPDF can't ingest directly (WebP, GIF, SVG) still
 * work — the canvas is the universal decoder.
 *
 * Two layout choices:
 *  - "fit": each page is sized to the image's own aspect ratio (a tight PDF of
 *    just the pictures — best for a photo set or scanned pages).
 *  - "a4" / "letter": every image is centered on a standard page with a margin
 *    (best for printing).
 */
export type PageLayout = "fit" | "a4" | "letter";
export type PageOrientation = "auto" | "portrait" | "landscape";

const PAGE_PT: Record<"a4" | "letter", { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};
const MARGIN = 36; // 0.5in

async function toPngDataUrl(file: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked the image canvas.");
  ctx.drawImage(img.el, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height };
}

export async function buildImagesPdf(
  items: PdfImageItem[],
  opts: { layout: PageLayout; orientation: PageOrientation },
): Promise<Blob> {
  if (items.length === 0) throw new Error("No images to add.");

  let doc: jsPDF | null = null;

  for (let i = 0; i < items.length; i += 1) {
    const { dataUrl, width, height } = await toPngDataUrl(items[i].file);
    const landscape = width > height;

    if (opts.layout === "fit") {
      // Page IS the image (in points; treat px as pt for a 1:1 tight page).
      const orient = width >= height ? "landscape" : "portrait";
      const format: [number, number] = [width, height];
      if (!doc) {
        doc = new jsPDF({ unit: "pt", format, orientation: orient });
      } else {
        doc.addPage(format, orient);
      }
      doc.addImage(dataUrl, "PNG", 0, 0, width, height);
    } else {
      const base = PAGE_PT[opts.layout];
      const orient =
        opts.orientation === "auto"
          ? landscape
            ? "landscape"
            : "portrait"
          : opts.orientation;
      const pageW = orient === "landscape" ? base.h : base.w;
      const pageH = orient === "landscape" ? base.w : base.h;
      if (!doc) {
        doc = new jsPDF({ unit: "pt", format: opts.layout, orientation: orient });
      } else {
        doc.addPage(opts.layout, orient);
      }
      // Scale to fit inside the margins, centered, aspect preserved.
      const availW = pageW - MARGIN * 2;
      const availH = pageH - MARGIN * 2;
      const scale = Math.min(availW / width, availH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      doc.addImage(dataUrl, "PNG", x, y, drawW, drawH);
    }
  }

  if (!doc) throw new Error("No images to add.");
  return doc.output("blob");
}
