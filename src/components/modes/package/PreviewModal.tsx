import { useCallback, useEffect, useState } from "react";
import { Modal, Tooltip } from "antd";
import { LeftOutlined, RightOutlined, CloseOutlined, FolderOutlined } from "@ant-design/icons";
import type { BundleItem } from "./PackageContext";
import { typeBadge, typeKind } from "./fileType";
import { FilePreview } from "./FilePreview";
import "./preview.css";

/**
 * PreviewModal — the "one last look before you bundle" gallery.
 *
 * Two layers, as Ruthnie pictured it:
 *   1. A grid of cards, each a live mini-render of one file in the bundle.
 *   2. Click a card → a full-screen lightbox with Prev / Next to step through
 *      every file (arrow keys too), so nothing gets zipped unseen.
 *
 * It renders straight from the live bundle items, so what you preview is exactly
 * what lands in the ZIP.
 */

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PreviewModal({
  open,
  onClose,
  items,
  isDark,
}: {
  open: boolean;
  onClose: () => void;
  items: BundleItem[];
  isDark: boolean;
}) {
  // Index of the file being zoomed in the lightbox; null = showing the grid.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  // Reset to the grid whenever the modal (re)opens.
  useEffect(() => {
    if (open) setZoomIndex(null);
  }, [open]);

  const go = useCallback(
    (delta: number) => {
      setZoomIndex((cur) => {
        if (cur === null || items.length === 0) return cur;
        // Wrap around so next past the end loops to the first, and vice versa.
        return (cur + delta + items.length) % items.length;
      });
    },
    [items.length],
  );

  // Arrow-key navigation while zoomed. Esc closing is handled by the inner modal.
  useEffect(() => {
    if (!open || zoomIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoomIndex, go]);

  const zoomed = zoomIndex !== null ? items[zoomIndex] : null;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={880}
        centered
        title={`Preview — ${items.length} file${items.length === 1 ? "" : "s"}`}
        classNames={{ content: "fb-prev-modal", body: "fb-prev-modal-body" }}
      >
        <div className="fb-prev-grid" data-dark={isDark}>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="fb-prev-card"
              onClick={() => setZoomIndex(i)}
              title={`Open ${item.name}`}
            >
              <div className="fb-prev-card-frame">
                <FilePreview file={item.file} name={item.name} variant="thumb" />
              </div>
              <div className="fb-prev-card-meta">
                <span
                  className="fb-prev-card-badge"
                  data-kind={typeKind(item.name, item.type)}
                >
                  {typeBadge(item.name, item.type)}
                </span>
                <span className="fb-prev-card-name" title={item.name}>
                  {item.name}
                </span>
              </div>
              {item.folder.trim() && (
                <span className="fb-prev-card-folder">
                  <FolderOutlined /> {item.folder.trim().replace(/^\/+|\/+$/g, "")}
                </span>
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Lightbox — a second modal stacked on top so closing it returns to the grid. */}
      <Modal
        open={open && zoomed !== null}
        onCancel={() => setZoomIndex(null)}
        footer={null}
        width="min(1100px, 94vw)"
        centered
        closable={false}
        classNames={{ content: "fb-prev-light", body: "fb-prev-light-body" }}
      >
        {zoomed && zoomIndex !== null && (
          <div className="fb-prev-light-wrap" data-dark={isDark}>
            <div className="fb-prev-light-head">
              <div className="fb-prev-light-title">
                <span
                  className="fb-prev-card-badge"
                  data-kind={typeKind(zoomed.name, zoomed.type)}
                >
                  {typeBadge(zoomed.name, zoomed.type)}
                </span>
                <span className="fb-prev-light-name">{zoomed.name}</span>
                <span className="fb-prev-light-sub">
                  {zoomIndex + 1} of {items.length} · {humanSize(zoomed.size)}
                  {zoomed.folder.trim() && (
                    <>
                      {" · "}
                      <FolderOutlined /> {zoomed.folder.trim().replace(/^\/+|\/+$/g, "")}
                    </>
                  )}
                </span>
              </div>
              <Tooltip title="Close (back to grid)">
                <button
                  type="button"
                  className="fb-prev-light-close"
                  onClick={() => setZoomIndex(null)}
                  aria-label="Close preview"
                >
                  <CloseOutlined />
                </button>
              </Tooltip>
            </div>

            <div className="fb-prev-light-stage">
              {items.length > 1 && (
                <button
                  type="button"
                  className="fb-prev-nav fb-prev-nav-prev"
                  onClick={() => go(-1)}
                  aria-label="Previous file"
                >
                  <LeftOutlined />
                </button>
              )}

              {/* key forces a fresh render per file so each preview reloads cleanly. */}
              <div className="fb-prev-light-canvas">
                <FilePreview
                  key={zoomed.id}
                  file={zoomed.file}
                  name={zoomed.name}
                  variant="full"
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  className="fb-prev-nav fb-prev-nav-next"
                  onClick={() => go(1)}
                  aria-label="Next file"
                >
                  <RightOutlined />
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
