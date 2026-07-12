/**
 * "Load an Opsette kit" quick-fill.
 *
 * Brand Board (and the other Opsette tools) can export a single
 * `.opsette-kit.json` "project file" that carries every generated asset inline
 * as a data URL — the logo, the QR code, the digital card, the email-signature
 * HTML, and a set of social assets (banners, icons, favicon). This module
 * decodes that one file into a list of real `File` objects with sensible names
 * and folders, so the bundler's generic file list can be pre-filled in one click
 * instead of exporting and importing every asset by hand.
 *
 * This is an ACCELERANT layered on top of the agnostic bundler — it just seeds
 * the same editable rows `addFiles` produces. It introduces NO fixed slots and
 * NO kit-only framing; every row it creates is a normal, renamable, movable,
 * removable bundle row like any dropped file.
 *
 * Robustness rule: this must NEVER throw on junk. A wrong/corrupt file returns
 * an empty result with a friendly reason, so the caller can show a gentle
 * "that's not an Opsette kit file" message instead of crashing.
 *
 * The PDFs a real kit also needs (Brand_Board.pdf, Color_Palette.pdf,
 * Font_Pairing.pdf) live OUTSIDE the blob system — they're downloads, not inline
 * data. The quick-fill fills everything that IS a blob; the user drags those few
 * PDFs in manually afterward, exactly as the delivery workflow expects.
 */

/* ------------------------------------------------------------ data-url decode */

/** Decode a `data:...;base64,...` URL into a File, or null if it isn't one. */
function dataUrlToFile(dataUrl: unknown, fileName: string): File | null {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const payload = match[3] ?? "";
  try {
    let buffer: ArrayBuffer;
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      buffer = bytes.buffer;
    } else {
      const decoded = decodeURIComponent(payload);
      buffer = new TextEncoder().encode(decoded).buffer;
    }
    return new File([buffer], fileName, { type: mime });
  } catch {
    return null;
  }
}

/** Wrap a UTF-8 string (e.g. signature HTML) as a File. */
function textToFile(text: unknown, fileName: string, mime: string): File | null {
  if (typeof text !== "string" || !text.trim()) return null;
  return new File([text], fileName, { type: mime });
}

/* ------------------------------------------------------ naming helpers */

/** Filesystem-safe stem from an arbitrary string, or a fallback. */
function slugify(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const s = raw
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || fallback;
}

/** Pick a file extension for an image data URL by its MIME (defaults png). */
function imageExt(dataUrl: unknown): string {
  if (typeof dataUrl === "string") {
    const m = /^data:image\/([a-z0-9+]+)/i.exec(dataUrl);
    if (m) {
      const t = m[1].toLowerCase();
      if (t === "jpeg") return "jpg";
      if (t === "svg+xml") return "svg";
      return t;
    }
  }
  return "png";
}

/* ------------------------------------------------------ folder constants */
// Match the delivery structure in FIVERR-BUSINESS-STARTER-KIT.md.
const F_LOGO = "Logo";
const F_SIGNATURE = "Email_Signature";
const F_CARD = "Digital_Card";
const F_SOCIAL = "Social_Banner";
const F_ICONS = "Icons";

/* ------------------------------------------------------ social routing */

interface SocialAsset {
  label?: unknown;
  kind?: unknown;
  image?: unknown;
  width?: unknown;
  height?: unknown;
}

/** Route a social asset to a (folder, filename) by its kind. */
function socialTarget(asset: SocialAsset, index: number): { folder: string; stem: string } {
  const kind = typeof asset.kind === "string" ? asset.kind.toLowerCase() : "";
  const label = typeof asset.label === "string" ? asset.label : "";
  const stem = slugify(label, `social_${index + 1}`);
  switch (kind) {
    case "banner":
    case "card":
      return { folder: F_SOCIAL, stem };
    case "icon":
    case "favicon":
      return { folder: F_ICONS, stem };
    default:
      return { folder: F_SOCIAL, stem };
  }
}

/* ------------------------------------------------------ the prepared row shape */

export interface PreparedFile {
  file: File;
  /** Default output name inside the zip (with extension). User can rename. */
  name: string;
  /** Default folder (may be ""). User can change. */
  folder: string;
}

export interface KitParseResult {
  files: PreparedFile[];
  /** A short label for the kit (brand/kit/business name), if we found one. */
  kitLabel: string | null;
  /** null on success; a friendly reason when we couldn't read a kit. */
  error: string | null;
}

const EMPTY_FAIL = (error: string): KitParseResult => ({ files: [], kitLabel: null, error });

/**
 * Parse the raw text of an `.opsette-kit.json` file into prepared bundle files.
 * Tolerant of both the enveloped shape ({ type, v, board:{...} }) and a bare
 * board object. Never throws.
 */
export function parseOpsetteKit(rawText: string): KitParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return EMPTY_FAIL("That file isn't valid JSON, so it can't be an Opsette kit.");
  }
  if (!parsed || typeof parsed !== "object") {
    return EMPTY_FAIL("That doesn't look like an Opsette kit file.");
  }

  const root = parsed as Record<string, unknown>;
  // Enveloped ({ type, v, board }) or a bare board object — accept both.
  const board = (
    root.board && typeof root.board === "object" ? root.board : root
  ) as Record<string, unknown>;

  const kitLabel =
    (typeof board.kitName === "string" && board.kitName.trim()) ||
    (typeof board.businessName === "string" && board.businessName.trim()) ||
    null;
  const brandStem = slugify(kitLabel, "brand");

  const files: PreparedFile[] = [];
  const push = (file: File | null, name: string, folder: string) => {
    if (file) files.push({ file, name, folder });
  };

  // Logo.
  push(
    dataUrlToFile(board.logoDataUrl, `${brandStem}_logo.${imageExt(board.logoDataUrl)}`),
    `${brandStem}_logo.${imageExt(board.logoDataUrl)}`,
    F_LOGO,
  );

  // QR code — sits at the root of the kit.
  push(dataUrlToFile(board.qrDataUrl, "qr_code.png"), "qr_code.png", "");

  // Digital card.
  push(
    dataUrlToFile(board.cardDataUrl, `digital_card.${imageExt(board.cardDataUrl)}`),
    `digital_card.${imageExt(board.cardDataUrl)}`,
    F_CARD,
  );

  // Email signature HTML.
  push(textToFile(board.signatureHtml, "signature.html", "text/html"), "signature.html", F_SIGNATURE);

  // Social assets (banners / icons / favicon / card).
  if (Array.isArray(board.socialAssets)) {
    const usedNames = new Map<string, number>();
    board.socialAssets.forEach((raw, i) => {
      if (!raw || typeof raw !== "object") return;
      const asset = raw as SocialAsset;
      const ext = imageExt(asset.image);
      const { folder, stem } = socialTarget(asset, i);
      // Keep names unique within the run so two "banner"s don't collide before
      // the zip builder's own de-collision even runs.
      const key = `${folder}/${stem}`;
      const seen = usedNames.get(key) ?? 0;
      usedNames.set(key, seen + 1);
      const name = seen === 0 ? `${stem}.${ext}` : `${stem}_${seen + 1}.${ext}`;
      push(dataUrlToFile(asset.image, name), name, folder);
    });
  }

  if (files.length === 0) {
    return EMPTY_FAIL(
      "That's a valid file, but it has no kit assets to load. Try exporting the kit again from Brand Board.",
    );
  }

  return { files, kitLabel: kitLabel || null, error: null };
}
