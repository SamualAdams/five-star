import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const sourceRoot = new URL("../src/", import.meta.url);
const allowedFile = "theme.css";
const sourceExtensions = new Set([".css", ".js", ".jsx"]);
const colorPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return files.flat();
}

const rootPath = sourceRoot.pathname;
const violations = [];

for (const file of await sourceFiles(rootPath)) {
  if (!sourceExtensions.has(extname(file)) || file.endsWith(allowedFile)) continue;
  const source = (await readFile(file, "utf8")).replace(/&#[0-9]+;/g, "");
  const matches = source.match(colorPattern);
  if (matches) violations.push(`${relative(rootPath, file)}: ${[...new Set(matches)].join(", ")}`);
}

if (violations.length) {
  console.error("Raw colors must live in src/theme.css:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Theme colors are centralized in src/theme.css.");
}
