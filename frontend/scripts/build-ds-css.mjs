#!/usr/bin/env node
/* ============================================================================
   Build the design-system stylesheet entry for the claude.ai/design sync.

     node scripts/build-ds-css.mjs

   The app loads theme.css (tokens) and styles.css (everything else) as two
   separate imports from main.jsx. The design-sync converter takes ONE stylesheet
   path and copies it verbatim, so relative @imports inside it would not resolve
   from the output directory — the two files have to be concatenated instead.

   Order matters twice over: theme.css must come first because styles.css reads
   its custom properties, and theme.css's webfont @import must stay the very
   first statement in the file or CSS drops it.

   Root-relative asset urls are inlined as data URIs. In the app those resolve
   against public/, but the stylesheet is consumed from a design project where
   there is no such origin — the brand asterisk mask would silently render as
   nothing, in every design built with the system. Inlining keeps it visible.

   Output is generated and gitignored. `buildCmd` in .design-sync/config.json
   runs this before every sync.
   ============================================================================ */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = ["src/theme.css", "src/styles.css"];
const OUT = join(ROOT, ".ds-css/design-system.css");
const MIME = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

let inlined = 0;

// url("/foo.svg") -> url("data:image/svg+xml;base64,…"), for files that exist
// under public/. Anything that doesn't resolve is left alone rather than
// rewritten to a broken data URI — a visible 404 beats a silent one.
function inlineAssets(css) {
  return css.replace(/url\(\s*(['"]?)(\/[^'")\s]+)\1\s*\)/g, (whole, _q, path) => {
    const file = join(ROOT, "public", path);
    const mime = MIME[path.split(".").pop().toLowerCase()];
    if (!mime || !existsSync(file)) return whole;
    inlined += 1;
    return `url("data:${mime};base64,${readFileSync(file).toString("base64")}")`;
  });
}

const parts = SOURCES.map((rel) => {
  const body = inlineAssets(readFileSync(join(ROOT, rel), "utf8"));
  return `/* ─── ${rel} ─── */\n${body.trim()}\n`;
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, parts.join("\n"));

const kb = (Buffer.byteLength(parts.join("\n")) / 1024).toFixed(0);
console.log(
  `design-system.css  ${SOURCES.join(" + ")}  ->  .ds-css/  (${kb} KB, ${inlined} asset(s) inlined)`,
);
