// One-time (re-runnable) vendoring of the shared font library's actual font
// bytes into public/fonts/, so the PDF exporter can EMBED them with fontkit —
// not just render them on screen from Google's CDN. Run: `node scripts/fetch-fonts.mjs`
//
// Format = WOFF (v1): Google's CSS2 endpoint serves woff2 to modern browsers,
// but @pdf-lib/fontkit CANNOT decompress woff2 (Brotli + glyph transforms).
// Sending an old User-Agent makes Google return plain WOFF (v1), which is just a
// zlib-wrapped TTF/OTF — fontkit embeds it cleanly. We take the `latin` subset
// block (unicode-range U+0000-00FF...), which covers everything document text
// needs.
//
// Privacy note: this runs at BUILD time on the dev machine. The shipped app
// fetches these files only from OUR OWN origin (public/fonts/), so a user's PDF
// text still never leaves their browser.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");

// An old Chrome UA so Google Fonts returns TTF instead of woff2.
const TTF_UA =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36";

/**
 * Read the vendored library and collect one TTF per (family, weight) we need.
 * We parse the googleParam strings directly rather than import the TS module.
 */
async function collectFontJobs() {
  const src = await readFile(path.join(ROOT, "src", "lib", "shared-fonts.ts"), "utf8");
  // Grab every `googleParam: "..."` literal.
  const params = [...src.matchAll(/googleParam:\s*"([^"]+)"/g)].map((m) => m[1]);
  // family -> Set<weight>. A param looks like "Playfair+Display:wght@600;700"
  // or just "Anton" (single default weight 400) or an opsz form.
  const byFamily = new Map();
  for (const param of params) {
    const [famRaw, spec] = param.split(":");
    const family = famRaw.replace(/\+/g, " ");
    if (!byFamily.has(family)) byFamily.set(family, new Set());
    const set = byFamily.get(family);
    if (!spec) {
      set.add(400);
      continue;
    }
    // spec like "wght@600;700" or "opsz,wght@9..144,600;9..144,700"
    const at = spec.split("@")[1] ?? "";
    for (const chunk of at.split(";")) {
      // last comma-part is the weight (opsz forms put weight last)
      const parts = chunk.split(",");
      const w = Number(parts[parts.length - 1]);
      if (Number.isFinite(w)) set.add(w);
    }
    if (set.size === 0) set.add(400);
  }
  return byFamily;
}

/** Slug used for the on-disk filename + the runtime lookup key. */
function fontFileName(family, weight) {
  return `${family.replace(/\s+/g, "-").toLowerCase()}-${weight}.woff`;
}

/**
 * Fetch the `latin`-subset WOFF url for one family+weight. Google returns a CSS
 * with several @font-face blocks (latin, latin-ext, …); we want the one whose
 * unicode-range starts at U+0000-00FF (the base Latin set). Falls back to the
 * first .woff found if that specific block isn't present.
 */
async function fetchWoffUrl(family, weight) {
  const url =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family).replace(/%20/g, "+") +
    `:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": TTF_UA } });
  if (!res.ok) throw new Error(`css ${res.status} for ${family} ${weight}`);
  const css = await res.text();
  // Split into @font-face blocks and prefer the base-latin one.
  const blocks = css.split("@font-face");
  let latinUrl = null;
  let anyUrl = null;
  for (const b of blocks) {
    const um = b.match(/src:\s*url\(([^)]+\.woff)\)\s*format\(['"]woff['"]\)/i);
    if (!um) continue;
    if (!anyUrl) anyUrl = um[1];
    if (/U\+0000-00FF/i.test(b)) latinUrl = um[1];
  }
  const chosen = latinUrl ?? anyUrl;
  if (!chosen) throw new Error(`no woff url for ${family} ${weight}`);
  return chosen;
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  const jobs = await collectFontJobs();
  const manifest = {};
  let ok = 0;
  let fail = 0;

  for (const [family, weights] of jobs) {
    for (const weight of [...weights].sort((a, b) => a - b)) {
      const file = fontFileName(family, weight);
      const dest = path.join(OUT_DIR, file);
      manifest[`${family}::${weight}`] = file;
      if (existsSync(dest)) {
        ok += 1;
        continue;
      }
      try {
        const woffUrl = await fetchWoffUrl(family, weight);
        const bytes = Buffer.from(await (await fetch(woffUrl)).arrayBuffer());
        await writeFile(dest, bytes);
        console.log(`  ✓ ${file} (${(bytes.length / 1024).toFixed(0)} kB)`);
        ok += 1;
      } catch (err) {
        console.warn(`  ✗ ${family} ${weight}: ${err.message}`);
        fail += 1;
      }
    }
  }

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`\nDone. ${ok} fonts ready, ${fail} failed. Manifest written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
