import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseSpecs, buildSpecRows, buildDescription, buildMetaDescription } from "./seo-spec.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const siteUrl = (globalThis.process?.env?.SITE_URL || "https://www.flaks.com.ua").replace(/\/$/, "");
const dataText = await fs.readFile(path.join(root, "data.js"), "utf8");
const data = JSON.parse(dataText.replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const dataHash = crypto.createHash("sha256").update(dataText).digest("hex").slice(0, 12);
const versionedDataFile = `data.${dataHash}.js`;

const productDir = path.join(root, "products");
const categoryDir = path.join(root, "catalog");
const categoryPageSize = 120;
const contentLastmod = String(data.priceUpdatedAt || data.generatedAt || "2026-05-26").slice(0, 10);
await fs.mkdir(productDir, { recursive: true });
await fs.mkdir(categoryDir, { recursive: true });

async function writeBatched(items, writer, batchSize = 150) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(writer));
  }
}

async function refreshVersionedDataFile() {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && /^data\.[a-f0-9]{12}\.js$/.test(entry.name) && entry.name !== versionedDataFile) {
      await fs.unlink(path.join(root, entry.name));
    }
  }
  await fs.writeFile(path.join(root, versionedDataFile), dataText, "utf8");
  const indexPath = path.join(root, "index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const nextHtml = indexHtml.replace(/"data(?:\.[a-f0-9]{12})?\.js"/, `"${versionedDataFile}"`);
  if (nextHtml !== indexHtml) {
    await fs.writeFile(indexPath, nextHtml, "utf8");
  }
}

