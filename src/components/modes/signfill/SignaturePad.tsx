import { useEffect, useRef, useState } from "react";
import { Modal, Button, Space, Typography } from "antd";
import { UndoOutlined, ClearOutlined } from "@ant-design/icons";

/**
 * SignaturePad — a drawn-ink signature capture in a modal. The user draws with a
 * pointer (mouse/touch/stylus) on a transparent canvas; "Add" exports a trimmed
 * transparent PNG data URL that becomes a signature overlay image. Pure client
 * side, no library — just the 2D canvas.
 */
export function SignaturePad({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the canvas backing store to its display size (accounting for DPR) when
  // the modal opens.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
    setHasInk(false);
  }, [open]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const done = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Transparent PNG (nothing drawn on the background) so the signature sits on
    // the page without a white box behind it.
    onDone(canvas.toDataURL("image/png"));
  };

  return (
    <Modal
      title="Draw your signature"
      open={open}
      onCancel={onClose}
      width={520}
      footer={
        <Space>
          <Button icon={<UndoOutlined />} onClick={clear} disabled={!hasInk}>
            Clear
          </Button>
          <Button type="primary" onClick={done} disabled={!hasInk}>
            Add signature
          </Button>
        </Space>
      }
    >
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        Sign with your mouse, finger, or stylus. It lands on your page as a transparent image.
      </Typography.Text>
      <canvas
        ref={canvasRef}
        className="fb-sigpad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
    </Modal>
  );
}
