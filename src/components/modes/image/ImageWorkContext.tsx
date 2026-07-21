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
 * ImageWorkContext — the shared working set for the single-image operation modes
 * (Resize, Convert, Compress). All three take the same input — one or more images
 * you dropped in — and differ only in the operation applied and the panel
 * controls. So they share ONE working set here: switch from Resize to Convert and
 * the images you loaded are still there, no re-upload.
 *
 * Each item carries its decoded natural dimensions (read once on add) so the
 * panels can show "1024 × 768" and compute targets without re-decoding. Bytes are
 * kept in memory only — an image session is transient work on files already on
 * disk (same call the Organize context makes: no IndexedDB draft).
 *
 * Images → PDF is deliberately NOT here — it's an ordered sequence you assemble,
 * a different interaction, and it owns its own context.
 */

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  width: number;
  height: number;
  /** Object URL for the thumbnail preview; revoked on removal/clear. */
  previewUrl: string;
}

interface ImageWorkState {
  items: ImageItem[];
  hasImages: boolean;
  totalBytes: number;
  addFiles: (files: File[]) => Promise<{ added: number; skipped: string[] }>;
  remove: (id: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<ImageWorkState | null>(null);

const IMAGE_MIME = /^image\//;

export function ImageWorkProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ImageItem[]>([]);

  // Revoke every preview URL when the provider unmounts.
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
    const next: ImageItem[] = [];
    for (const file of files) {
      // Accept by MIME or by a recognized image extension (some drops report an
      // empty type). Anything the browser can't decode is skipped with its name.
      const looksImage = IMAGE_MIME.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico)$/i.test(file.name);
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

  const clearAll = useCallback(() => {
    setItems((cur) => {
      cur.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
  }, []);

  const totalBytes = useMemo(() => items.reduce((sum, it) => sum + it.file.size, 0), [items]);

  const value = useMemo<ImageWorkState>(
    () => ({
      items,
      hasImages: items.length > 0,
      totalBytes,
      addFiles,
      remove,
      clearAll,
    }),
    [items, totalBytes, addFiles, remove, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImageWork(): ImageWorkState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useImageWork must be used inside <ImageWorkProvider>");
  return ctx;
}