await refreshVersionedDataFile();
async function readJsonIfExists(relativePath) {
  try {
    return JSON.parse((await fs.readFile(path.join(root, relativePath), "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

const merchantImages = await readJsonIfExists("assets/merchant-images/manifest.json");

function absoluteAssetUrl(assetPath) {
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  const normalizedPath = String(assetPath || "").startsWith("/") ? assetPath : `/${assetPath}`;
  return `${siteUrl}${normalizedPath}`;
}

function merchantImageRelPath(product) {
  const rel =
    merchantImages.products?.[product.sku] ||
    merchantImages.categoryFallbacks?.[product.categorySlug] ||
    "/assets/flaks-og.jpg";
  if (/^https?:\/\//i.test(rel)) return rel;
  return `..${rel.startsWith("/") ? rel : `/${rel}`}`;
}

function merchantImageUrl(product) {
  return absoluteAssetUrl(
    merchantImages.products?.[product.sku] ||
      merchantImages.categoryFallbacks?.[product.categorySlug] ||
      "/assets/flaks-og.jpg",
  );
}

const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

for (const entry of await fs.readdir(categoryDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html")) {
    await fs.unlink(path.join(categoryDir, entry.name));
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugProduct(product) {
  return `${product.sku.toLowerCase()}.html`;
}

function price(value) {
  return Number(value).toFixed(2);
}

function cartAttrs(product) {
  return [
    "data-cart-add",
    `data-cart-sku="${esc(product.sku)}"`,
    `data-cart-name-ua="${esc(product.nameUa)}"`,
    `data-cart-name-ru="${esc(product.nameRu)}"`,
    `data-cart-price="${esc(product.price)}"`,
    `data-cart-stock="${esc(product.qty)}"`,
  ].join(" ");
}

function lastmod(value) {
  return String(value || contentLastmod).slice(0, 10);
}

function categoryPageHref(category, pageNumber) {
  return pageNumber === 1 ? `/catalog/${category.slug}.html` : `/catalog/${category.slug}-page-${pageNumber}.html`;
}

function pagination(category, currentPage, totalPages) {
  if (totalPages <= 1) return "";
  const links = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const href = `..${categoryPageHref(category, pageNumber)}`;
    const label = `${pageNumber}`;
    links.push(
      pageNumber === currentPage
        ? `<span aria-current="page">${label}</span>`
        : `<a href="${href}" data-keep-lang>${label}</a>`,
    );
  }
  return `<nav class="seo-pagination" aria-label="Catalog pagination">
    <span><span data-lang-content="uk">Сторінка ${currentPage} з ${totalPages}</span><span data-lang-content="ru" hidden>Страница ${currentPage} из ${totalPages}</span></span>
    ${links.join("")}
  </nav>`;
}

function page(title, description, body, jsonLd, canonicalUrl, titleRu = title, descriptionRu = description, lang = "uk") {
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-675L0XL19Y"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-675L0XL19Y');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="google-site-verification" content="ktStUU9o0Pp1VxKn6AknzUox_oK7NCcKQa6A4uee4-I" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="robots" content="index,follow">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="FLAKS">
    <meta property="og:image" content="${siteUrl}/assets/flaks-og.jpg">
    <link rel="canonical" href="${esc(canonicalUrl)}">
    <link rel="alternate" hreflang="uk-UA" href="${esc(canonicalUrl)}">
    <link rel="alternate" hreflang="ru-UA" href="${esc(canonicalUrl)}?lang=ru">
    <link rel="alternate" hreflang="x-default" href="${esc(canonicalUrl)}">
    <link rel="icon" type="image/png" href="../assets/favicon-32.png">
    <link rel="stylesheet" href="../styles.css">
    ${(Array.isArray(jsonLd) ? jsonLd : [jsonLd])
      .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry)}</script>`)
      .join("\n    ")}
  </head>
  <body data-title-uk="${esc(title)}" data-title-ru="${esc(titleRu)}" data-description-uk="${esc(description)}" data-description-ru="${esc(descriptionRu)}">
    <header class="topbar">
      <a class="brand" href="../index.html" data-keep-lang>
        <span class="brand-mark"><img src="../assets/icon-192.png" alt=""></span>
        <span><strong>FLAKS</strong><small><span data-lang-content="uk">Металообробний інструмент</span><span data-lang-content="ru" hidden>Металлообрабатывающий инструмент</span></small></span>
      </a>
      <nav class="top-actions">
        <a class="contact-link" href="../index.html#catalog" data-keep-lang><span data-lang-content="uk">Каталог</span><span data-lang-content="ru" hidden>Каталог</span></a>
        <a class="contact-link" href="../about.html" data-keep-lang><span data-lang-content="uk">Про компанію</span><span data-lang-content="ru" hidden>О компании</span></a>
        <a class="contact-link" href="../delivery.html" data-keep-lang><span data-lang-content="uk">Доставка</span><span data-lang-content="ru" hidden>Доставка</span></a>
        <a class="contact-link" href="../contacts.html" data-keep-lang><span data-lang-content="uk">Контакти</span><span data-lang-content="ru" hidden>Контакты</span></a>
        <a class="contact-link" href="../articles" data-keep-lang><span data-lang-content="uk">Статті</span><span data-lang-content="ru" hidden>Статьи</span></a>
        <a class="contact-link" href="tel:+380675453115">+380 67 545 31 15</a>
        <a class="contact-link" href="mailto:tpolegat@gmail.com">tpolegat@gmail.com</a>
        <button class="cart-nav-button" type="button" data-cart-open><span data-lang-content="uk">Кошик</span><span data-lang-content="ru" hidden>Корзина</span><strong data-cart-count>0</strong></button>
        <div class="lang-switch" role="group" aria-label="Language">
          <button class="active" type="button" data-lang="uk">UA</button>
          <button type="button" data-lang="ru">RU</button>
        </div>
      </nav>
    </header>
    <main class="seo-page">
      ${body}
    </main>
    <footer class="footer">
      <strong>FLAKS</strong>
      <span><span data-lang-content="uk">Ціни в гривні без ПДВ</span><span data-lang-content="ru" hidden>Цены в гривне без НДС</span></span>
      <a href="../index.html#catalog" data-keep-lang><span data-lang-content="uk">Повернутися до каталогу</span><span data-lang-content="ru" hidden>Вернуться в каталог</span></a>
    </footer>
    <script src="../assets/seo-lang-switch.js"></script>
    <script src="../assets/cart.js"></script>
    <script src="../assets/motion.js"></script>
  </body>
</html>`;
}

function productJsonLd(product, specs) {
  const brand = specs.brand || "FLAKS";
  const material = specs.materials.map((m) => m.code).join(" / ");
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameUa || product.nameRu,
    alternateName: product.nameRu,
    sku: product.sku,
    mpn: product.sku,
    brand: { "@type": "Brand", name: brand },
    ...(material ? { material } : {}),
    category: product.categoryUa || product.categoryRu,
    image: merchantImageUrl(product),
    description: buildDescription(product, specs, "ua"),
    offers: {
      "@type": "Offer",
      priceCurrency: "UAH",
      price: price(product.price),
      priceValidUntil,
      itemCondition: specs.condition === "used" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
      availability: product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl}/products/${slugProduct(product)}`,
      seller: { "@type": "Organization", name: "FLAKS", telephone: "+380675453115", email: "tpolegat@gmail.com" },
    },
  };
}

function breadcrumbJsonLd(product) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Каталог FLAKS", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: product.categoryUa || product.categoryRu,
        item: `${siteUrl}/catalog/${product.categorySlug}.html`,
      },
      { "@type": "ListItem", position: 3, name: product.nameUa || product.nameRu, item: `${siteUrl}/products/${slugProduct(product)}` },
    ],
  };
}

function categoryJsonLd(category, products) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.ua} / ${category.ru} | FLAKS`,
    description: `Категорія FLAKS: ${category.ua}. Ціни в гривні без ПДВ, наявність зі складу.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 100).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/products/${slugProduct(product)}`,
        name: product.nameUa || product.nameRu,
      })),
    },
  };
}

const pageUrls = [
  { loc: `${siteUrl}/`, priority: "1.0" },
  { loc: `${siteUrl}/about.html`, priority: "0.9" },
  { loc: `${siteUrl}/delivery.html`, priority: "0.7" },
  { loc: `${siteUrl}/contacts.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles`, priority: "0.8" },
  { loc: `${siteUrl}/articles/yak-pidibraty-metalorizalnyi-instrument.html`, priority: "0.7" },
];
const categoryUrls = [];
const productUrls = [];
const categoryPageWrites = [];

for (const category of data.categories.filter((item) => item.count > 0)) {
  const products = data.products.filter((product) => product.categorySlug === category.slug);
  const totalPages = Math.max(1, Math.ceil(products.length / categoryPageSize));
  const categoryLastmod = products.reduce((date, product) => {
    const productDate = lastmod(product.updatedAt);
    return productDate > date ? productDate : date;
  }, contentLastmod);

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const pageProducts = products.slice((pageNumber - 1) * categoryPageSize, pageNumber * categoryPageSize);
    const rows = pageProducts
      .map((product) => `<tr>
        <td><a href="../products/${slugProduct(product)}"><span data-lang-content="uk">${esc(product.nameUa)}</span><span data-lang-content="ru" hidden>${esc(product.nameRu)}</span></a><small>${esc(product.sku)}</small></td>
        <td>${esc(product.sku)}</td>
        <td>${esc(product.qty)}</td>
        <td>${esc(product.price)} UAH</td>
        <td><button class="cart-add-button" type="button" ${cartAttrs(product)}></button></td>
      </tr>`)
      .join("");
    const rangeStart = (pageNumber - 1) * categoryPageSize + 1;
    const rangeEnd = Math.min(pageNumber * categoryPageSize, products.length);
    const pageSuffixUk = pageNumber > 1 ? `, сторінка ${pageNumber}` : "";
    const pageSuffixRu = pageNumber > 1 ? `, страница ${pageNumber}` : "";

    const title = `${category.ua} — купити в Україні${pageSuffixUk} | FLAKS`;
    const description = `${category.ua}: позиції ${rangeStart}-${rangeEnd} із ${products.length} зі складу. Ціни в гривні без ПДВ, заявки через email або телефон.`;
    const titleRu = `${category.ru} купить в Украине${pageSuffixRu} | FLAKS`;
    const descriptionRu = `${category.ru}: позиции ${rangeStart}-${rangeEnd} из ${products.length} со склада. Цены в гривне без НДС, заявки через email или телефон.`;
    const body = `<section class="seo-hero">
        <p class="eyebrow"><span data-lang-content="uk">Категорія інструменту</span><span data-lang-content="ru" hidden>Категория инструмента</span></p>
        <h1><span data-lang-content="uk">${esc(category.ua)}</span><span data-lang-content="ru" hidden>${esc(category.ru)}</span></h1>
        <p><span data-lang-content="uk">${esc(description)}</span><span data-lang-content="ru" hidden>${esc(descriptionRu)}</span></p>
      </section>
      ${pagination(category, pageNumber, totalPages)}
      <section class="seo-table-wrap">
        <p class="seo-note"><span data-lang-content="uk">Показано позиції ${rangeStart}-${rangeEnd} із ${products.length}. Для точного підбору використовуйте пошук за назвою, кодом, діаметром ф / Ø та розміром.</span><span data-lang-content="ru" hidden>Показаны позиции ${rangeStart}-${rangeEnd} из ${products.length}. Для точного подбора используйте поиск по названию, коду, диаметру ф / Ø и размеру.</span></p>
        <table>
          <thead><tr><th><span data-lang-content="uk">Найменування</span><span data-lang-content="ru" hidden>Наименование</span></th><th>Код</th><th><span data-lang-content="uk">К-сть</span><span data-lang-content="ru" hidden>Кол-во</span></th><th><span data-lang-content="uk">Ціна без ПДВ</span><span data-lang-content="ru" hidden>Цена без НДС</span></th><th><span data-lang-content="uk">Кошик</span><span data-lang-content="ru" hidden>Корзина</span></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      ${pagination(category, pageNumber, totalPages)}`;

    const href = categoryPageHref(category, pageNumber);
    const categoryUrl = `${siteUrl}${href}`;
    const fileName = pageNumber === 1 ? `${category.slug}.html` : `${category.slug}-page-${pageNumber}.html`;
    categoryPageWrites.push({
      fileName,
      html: page(title, description, body, categoryJsonLd(category, pageProducts), categoryUrl, titleRu, descriptionRu),
    });
    categoryUrls.push({ loc: categoryUrl, priority: pageNumber === 1 ? "0.8" : "0.55", lastmod: categoryLastmod });
  }
}

