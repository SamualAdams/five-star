#!/usr/bin/env node
/* ============================================================================
   five* social — FIT CHECK
   Loads every post in every format and asks the page whether it fits.

     node check.mjs            all posts, all formats
     node check.mjs 04         one post

   The frame is overflow:hidden, so a post whose interior is too tall doesn't
   error — it just quietly renders without a footer. Run this before exporting.

   The measuring happens in the page (shared/boot.js, ?check=1), which writes
   its verdict into <title>; here we just read it back out of --dump-dom.
   ============================================================================ */

import { createServer } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8233;
const FORMATS = ["square", "portrait", "story"];

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg",
};

async function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { await stat(p); return p; } catch {}
  }
  throw new Error("No Chrome/Chromium found. Edit CHROME_CANDIDATES in check.mjs.");
}

function serve() {
  const server = createServer(async (req, res) => {
    const filePath = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      }).end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };

async function main() {
  const filter = process.argv[2];
  const chrome = await findChrome();

  let posts = (await readdir(path.join(ROOT, "posts")))
    .filter((f) => f.endsWith(".html")).sort();
  if (filter) posts = posts.filter((f) => f.startsWith(filter));
  if (!posts.length) { console.error("No posts matched."); process.exit(1); }

  const server = await serve();
  const stamp = Date.now();
  let pass = 0, fail = 0;

  for (const post of posts) {
    for (const f of FORMATS) {
      const [w, h] = SIZES[f];
      const url = `http://localhost:${PORT}/posts/${post}?f=${f}&check=1&v=${stamp}`;
      let dom = "";
      try {
        const { stdout } = await execFileAsync(chrome, [
          "--headless", "--disable-gpu", "--disk-cache-dir=/dev/null",
          "--virtual-time-budget=4000", `--window-size=${w},${h}`,
          "--dump-dom", url,
        ], { maxBuffer: 32 * 1024 * 1024 });
        dom = stdout;
      } catch (e) { dom = e.stdout || ""; }

      const m = dom.match(/FITCHECK:([^<]*)</);
      const label = `${post.replace(/\.html$/, "")} ${f}`;
      if (!m) {
        console.log(`  ????  ${label} — page never reported (check did not run)`);
        fail++;
      } else if (m[1] === "PASS") {
        console.log(`  pass  ${label}`);
        pass++;
      } else {
        console.log(`  FAIL  ${label} — ${m[1]}`);
        fail++;
      }
    }
  }

  server.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

main();
