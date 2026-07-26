#!/usr/bin/env node
/* ============================================================================
   five* social — RENDER
   Renders every post in posts/ to every format, into export/.

     node render.mjs                 all posts, all formats
     node render.mjs 01              only posts whose filename starts with "01"
     node render.mjs 03 --square     one post, one format

   Serves over HTTP rather than file:// — a file:// origin blocks the stylesheet
   and font loads, which silently produces an unstyled screenshot.
   ============================================================================ */

import { createServer } from "node:http";
import { readdir, readFile, mkdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8231;

const FORMATS = {
  square:   { w: 1080, h: 1080, label: "feed square (FB + IG)" },
  portrait: { w: 1080, h: 1350, label: "feed portrait (IG, recommended)" },
  story:    { w: 1080, h: 1920, label: "story / reel" },
};

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

async function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { await stat(p); return p; } catch {}
  }
  throw new Error("No Chrome/Chromium found. Edit CHROME_CANDIDATES in render.mjs.");
}

function serve() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(ROOT, urlPath);
    // don't serve outside the kit
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/* Reads the PNG IHDR chunk — width/height are bytes 16..24. Verifying the real
   output dimensions catches a wrong --window-size, which is otherwise invisible
   until the image is already posted. */
async function pngSize(file) {
  const buf = await readFile(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function main() {
  const args = process.argv.slice(2);
  const filter = args.find((a) => !a.startsWith("--"));
  const only = args.filter((a) => a.startsWith("--")).map((a) => a.slice(2));
  const formats = only.length
    ? Object.fromEntries(Object.entries(FORMATS).filter(([k]) => only.includes(k)))
    : FORMATS;

  const chrome = await findChrome();
  await mkdir(path.join(ROOT, "export"), { recursive: true });

  let posts = (await readdir(path.join(ROOT, "posts")))
    .filter((f) => f.endsWith(".html"))
    .sort();
  if (filter) posts = posts.filter((f) => f.startsWith(filter));

  if (!posts.length) {
    console.error(`No posts matched${filter ? ` "${filter}"` : ""}.`);
    process.exit(1);
  }

  const server = await serve();
  const stamp = Date.now(); // cache-bust; a stale render silently ships old art
  let ok = 0, bad = 0;

  for (const post of posts) {
    const slug = post.replace(/\.html$/, "");
    for (const [name, fmt] of Object.entries(formats)) {
      const out = path.join(ROOT, "export", `${slug}_${name}_${fmt.w}x${fmt.h}.png`);
      const url = `http://localhost:${PORT}/posts/${post}?f=${name}&v=${stamp}`;
      await execFileAsync(chrome, [
        "--headless", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--disk-cache-dir=/dev/null",
        `--window-size=${fmt.w},${fmt.h}`,
        `--screenshot=${out}`, url,
      ]).catch(() => {}); // headless Chrome exits non-zero on benign warnings

      try {
        const size = await pngSize(out);
        if (size.w === fmt.w && size.h === fmt.h) {
          console.log(`  ok   ${path.basename(out)}`);
          ok++;
        } else {
          console.log(`  BAD  ${path.basename(out)} — got ${size.w}x${size.h}, want ${fmt.w}x${fmt.h}`);
          bad++;
        }
      } catch {
        console.log(`  FAIL ${path.basename(out)} — no output produced`);
        bad++;
      }
    }
  }

  server.close();
  console.log(`\n${ok} rendered, ${bad} failed → export/`);
  process.exit(bad ? 1 : 0);
}

main();