await writeBatched(categoryPageWrites, ({ fileName, html }) => fs.writeFile(path.join(categoryDir, fileName), html, "utf8"), 50);

// Index products by category for internal linking ("related products").
const byCategory = new Map();
for (const product of data.products) {
  if (!byCategory.has(product.categorySlug)) byCategory.set(product.categorySlug, []);
  byCategory.get(product.categorySlug).push(product);
}
const catPos = new Map();
for (const arr of byCategory.values()) arr.forEach((product, index) => catPos.set(product.sku, index));

function bilingual(uk, ru) {
  return `<span data-lang-content="uk">${esc(uk)}</span><span data-lang-content="ru" hidden>${esc(ru)}</span>`;
}

function breadcrumbHtml(product) {
  return `<nav class="seo-breadcrumb" aria-label="breadcrumb">
      <a href="../index.html" data-keep-lang>${bilingual("Головна", "Главная")}</a>
      <span aria-hidden="true">›</span>
      <a href="../catalog/${esc(product.categorySlug)}.html" data-keep-lang>${bilingual(product.categoryUa, product.categoryRu)}</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">${bilingual(product.nameUa, product.nameRu)}</span>
    </nav>`;
}

function specTableHtml(rows) {
  const body = rows
    .map((row) => `<tr><th scope="row">${bilingual(row.labelUa, row.labelRu)}</th><td>${bilingual(row.valueUa, row.valueRu)}</td></tr>`)
    .join("");
  return `<section class="content-section">
      <h2>${bilingual("Характеристики", "Характеристики")}</h2>
      <table class="spec-table"><tbody>${body}</tbody></table>
    </section>`;
}

