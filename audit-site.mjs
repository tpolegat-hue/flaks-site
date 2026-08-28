// Static QA pass over the built site: the checks a reviewer would run by hand
// before a release, but across thousands of pages instead of five.
//
//   node audit-site.mjs [path] [--sample N]
//
// Every finding is printed as FAIL (must fix) or WARN (worth a look), with the
// page it was found on, so nothing is a bare number.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const sampleIndex = args.indexOf("--sample");
const sampleSize = Number(sampleIndex >= 0 ? args[sampleIndex + 1] : 200);
const positional = args.filter((a, i) => !a.startsWith("--") && i !== sampleIndex + 1);
const root = positional[0] || path.dirname(fileURLToPath(import.meta.url));
const SITE = "https://www.flaks.com.ua";

const findings = [];
const fail = (check, detail) => findings.push({ level: "FAIL", check, detail });
const warn = (check, detail) => findings.push({ level: "WARN", check, detail });

const read = (rel) => fs.readFile(path.join(root, rel), "utf8");
const exists = async (rel) => {
  try {
    await fs.stat(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
};

const data = JSON.parse((await read("data.js")).replace(/^﻿?window\.FLAKS_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const productBySku = new Map(data.products.map((p) => [p.sku, p]));

// --- 1. data.js invariants -------------------------------------------------
{
  const noPrice = data.products.filter((p) => !(Number(p.price) > 0));
  if (noPrice.length) fail("data: товар без цены", `${noPrice.length}, напр. ${noPrice[0].sku}`);
  const skus = new Set();
  const dupes = [];
  for (const p of data.products) {
    if (skus.has(p.sku)) dupes.push(p.sku);
    skus.add(p.sku);
  }
  if (dupes.length) fail("data: дубли SKU", `${dupes.length}, напр. ${dupes.slice(0, 3).join(", ")}`);
  const zeroQty = data.products.filter((p) => !(Number(p.qty) > 0));
  if (zeroQty.length) warn("data: нулевой остаток", `${zeroQty.length}, напр. ${zeroQty[0].sku} — страница скажет «0 шт»`);
  for (const category of data.categories) {
    const real = data.products.filter((p) => p.categorySlug === category.slug).length;
    if (real !== category.count) fail("data: счётчик категории врёт", `${category.slug}: указано ${category.count}, фактически ${real}`);
  }
}

// --- 2. versioned data file matches index.html -----------------------------
{
  const indexHtml = await read("index.html");
  const referenced = indexHtml.match(/"(data\.[a-f0-9]{12}\.js)"/);
  if (!referenced) fail("index.html: не найдена ссылка на data.<hash>.js", "");
  else if (!(await exists(referenced[1]))) fail("index.html ссылается на несуществующий файл данных", referenced[1]);
}

// --- 3. sitemap <-> filesystem --------------------------------------------
const sitemapLocs = new Set();
{
  for (const file of ["sitemap-pages.xml", "sitemap-categories.xml", "sitemap-products.xml"]) {
    if (!(await exists(file))) { fail("sitemap: файл отсутствует", file); continue; }
    const xml = await read(file);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const seen = new Set();
    for (const loc of locs) {
      if (seen.has(loc)) fail("sitemap: URL продублирован", loc);
      seen.add(loc);
      sitemapLocs.add(loc);
    }
    const badDates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]).filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
    if (badDates.length) fail("sitemap: некорректная дата", `${file}: ${badDates[0]}`);
  }

  const onDisk = [];
  for (const [prefix, dir] of [["", "catalog"], ["", "products"], ["/ru", "ru/catalog"], ["/ru", "ru/products"]]) {
    if (!(await exists(dir))) { fail("каталог отсутствует", dir); continue; }
    for (const name of await fs.readdir(path.join(root, dir))) {
      if (!name.endsWith(".html")) continue;
      const clean = dir.replace(/^ru\//, "");
      const url = name === "index.html" ? `${SITE}${prefix}/${clean}` : `${SITE}${prefix}/${clean}/${name}`;
      onDisk.push(url);
    }
  }
  const missingFromSitemap = onDisk.filter((u) => !sitemapLocs.has(u));
  if (missingFromSitemap.length) {
    fail("sitemap: страница есть на диске, но не в карте", `${missingFromSitemap.length}, напр. ${missingFromSitemap[0]}`);
  }
  const diskSet = new Set(onDisk);
  const ghosts = [...sitemapLocs].filter((u) => /\/(catalog|products)\//.test(u) && !diskSet.has(u));
  if (ghosts.length) fail("sitemap: URL без файла", `${ghosts.length}, напр. ${ghosts[0]}`);
}

// --- 4. page-level checks --------------------------------------------------
const pick = (list, n) => {
  if (list.length <= n) return list;
  const step = list.length / n;
  return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
};

const catalogPages = (await fs.readdir(path.join(root, "catalog"))).filter((f) => f.endsWith(".html"));
const productPages = pick((await fs.readdir(path.join(root, "products"))).filter((f) => f.endsWith(".html")), sampleSize);

const targets = [
  { rel: "ru/index.html", url: `${SITE}/ru`, lang: "ru" },
  ...catalogPages.map((f) => ({ rel: `catalog/${f}`, url: f === "index.html" ? `${SITE}/catalog` : `${SITE}/catalog/${f}`, lang: "uk" })),
  ...catalogPages.map((f) => ({ rel: `ru/catalog/${f}`, url: f === "index.html" ? `${SITE}/ru/catalog` : `${SITE}/ru/catalog/${f}`, lang: "ru" })),
  ...productPages.map((f) => ({ rel: `products/${f}`, url: `${SITE}/products/${f}`, lang: "uk" })),
  ...productPages.map((f) => ({ rel: `ru/products/${f}`, url: `${SITE}/ru/products/${f}`, lang: "ru" })),
];

const titles = new Map();
let checked = 0;
for (const target of targets) {
  if (!(await exists(target.rel))) { fail("страница отсутствует", target.rel); continue; }
  const html = await read(target.rel);
  checked++;

  const htmlLang = html.match(/<html lang="([^"]*)"/)?.[1];
  if (htmlLang !== target.lang) fail("lang не совпадает с деревом", `${target.rel}: <html lang="${htmlLang}">`);

  const leftovers = (html.match(/data-lang-content/g) || []).length;
  if (leftovers) fail("остались двуязычные спаны", `${target.rel}: ${leftovers}`);

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical !== target.url) fail("canonical не на себя", `${target.rel}: ${canonical}`);

  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => [m[1], m[2]]);
  const byLang = Object.fromEntries(alts);
  const expectUk = target.url.replace(`${SITE}/ru`, SITE).replace(`${SITE}/catalog`, `${SITE}/catalog`);
  if (!byLang.uk || !byLang.ru || !byLang["x-default"]) fail("нет полного набора hreflang", target.rel);
  else {
    const other = target.lang === "uk" ? byLang.ru : byLang.uk;
    const self = target.lang === "uk" ? byLang.uk : byLang.ru;
    if (self !== target.url) fail("hreflang на себя указывает не туда", `${target.rel}: ${self}`);
    if (byLang["x-default"] !== byLang.uk) fail("x-default не равен украинской версии", target.rel);
    // Reciprocity: the alternate must exist on disk and point back here.
    const otherRel = other.replace(`${SITE}/`, "").replace(/\/$/, "") || "index.html";
    const otherFile = otherRel.endsWith(".html") ? otherRel : `${otherRel}/index.html`;
    if (!(await exists(otherFile))) fail("hreflang ведёт на несуществующую страницу", `${target.rel} -> ${other}`);
    else {
      const otherHtml = await read(otherFile);
      const back = otherHtml.match(new RegExp(`<link rel="alternate" hreflang="${target.lang}" href="([^"]*)"`))?.[1];
      if (back !== target.url) fail("hreflang не взаимный", `${target.rel} -> ${other} -> ${back}`);
    }
  }

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) fail("нет title", target.rel);
  else {
    if (title.length > 70) warn("title длиннее 70 символов", `${target.rel}: ${title.length}`);
    if (titles.has(title)) warn("дублирующийся title", `${target.rel} и ${titles.get(title)}`);
    else titles.set(title, target.rel);
  }

  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!description) fail("нет meta description", target.rel);
  else if (description.length > 200) warn("description длиннее 200 символов", `${target.rel}: ${description.length}`);

  const h1count = (html.match(/<h1[ >]/g) || []).length;
  if (h1count !== 1) fail(`h1 не один (${h1count})`, target.rel);

  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
  if (robots && /noindex/.test(robots)) fail("страница закрыта от индексации", `${target.rel}: ${robots}`);

  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try {
      parsed = JSON.parse(block[1].replaceAll("\\u003c", "<"));
    } catch (error) {
      fail("JSON-LD не парсится", `${target.rel}: ${String(error).slice(0, 60)}`);
      continue;
    }
    if (parsed["@type"] === "Product") {
      const sku = parsed.sku;
      const product = productBySku.get(sku);
      if (!product) fail("JSON-LD: неизвестный SKU", `${target.rel}: ${sku}`);
      else if (Number(parsed.offers?.price) !== Number(product.price)) {
        fail("JSON-LD: цена расходится с data.js", `${target.rel}: ${parsed.offers?.price} vs ${product.price}`);
      }
      if (!parsed.offers?.availability) fail("JSON-LD: нет availability", target.rel);
      if (parsed.offers?.url !== target.url) fail("JSON-LD: offer.url не совпадает с canonical", `${target.rel}: ${parsed.offers?.url}`);
    }
    if (parsed["@type"] === "BreadcrumbList") {
      const positions = parsed.itemListElement.map((i) => i.position);
      const ok = positions.every((p, i) => p === i + 1);
      if (!ok) fail("JSON-LD: позиции в хлебных крошках не по порядку", `${target.rel}: ${positions.join(",")}`);
    }
  }

  for (const img of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = img[1];
    if (/^(https?:|data:)/.test(src)) continue;
    // Root-absolute srcs resolve from the site root, the rest from the page.
    const resolved = src.startsWith("/")
      ? path.posix.normalize(src.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(target.rel), src));
    if (!(await exists(resolved))) fail("картинка не найдена", `${target.rel} -> ${src}`);
  }
}

// --- report ----------------------------------------------------------------
const fails = findings.filter((f) => f.level === "FAIL");
const warns = findings.filter((f) => f.level === "WARN");
console.log(`Проверено страниц: ${checked} (все страницы каталога в обоих деревьях + по ${productPages.length} карточек)`);
console.log(`FAIL: ${fails.length}   WARN: ${warns.length}\n`);

const group = (list) => {
  const map = new Map();
  for (const f of list) {
    if (!map.has(f.check)) map.set(f.check, []);
    map.get(f.check).push(f.detail);
  }
  return map;
};
for (const [level, list] of [["FAIL", fails], ["WARN", warns]]) {
  if (!list.length) continue;
  console.log(`=== ${level} ===`);
  for (const [check, details] of group(list)) {
    console.log(`  ${check} — ${details.length}`);
    for (const d of details.slice(0, 3)) console.log(`      ${d}`);
    if (details.length > 3) console.log(`      … ещё ${details.length - 3}`);
  }
  console.log("");
}
process.exitCode = fails.length ? 1 : 0;
