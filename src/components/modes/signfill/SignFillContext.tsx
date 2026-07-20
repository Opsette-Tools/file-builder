import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { uuid } from "@/lib/uuid";
import {
  loadPdfDocument,
  renderPageToDataUrl,
  getPageTextItems,
  type PageTextItem,
} from "@/lib/pdfjs";

/**
 * SignFillContext — state for the Sign & Fill mode: one loaded PDF, its rendered
 * page images, and the overlay elements the user places on top (text, signature
 * image, date, checkmark, white-out box). On download, `applyOverlay` flattens
 * every element into the real PDF bytes.
 *
 * Coordinates: every element stores its position/size in PDF POINTS relative to
 * the page's top-left (unscaled). The canvas renders pages at a display scale
 * and multiplies; the exporter uses the raw point values. Keeping the model in
 * points means zoom/scale never corrupts placement.
 */

export type ElementKind = "text" | "signature" | "checkmark";

export interface OverlayElement {
  id: string;
  kind: ElementKind;
  pageIndex: number;
  /** All in PDF points, top-left origin relative to the page. */
  x: number;
  y: number;
  width: number;
  height: number;
  // text / checkmark
  text?: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  /**
   * The chosen font FAMILY from the shared Opsette library (e.g. "Merriweather",
   * "Inter"). Rendered on screen via the library's Google-Fonts loader and
   * embedded into the exported PDF from its vendored bytes. Undefined = the
   * default (Helvetica-equivalent) base font.
   */
  fontFamily?: string;
  fontWeight?: number;
  /**
   * Set when this text box came from click-to-match on existing PDF text. It
   * carries the original string + box so the exporter can TRULY REMOVE that run
   * from the content stream (not just cover it), keeping the page real text a
   * scraper can't see through. `replace: true` while the box is still standing
   * in for the original.
   */
  replacesOriginal?: {
    pageIndex: number;
    originalText: string;
    /** The matched run's box in points (top-left), for region-based removal. */
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /**
   * Optional background fill behind a text element, in 0..1 rgb. This is how you
   * cover-and-replace: set a white background and the box hides whatever's under
   * it while you type the correction on top. Undefined = transparent (just text).
   */
  bg?: { r: number; g: number; b: number };
  // signature image
  imgDataUrl?: string;
  imgFormat?: "png" | "jpg";
}

export interface RenderedPage {
  pageIndex: number;
  /** Object URL of the rendered page image. */
  url: string;
  /** Page size in PDF points (post-rotation, as pdf.js draws it). */
  width: number;
  height: number;
  /** Existing text runs on this page (for click-to-match), points/top-left. */
  textItems: PageTextItem[];
  /** pdf.js font-id → family name, for suggesting a matching library font. */
  fontMap: Record<string, string>;
}

interface SignFillState {
  fileName: string | null;
  bytes: ArrayBuffer | null;
  pages: RenderedPage[];
  loading: boolean;
  hasDoc: boolean;
  loadPdf: (file: File) => Promise<boolean>;
  reset: () => void;

  elements: OverlayElement[];
  addElement: (el: Omit<OverlayElement, "id">) => string;
  matchTextItem: (
    pageIndex: number,
    item: PageTextItem,
    suggested: { fontFamily: string; fontWeight: number },
    color: { r: number; g: number; b: number },
  ) => string;
  updateElement: (id: string, patch: Partial<OverlayElement>) => void;
  removeElement: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** "Fix existing text" mode: existing PDF text runs become clickable. */
  fixMode: boolean;
  setFixMode: (on: boolean) => void;
}

const Ctx = createContext<SignFillState | null>(null);

// The scale pdf.js renders pages at internally. Higher = crisper page images
// but heavier; 1.5 is a good balance for on-screen editing on retina.
const RENDER_SCALE = 1.5;

export function SignFillProvider({ children }: { children: ReactNode }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [elements, setElements] = useState<OverlayElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fixMode, setFixMode] = useState(false);
  const urls = useRef<string[]>([]);

  const revokeAll = () => {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
  };

  const loadPdf = useCallback(async (file: File) => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) return false;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await loadPdfDocument(buf);
      revokeAll();
      const rendered: RenderedPage[] = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        const { url, width, height } = await renderPageToDataUrl(doc, i, RENDER_SCALE);
        urls.current.push(url);
        // Text runs for click-to-match (extracted at scale 1 = points).
        const { items, fontMap } = await getPageTextItems(doc, i);
        // width/height come back at RENDER_SCALE; store the true point size.
        rendered.push({
          pageIndex: i - 1,
          url,
          width: width / RENDER_SCALE,
          height: height / RENDER_SCALE,
          textItems: items,
          fontMap,
        });
      }
      setBytes(buf);
      setFileName(file.name);
      setPages(rendered);
      setElements([]);
      setSelectedId(null);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    revokeAll();
    setBytes(null);
    setFileName(null);
    setPages([]);
    setElements([]);
    setSelectedId(null);
  }, []);

  const addElement = useCallback((el: Omit<OverlayElement, "id">) => {
    const id = uuid();
    setElements((prev) => [...prev, { ...el, id }]);
    setSelectedId(id);
    return id;
  }, []);

  /**
   * Click-to-match: turn an existing text run into an editable, font-matched,
   * white-backed text box positioned exactly over it. Records the original run
   * so the exporter can truly remove it (not just cover). Returns the new id.
   */
  const matchTextItem = useCallback(
    (
      pageIndex: number,
      item: PageTextItem,
      suggested: { fontFamily: string; fontWeight: number },
      color: { r: number; g: number; b: number },
    ) => {
      const id = uuid();
      // Pad the cover box slightly so it fully hides the original glyphs.
      const padX = item.fontSize * 0.15;
      const padY = item.fontSize * 0.12;
      const el: OverlayElement = {
        id,
        kind: "text",
        pageIndex,
        x: item.x - padX,
        y: item.y - padY,
        width: item.width + padX * 2,
        height: item.height + padY * 2,
        text: item.str,
        fontSize: item.fontSize,
        color,
        fontFamily: suggested.fontFamily,
        fontWeight: suggested.fontWeight,
        bg: { r: 1, g: 1, b: 1 },
        replacesOriginal: {
          pageIndex,
          originalText: item.str,
          x: item.x - padX,
          y: item.y - padY,
          width: item.width + padX * 2,
          height: item.height + padY * 2,
        },
      };
      setElements((prev) => [...prev, el]);
      setSelectedId(id);
      // Drop out of fix-mode so the matched box is immediately editable/draggable
      // (the hit layer would otherwise sit on top and intercept clicks).
      setFixMode(false);
      return id;
    },
    [],
  );

  const updateElement = useCallback((id: string, patch: Partial<OverlayElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const value = useMemo<SignFillState>(
    () => ({
      fileName,
      bytes,
      pages,
      loading,
      hasDoc: pages.length > 0,
      loadPdf,
      reset,
      elements,
      addElement,
      matchTextItem,
      updateElement,
      removeElement,
      selectedId,
      setSelectedId,
      fixMode,
      setFixMode,
    }),
    [
      fileName,
      bytes,
      pages,
      loading,
      loadPdf,
      reset,
      elements,
      addElement,
      matchTextItem,
      updateElement,
      removeElement,
      selectedId,
      fixMode,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSignFill(): SignFillState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSignFill must be used inside SignFillProvider");
  return ctx;
}

export { RENDER_SCALE };
