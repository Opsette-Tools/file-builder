import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { uuid } from "@/lib/uuid";
import { loadImage } from "@/lib/image-ops";

/**
 * ImagesToPdfContext — an ORDERED sequence of images to combine into one PDF, one
 * image per page. Order matters (it's the page order), and you can drag to
 * reorder, so this is its own context rather than sharing the image work set with
 * the resize/convert/compress trio (which don't care about order).
 */

export interface PdfImageItem {
  id: string;
  file: File;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
}

interface ImagesToPdfState {
  items: PdfImageItem[];
  hasImages: boolean;
  addFiles: (files: File[]) => Promise<{ added: number; skipped: string[] }>;
  remove: (id: string) => void;
  move: (fromId: string, toId: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<ImagesToPdfState | null>(null);
const IMAGE_MIME = /^image\//;

export function ImagesToPdfProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PdfImageItem[]>([]);

  useEffect(() => {
    return () => {
      setItems((cur) => {
        cur.forEach((it) => URL.revokeObjectURL(it.previewUrl));
        return cur;
      });
    };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const skipped: string[] = [];
    const next: PdfImageItem[] = [];
    for (const file of files) {
      const looksImage =
        IMAGE_MIME.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
      if (!looksImage) {
        skipped.push(file.name);
        continue;
      }
      try {
        const { width, height } = await loadImage(file);
        next.push({
          id: uuid(),
          file,
          name: file.name,
          width,
          height,
          previewUrl: URL.createObjectURL(file),
        });
      } catch {
        skipped.push(file.name);
      }
    }
    if (next.length) setItems((cur) => [...cur, ...next]);
    return { added: next.length, skipped };
  }, []);

  const remove = useCallback((id: string) => {
    setItems((cur) => {
      const hit = cur.find((it) => it.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return cur.filter((it) => it.id !== id);
    });
  }, []);

  const move = useCallback((fromId: string, toId: string) => {
    setItems((cur) => {
      if (fromId === toId) return cur;
      const from = cur.findIndex((it) => it.id === fromId);
      const to = cur.findIndex((it) => it.id === toId);
      if (from < 0 || to < 0) return cur;
      const copy = [...cur];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((cur) => {
      cur.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
  }, []);

  const value = useMemo<ImagesToPdfState>(
    () => ({
      items,
      hasImages: items.length > 0,
      addFiles,
      remove,
      move,
      clearAll,
    }),
    [items, addFiles, remove, move, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImagesToPdf(): ImagesToPdfState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useImagesToPdf must be used inside <ImagesToPdfProvider>");
  return ctx;
}
