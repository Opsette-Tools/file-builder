import { useRef, useState, type ReactNode } from "react";
import { Button, Typography } from "antd";
import { CloudUploadOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

/**
 * DropZone — the big, inviting upload affordance that fills the center canvas
 * empty state (the hero of every mode). Shared primitive: every mode reuses it
 * rather than hand-rolling its own drop UI. Handles drag-over styling, click to
 * open the file picker, and multi/single selection.
 *
 * Purely presentational about acceptance — it passes the raw FileList up; each
 * mode decides what to keep. Accepted-format chips are rendered from the mode's
 * declared `accepts`, so the copy stays in the registry, not here.
 */
export function DropZone({
  title,
  blurb,
  accepts,
  accept,
  multiple = true,
  onFiles,
  buttonLabel = "Select files",
  footer,
}: {
  title: string;
  blurb: string;
  accepts: string[];
  /** The input's `accept` attribute (MIME/extension filter). */
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  buttonLabel?: string;
  footer?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      className="fb-dropzone"
      data-dragover={dragOver}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        emit(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />

      <CloudUploadOutlined className="fb-dropzone-icon" />
      <Title level={3} className="fb-dropzone-title" style={{ margin: 0 }}>
        {title}
      </Title>
      <Text className="fb-dropzone-blurb">{blurb}</Text>

      <Button
        type="primary"
        size="large"
        className="fb-dropzone-btn"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {buttonLabel}
      </Button>

      <div className="fb-dropzone-hint">or drop {multiple ? "files" : "a file"} here</div>

      {accepts.length > 0 && (
        <div className="fb-chip-row">
          <span className="fb-chip-label">Supported:</span>
          {accepts.map((a) => (
            <span key={a} className="fb-chip">
              {a}
            </span>
          ))}
        </div>
      )}

      {footer}
    </div>
  );
}
