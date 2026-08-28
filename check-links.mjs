// Crawls the built site from index.html following ONLY raw HTML links, the way
// a search engine that ignores JavaScript does. Reports what is reachable, how
// deep it sits and whether any internal link is dead.
//
//   node check-links.mjs            # check this directory
//   node check-links.mjs <path>     # check another build
//
// Written after the catalog turned out to be an orphan island: 12k pages that
// existed, were correct, and had no path into them from the front page.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
const start = "index.html";

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

// Map an href, relative to the page it appears on, to a file on disk.
async function resolveTarget(fromRel, href) {
  if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return null;
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return null;
  const abs = clean.startsWith("/")
    ? path.posix.normalize(clean.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromRel.replaceAll("\\", "/")), clean));
  if (abs.startsWith("..")) return null;
  if (await isFile(path.join(root, abs))) return abs;
  const asIndex = path.posix.join(abs, "index.html");
  if (await isFile(path.join(root, asIndex))) return asIndex;
  return { missing: abs };
}

// Both language trees are crawled: Ukrainian from /index.html, Russian from
// /ru/index.html, since nothing on the Ukrainian side links into /ru except the
// language switch (which is a root-relative link and resolves fine).
const entryPoints = [];
for (const candidate of [start, "ru/index.html"]) {
  if (await isFile(path.join(root, candidate))) entryPoints.push(candidate);
}
const seen = new Set(entryPoints);
const depth = new Map(entryPoints.map((p) => [p, 0]));
const broken = [];
const queue = [...entryPoints];

while (queue.length) {
  const current = queue.shift();
  if (!current.endsWith(".html")) continue;
  const html = await fs.readFile(path.join(root, current), "utf8");
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
    const target = await resolveTarget(current, match[1]);
    if (!target) continue;
    if (target.missing) {
      broken.push(`${current} -> ${match[1]}`);
      continue;
    }
    if (seen.has(target)) continue;
    seen.add(target);
    depth.set(target, depth.get(current) + 1);
    queue.push(target);
  }
}

const reached = [...seen];
const maxDepth = (list) => list.reduce((deepest, item) => Math.max(deepest, depth.get(item)), 0);
const report = async (label, prefix) => {
  const hit = reached.filter((item) => item.startsWith(`${prefix}/`));
  const onDisk = (await fs.readdir(path.join(root, prefix))).filter((name) => name.endsWith(".html"));
  const missed = onDisk.filter((name) => !seen.has(`${prefix}/${name}`));
  console.log(`  ${label}: ${hit.length} of ${onDisk.length} on disk, max depth ${maxDepth(hit)}`);
  if (missed.length) console.log(`    unreachable: ${missed.length} — ${missed.slice(0, 5).join(", ")}`);
  return missed.length;
};

console.log(`Reachable without JavaScript: ${reached.length} pages`);
const missedCategories = await report("catalog     ", "catalog");
const missedProducts = await report("products    ", "products");
const missedRuCategories = await report("ru/catalog  ", "ru/catalog");
const missedRuProducts = await report("ru/products ", "ru/products");
console.log(`Broken internal links: ${broken.length}`);
for (const item of broken.slice(0, 15)) console.log(`  ! ${item}`);

if (broken.length || missedCategories || missedProducts || missedRuCategories || missedRuProducts) process.exitCode = 1;
