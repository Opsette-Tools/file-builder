import { useEffect, useState } from "react";
import { Spin, Tooltip } from "antd";
import { CheckOutlined, RotateRightOutlined, DeleteOutlined } from "@ant-design/icons";
import { useOrganize, type PageEntry } from "./OrganizeContext";

/**
 * PageThumb — one page tile in the Organize grid. Renders its thumbnail lazily
 * via the context's cached pdf.js renderer, shows the current rotation, and is
 * both a drag source and a drop target for reordering. Tapping toggles select;
 * hover reveals quick rotate/delete actions for that single page.
 */
export function PageThumb({
  page,
  index,
  onDragStart,
  onDrop,
  dragOverId,
  setDragOverId,
}: {
  page: PageEntry;
  index: number;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
}) {
  const { getThumb, toggleSelect, rotatePages, deletePages } = useOrganize();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getThumb(page.docId, page.pageIndex)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        /* leave as spinner-less blank on failure */
      });
    return () => {
      alive = false;
    };
  }, [getThumb, page.docId, page.pageIndex]);

  const isDragTarget = dragOverId === page.id;

  return (
    <div
      className="fb-pt"
      data-selected={page.selected}
      data-drop={isDragTarget}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(page.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverId(page.id);
      }}
      onDragLeave={() => setDragOverId(null)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(page.id);
        setDragOverId(null);
      }}
      onClick={() => toggleSelect(page.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSelect(page.id);
        }
      }}
    >
      <div className="fb-pt-frame">
        {url ? (
          <img
            className="fb-pt-img"
            src={url}
            alt={`Page ${index + 1}`}
            style={{ transform: `rotate(${page.rotation}deg)` }}
            draggable={false}
          />
        ) : (
          <div className="fb-pt-loading">
            <Spin size="small" />
          </div>
        )}

        {page.selected && (
          <span className="fb-pt-check">
            <CheckOutlined />
          </span>
        )}

        <div className="fb-pt-actions">
          <Tooltip title="Rotate this page">
            <button
              type="button"
              className="fb-pt-action"
              onClick={(e) => {
                e.stopPropagation();
                rotatePages([page.id], 90);
              }}
            >
              <RotateRightOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Delete this page">
            <button
              type="button"
              className="fb-pt-action fb-pt-action-danger"
              onClick={(e) => {
                e.stopPropagation();
                deletePages([page.id]);
              }}
            >
              <DeleteOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
      <span className="fb-pt-num">{index + 1}</span>
    </div>
  );
}