function descriptionBlockHtml(product, specs) {
  return `<section class="content-section seo-prose">
      <h2>${bilingual("Опис", "Описание")}</h2>
      <p>${bilingual(buildDescription(product, specs, "ua"), buildDescription(product, specs, "ru"))}</p>
    </section>`;
}

function relatedHtml(product) {
  const siblings = byCategory.get(product.categorySlug) || [];
  const index = catPos.get(product.sku) ?? 0;
  const picks = [...siblings.slice(Math.max(0, index - 4), index), ...siblings.slice(index + 1, index + 5)].slice(0, 8);
  if (!picks.length) return "";
  const items = picks
    .map((s) => `<li><a href="../products/${slugProduct(s)}" data-keep-lang>${bilingual(s.nameUa, s.nameRu)}</a></li>`)
    .join("");
  return `<section class="content-section seo-related">
      <h2>${bilingual("Схожі товари", "Похожие товары")}</h2>
      <ul>${items}</ul>
      <a class="seo-related-all" href="../catalog/${esc(product.categorySlug)}.html" data-keep-lang>${bilingual(
        `Усі товари категорії «${product.categoryUa}»`,
        `Все товары категории «${product.categoryRu}»`,
      )}</a>
    </section>`;
}

const productPageWrites = [];

for (const product of data.products) {
  const specs = parseSpecs(product);
  const title = `${product.nameUa} купити в Україні | FLAKS`;
  const titleRu = `${product.nameRu} купить в Украине | FLAKS`;
  const description = buildMetaDescription(product, specs, "ua");
  const descriptionRu = buildMetaDescription(product, specs, "ru");
  const body = `${breadcrumbHtml(product)}
    <section class="seo-hero seo-product-hero">
      <div class="seo-product-media">
        <img src="${esc(merchantImageRelPath(product))}" alt="${esc(product.nameUa)}" loading="lazy" width="360" height="360">
      </div>
      <div class="seo-product-info">
        <p class="eyebrow">${bilingual(product.categoryUa, product.categoryRu)}</p>
        <h1>${bilingual(product.nameUa, product.nameRu)}</h1>
        <div class="seo-product-facts">
          <strong>${esc(product.price)} UAH</strong>
          <span>${bilingual("без ПДВ", "без НДС")}</span>
          <span>${bilingual("Наявність", "Наличие")}: ${esc(product.qty)} шт.</span>
          <span>${bilingual("Код", "Код")}: ${esc(product.sku)}</span>
        </div>
        <div class="hero-actions">
          <button class="cart-add-button" type="button" ${cartAttrs(product)}></button>
          <a class="secondary-button" href="tel:+380675453115">${bilingual("Зателефонувати", "Позвонить")}</a>
        </div>
      </div>
    </section>
    ${descriptionBlockHtml(product, specs)}
    ${specTableHtml(buildSpecRows(product, specs))}
    ${relatedHtml(product)}`;

  const productUrl = `${siteUrl}/products/${slugProduct(product)}`;
  productPageWrites.push({
    fileName: slugProduct(product),
    html: page(
      title,
      description,
      body,
      [productJsonLd(product, specs), breadcrumbJsonLd(product)],
      productUrl,
      titleRu,
      descriptionRu,
    ),
  });
  productUrls.push({ loc: productUrl, priority: "0.6", lastmod: lastmod(product.updatedAt) });
}

