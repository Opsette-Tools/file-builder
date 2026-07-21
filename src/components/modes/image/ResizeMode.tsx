import { useMemo, useState } from "react";
import { Button, Divider, Empty, InputNumber, Segmented, Space, Switch, Typography, message } from "antd";
import { ExpandOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ModeSurfaceProps } from "@/lib/modes";
import { PanelHeader } from "@/components/shell/PanelHeader";
import { ImageCanvas } from "./ImageCanvas";
import { useImageWork } from "./ImageWorkContext";
import { deliverImages } from "./imageOutput";
import {
  resizeImage,
  withExt,
  formatFor,
  resolveOutput,
  detectedLabel,
  fitDimensions,
  RASTER_FORMATS,
  type OutputFormat,
} from "@/lib/image-ops";
import "./image.css";

const RESIZE_ACCENT = "#2980b9";
const { Text } = Typography;

/**
 * Build the output-format tabs. The "keep" tab shows the DETECTED source format
 * (e.g. "PNG · keep") so the user sees exactly what they'll get, and the label
 * stays short enough to fit the tab. Falls back to a plain "Keep" before an image
 * is loaded.
 */
function formatOptions(sourceFile: File | undefined): { label: string; value: OutputFormat }[] {
  const detected = detectedLabel(sourceFile);
  return [
    { label: detected ? `${detected} · keep` : "Keep", value: "keep" },
    ...RASTER_FORMATS.map((f) => ({ label: f.label, value: f.mime as OutputFormat })),
  ];
}

/** Common target sizes — icon sizes plus a couple of general presets. */
const PRESETS = [
  { label: "32 px", value: 32 },
  { label: "192 px", value: 192 },
  { label: "512 px", value: 512 },
  { label: "1080 px", value: 1080 },
];

export function ResizeCanvas({ isDark }: ModeSurfaceProps) {
  return (
    <ImageCanvas
      isDark={isDark}
      blurb="Add one or more images, then scale them to a preset or an exact size. Aspect ratio is kept, and images are never blown up past their original size."
      accepts={["PNG", "JPG", "WebP", "GIF", "SVG"]}
    />
  );
}

type Mode = "longest" | "exact";

export function ResizePanel({ isDark }: ModeSurfaceProps) {
  const { items, hasImages } = useImageWork();
  const [mode, setMode] = useState<Mode>("longest");
  const [longest, setLongest] = useState<number>(512);
  const [exactW, setExactW] = useState<number | null>(512);
  const [exactH, setExactH] = useState<number | null>(512);
  const [allowUpscale, setAllowUpscale] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("keep");
  const [busy, setBusy] = useState(false);

  // Preview the resulting dimensions for the first image so the user sees the
  // effect before committing (the same size math the actual resize uses).
  const preview = useMemo(() => {
    const first = items[0];
    if (!first) return null;
    if (mode === "longest") {
      return fitDimensions(first.width, first.height, {
        maxW: longest,
        maxH: longest,
        allowUpscale,
      });
    }
    return fitDimensions(first.width, first.height, {
      maxW: exactW ?? undefined,
      maxH: exactH ?? undefined,
      allowUpscale,
    });
  }, [items, mode, longest, exactW, exactH, allowUpscale]);

  const onDownload = async () => {
    if (!hasImages) return;
    setBusy(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const out = [];
      for (const it of items) {
        const to = resolveOutput(format, it.file);
        const base =
          mode === "longest"
            ? { maxW: longest, maxH: longest, allowUpscale }
            : { maxW: exactW ?? undefined, maxH: exactH ?? undefined, allowUpscale };
        const { blob } = await resizeImage(it.file, { ...base, to, quality: 0.92 });
        const ext = formatFor(to).ext;
        out.push({ name: withExt(it.name, ext), blob });
      }
      await deliverImages(out, "resized-images");
      message.success(`Resized ${out.length} image${out.length === 1 ? "" : "s"}.`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      message.error(`Couldn't resize — ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-dark={isDark}>
      <PanelHeader icon={<ExpandOutlined />} title="Resize images" accent={RESIZE_ACCENT} />

      {!hasImages ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Add images to resize"
          style={{ marginTop: 24 }}
        />
      ) : (
        <>
          <div className="fb-field">
            <label className="fb-field-label">Resize by</label>
            <Segmented
              block
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { label: "Longest side", value: "longest" },
                { label: "Exact size", value: "exact" },
              ]}
            />
          </div>

          {mode === "longest" ? (
            <div className="fb-field">
              <label className="fb-field-label">Longest side (px)</label>
              <InputNumber
                min={1}
                max={8000}
                value={longest}
                onChange={(v) => setLongest(v ?? 1)}
                style={{ width: "100%" }}
              />
              <div className="fb-img-preset-row">
                {PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    size="small"
                    type={longest === p.value ? "primary" : "default"}
                    onClick={() => setLongest(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Text type="secondary" className="fb-field-hint">
                Scales so the wider side hits this. Aspect ratio kept.
              </Text>
            </div>
          ) : (
            <div className="fb-field">
              <label className="fb-field-label">Max width × height (px)</label>
              <Space.Compact style={{ width: "100%" }}>
                <InputNumber
                  min={1}
                  max={8000}
                  value={exactW}
                  onChange={setExactW}
                  placeholder="width"
                  style={{ width: "50%" }}
                />
                <InputNumber
                  min={1}
                  max={8000}
                  value={exactH}
                  onChange={setExactH}
                  placeholder="height"
                  style={{ width: "50%" }}
                />
              </Space.Compact>
              <Text type="secondary" className="fb-field-hint">
                The image fits inside this box, aspect ratio kept — it won't stretch.
              </Text>
            </div>
          )}

          <div className="fb-field">
            <label className="fb-field-label">Output format</label>
            <Segmented
              block
              value={format}
              onChange={(v) => setFormat(v as OutputFormat)}
              options={formatOptions(items[0]?.file)}
            />
            <Text type="secondary" className="fb-field-hint">
              {format === "keep"
                ? `Keeps the original format${detectedLabel(items[0]?.file) ? ` (${detectedLabel(items[0]?.file)})` : ""} — resize without changing the file type.`
                : "Resizes and converts to this format in one step."}
            </Text>
          </div>

          <div className="fb-field" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <label className="fb-field-label" style={{ margin: 0 }}>
              Enlarge smaller images
            </label>
            <Switch checked={allowUpscale} onChange={setAllowUpscale} />
          </div>
          <Text type="secondary" className="fb-field-hint" style={{ marginTop: -8 }}>
            If an image is smaller than your target, stretch it up to reach it (can look blurry).
            Off means it's never made bigger than it already is.
          </Text>

          {preview && (
            <>
              <Divider style={{ margin: "18px 0" }} />
              <div className="fb-img-estimate">
                <div className="fb-img-estimate-row">
                  <span className="fb-img-estimate-before">
                    {items[0].width} × {items[0].height}
                  </span>
                  <span className="fb-img-estimate-after">
                    {preview.width} × {preview.height}
                  </span>
                </div>
                {items.length > 1 && (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                    Preview is for the first image; each is scaled to fit the same target.
                  </Text>
                )}
              </div>
            </>
          )}

          <Space direction="vertical" size={10} style={{ width: "100%", marginTop: 20 }}>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              block
              loading={busy}
              disabled={busy}
              onClick={onDownload}
            >
              {busy ? "Resizing…" : items.length > 1 ? "Resize & download ZIP" : "Resize & download"}
            </Button>
            <Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block" }}>
              Done in your browser — nothing is uploaded.
            </Text>
          </Space>
        </>
      )}
    </div>
  );
}