await writeBatched(productPageWrites, ({ fileName, html }) => fs.writeFile(path.join(productDir, fileName), html, "utf8"));

function sitemapUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${esc(url.loc)}</loc><lastmod>${lastmod(url.lastmod)}</lastmod><priority>${url.priority}</priority></url>`)
  .join("\n")}
</urlset>
`;
}


function merchantText(value, maxLength = 5000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/червячн\S*/gi, "зуборезные")
    .replace(/черв['’]?ячн\S*/gi, "зуборізні")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

const GOOGLE_PRODUCT_CATEGORY_BY_SLUG = {
  "metchiki-mr-metricheskie-pravye": "1184",
  "metchiki-levye": "1184",
  "metchiki-mr-cherez-shag": "1184",
  "metchiki-g-tr-k-rc-ktr": "1184",
  "metchiki-ruchnye": "1184",
  "metchiki-trapetsiya-i-dr": "1184",
  "metchiki-gaechnye": "1184",
  "plashki": "1184",
  "sverla-kkh": "1540",
  "sverla-kkh-tverdosplavnye": "1540",
  "sverla-kkh-kitay": "1540",
  "sverla-tskh-srednie": "1540",
  "sverla-tskh-dlinnye": "1540",
  "sverla-tskh-levye": "1540",
  "sverla-tsentrovochnye": "1540",
  "sverla-tverdosplavnye": "1540",
  "razvertki-zenkera-zenkovki": "1819",
  "frezy-kontsevye": "1180",
  "frezy-diskovye": "1180",
  "frezy-chervyachnye-dolbyaki-t-obr": "1180",
  "frezy-tortsevye-i-drugoe": "1180",
  "kalibry": "1732",
};

function merchantToolKind(product) {
  const text = `${product.nameRu || ""} ${product.nameUa || ""} ${product.sectionRu || ""}`.toLowerCase();
  if (product.categorySlug?.startsWith("metchiki")) return "Metalworking tap";
  if (product.categorySlug === "plashki") return "Threading die";
  if (product.categorySlug?.startsWith("sverla")) return "Metal drill bit";
  if (product.categorySlug?.startsWith("frezy")) return "Metalworking milling cutter";
  if (product.categorySlug === "kalibry") return "Measuring gauge";
  if (product.categorySlug === "razvertki-zenkera-zenkovki") {
    if (/зенковк|зенківк/.test(text)) return "Metalworking countersink";
    if (/зенкер/.test(text)) return "Metalworking counterbore";
    if (/развертк|розгорт/.test(text)) return "Metalworking reamer";
    return "Metalworking reamer and countersink";
  }
  return "Metalworking tool";
}

function merchantMaterial(product) {
  const text = `${product.nameRu || ""} ${product.nameUa || ""}`;
  const matches = [];
  const add = (value) => {
    if (value && !matches.includes(value)) matches.push(value);
  };
  if (/Р6М5К5/i.test(text)) add("HSS Р6М5К5");
  if (/Р6М5/i.test(text)) add("HSS Р6М5");
  if (/Р18/i.test(text)) add("HSS Р18");
  if (/Р9/i.test(text)) add("HSS Р9");
  if (/HSS[-\s]?E/i.test(text)) add("HSS-E");
  else if (/HSS/i.test(text)) add("HSS");
  if (/ВК8/i.test(text)) add("Carbide ВК8");
  if (/Т5К10/i.test(text)) add("Carbide Т5К10");
  if (/Т15К6/i.test(text)) add("Carbide Т15К6");
  if (/твердосплав/i.test(text) && !matches.some((value) => value.includes("Carbide"))) add("Carbide");
  return matches.slice(0, 2).join(" / ");
}

function merchantSize(product) {
  const text = product.nameRu || product.nameUa || "";
  const metric = text.match(/(?:^|[\s(])([MМ]\s*\d+(?:[.,]\d+)?(?:\s*[xх]\s*\d+(?:[.,]\d+)?)?)/i)?.[1];
  if (metric) return metric.replace(/\s+/g, "").replace("М", "M").replace("х", "x");
  const diameter = text.match(/(?:ф|Ø|⌀)\s*=?\s*(\d+(?:[.,]\d+)?)/i)?.[1];
  if (diameter) return `${diameter.replace(",", ".")} mm`;
  const dimensions = text.match(/\b(\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?(?:\s*[xх]\s*\d+(?:[.,]\d+)?)?)\b/i)?.[1];
  if (dimensions) return `${dimensions.replace(/\s+/g, "").replace(/х/gi, "x")} mm`;
  return "";
}

function merchantBrand(product) {
  const text = `${product.nameRu || ""} ${product.nameUa || ""}`;
  const brands = [
    "Della Ferrera",
    "Сестрорецк",
    "Владивосток",
    "ВИЗ",
    "Bucovice",
    "Presto",
    "Gühring",
    "Guhring",
  ];
  return brands.find((brand) => new RegExp(brand.replace("ü", "u"), "i").test(text)) || "";
}

function merchantPriorityLabel(product) {
  const priceValue = Number(product.price);
  const qtyValue = Number(product.qty);
  if (priceValue >= 1000) return "high_value";
  if (qtyValue >= 100) return "high_stock";
  return "standard";
}

function merchantTitle(product) {
  const baseTitle = product.nameUa || product.nameRu;
  const parts = [merchantToolKind(product), merchantSize(product), merchantMaterial(product)].filter(Boolean);
  return merchantText(`${parts.join(" ")} - ${baseTitle}`, 150);
}

function merchantDescription(product) {
  const material = merchantMaterial(product);
  const parts = [
    `Industrial ${merchantToolKind(product).toLowerCase()} for machining metal`,
    material ? `Material: ${material}` : "",
    product.nameUa || product.nameRu,
    product.categoryUa || product.categoryRu,
    product.sectionUa || product.sectionRu,
    `Code: ${product.sku}`,
  ];
  return merchantText(parts.filter(Boolean).join(". "));
}

function merchantGoogleProductCategory(product) {
  return GOOGLE_PRODUCT_CATEGORY_BY_SLUG[product.categorySlug] || "1167";
}
function merchantFeed(products) {
  const items = products
    .filter((product) => Number(product.qty) > 0 && Number(product.price) > 0)
    .map((product) => {
      const title = merchantTitle(product);
      const imageUrl = merchantImageUrl(product);
      const description = merchantDescription(product);
      const condition = parseSpecs(product).condition === "used" ? "used" : "new";
      return `    <item>
      <g:id>${esc(product.sku)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(description)}</g:description>
      <g:link>${esc(`${siteUrl}/products/${slugProduct(product)}`)}</g:link>
      <g:image_link>${esc(imageUrl)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${price(product.price)} UAH</g:price>
      <g:condition>${condition}</g:condition>
      <g:google_product_category>${esc(merchantGoogleProductCategory(product))}</g:google_product_category>
      <g:mpn>${esc(product.sku)}</g:mpn>
      ${merchantBrand(product) ? `<g:brand>${esc(merchantBrand(product))}</g:brand>` : ""}
      ${merchantMaterial(product) ? `<g:material>${esc(merchantMaterial(product))}</g:material>` : ""}
      <g:product_type>${esc(merchantText(product.categoryUa || product.categoryRu, 750))}</g:product_type>
      <g:custom_label_0>${esc(product.categorySlug || "uncategorized")}</g:custom_label_0>
      <g:custom_label_1>${esc(merchantPriorityLabel(product))}</g:custom_label_1>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>FLAKS product feed</title>
    <link>${esc(siteUrl)}</link>
    <description>Metalworking tools available from FLAKS</description>
${items}
  </channel>
</rss>
`;
}
function sitemapIndex(files) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((file) => `  <sitemap><loc>${siteUrl}/${file}</loc><lastmod>${contentLastmod}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
}

await fs.writeFile(path.join(root, "merchant-feed.xml"), merchantFeed(data.products), "utf8");
await fs.writeFile(path.join(root, "sitemap-pages.xml"), sitemapUrlset(pageUrls), "utf8");
await fs.writeFile(path.join(root, "sitemap-categories.xml"), sitemapUrlset(categoryUrls), "utf8");
await fs.writeFile(path.join(root, "sitemap-products.xml"), sitemapUrlset(productUrls), "utf8");
await fs.writeFile(path.join(root, "sitemap.xml"), sitemapIndex(["sitemap-pages.xml", "sitemap-categories.xml", "sitemap-products.xml"]), "utf8");
await fs.writeFile(
  path.join(root, "robots.txt"),
  `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`,
  "utf8",
);

await fs.writeFile(
  path.join(root, "site.webmanifest"),
  JSON.stringify(
    {
      name: "FLAKS",
      short_name: "FLAKS",
      start_url: "/",
      display: "standalone",
      background_color: "#081016",
      theme_color: "#182028",
      description: "Каталог металообробного та металлообрабатывающего инструмента FLAKS.",
      icons: [
        { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`SEO generated: ${data.categories.length} categories, ${data.products.length} product pages, ${pageUrls.length + categoryUrls.length + productUrls.length} sitemap URLs.`);
