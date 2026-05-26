import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const siteUrl = (globalThis.process?.env?.SITE_URL || "https://flaks.com.ua").replace(/\/$/, "");
const dataText = await fs.readFile(path.join(root, "data.js"), "utf8");
const data = JSON.parse(dataText.replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, "").replace(/;\s*$/, ""));

const productDir = path.join(root, "products");
const categoryDir = path.join(root, "catalog");
await fs.mkdir(productDir, { recursive: true });
await fs.mkdir(categoryDir, { recursive: true });

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

function page(title, description, body, jsonLd, canonicalUrl, lang = "uk") {
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="robots" content="index,follow">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="FLAKS">
    <meta property="og:image" content="${siteUrl}/assets/flaks-logo.png">
    <link rel="canonical" href="${esc(canonicalUrl)}">
    <link rel="alternate" hreflang="uk-UA" href="${esc(canonicalUrl)}">
    <link rel="alternate" hreflang="ru-UA" href="${esc(canonicalUrl)}?lang=ru">
    <link rel="alternate" hreflang="x-default" href="${esc(canonicalUrl)}">
    <link rel="icon" type="image/png" href="../assets/flaks-logo.png">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="../index.html">
        <span class="brand-mark"><img src="../assets/flaks-logo.png" alt=""></span>
        <span><strong>FLAKS</strong><small>Металообробний інструмент / Металлообрабатывающий инструмент</small></span>
      </a>
      <nav class="top-actions">
        <a class="contact-link" href="tel:+380675453115">+380 67 545 31 15</a>
        <a class="contact-link" href="mailto:tpolegat@gmail.com">tpolegat@gmail.com</a>
      </nav>
    </header>
    <main class="seo-page">
      ${body}
    </main>
    <footer class="footer">
      <strong>FLAKS</strong>
      <span>Ціни в гривні без ПДВ / Цены в гривне без НДС</span>
      <a href="../index.html#catalog">Повернутися до каталогу / Вернуться в каталог</a>
    </footer>
  </body>
</html>`;
}

function productJsonLd(product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameUa || product.nameRu,
    alternateName: product.nameRu,
    sku: product.sku,
    brand: { "@type": "Brand", name: "FLAKS" },
    category: product.categoryUa || product.categoryRu,
    description: `${product.nameUa || product.nameRu}. Наявність: ${product.qty} шт. Ціна без ПДВ: ${product.price} UAH.`,
    offers: {
      "@type": "Offer",
      priceCurrency: "UAH",
      price: price(product.price),
      availability: product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl}/products/${slugProduct(product)}`,
    },
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
      itemListElement: products.slice(0, 500).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/products/${slugProduct(product)}`,
        name: product.nameUa || product.nameRu,
      })),
    },
  };
}

const urls = [
  { loc: `${siteUrl}/`, priority: "1.0" },
  { loc: `${siteUrl}/about.html`, priority: "0.9" },
  { loc: `${siteUrl}/delivery.html`, priority: "0.7" },
  { loc: `${siteUrl}/contacts.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles`, priority: "0.8" },
  { loc: `${siteUrl}/articles/yak-pidibraty-metalorizalnyi-instrument.html`, priority: "0.7" },
];

for (const category of data.categories.filter((item) => item.count > 0)) {
  const products = data.products.filter((product) => product.categorySlug === category.slug);
  const rows = products
    .map((product) => `<tr>
      <td><a href="../products/${slugProduct(product)}">${esc(product.nameUa)}</a><small>${esc(product.nameRu)}</small></td>
      <td>${esc(product.sku)}</td>
      <td>${esc(product.qty)}</td>
      <td>${esc(product.price)} UAH</td>
    </tr>`)
    .join("");

  const title = `${category.ua} / ${category.ru} купити в Україні | FLAKS`;
  const description = `${category.ua}: ${products.length} позицій зі складу. Ціни в гривні без ПДВ, заявки через email або телефон.`;
  const body = `<section class="seo-hero">
      <p class="eyebrow">FLAKS SEO catalog</p>
      <h1>${esc(category.ua)}<span>${esc(category.ru)}</span></h1>
      <p>${esc(description)}</p>
    </section>
    <section class="seo-table-wrap">
      <table>
        <thead><tr><th>Найменування / Наименование</th><th>Код</th><th>К-сть</th><th>Ціна без ПДВ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;

  const categoryUrl = `${siteUrl}/catalog/${category.slug}.html`;
  await fs.writeFile(path.join(categoryDir, `${category.slug}.html`), page(title, description, body, categoryJsonLd(category, products), categoryUrl), "utf8");
  urls.push({ loc: `${siteUrl}/catalog/${category.slug}.html`, priority: "0.8" });
}

for (const product of data.products) {
  const title = `${product.nameUa} купити | FLAKS`;
  const description = `${product.nameUa}. ${product.nameRu}. Ціна ${product.price} UAH без ПДВ, наявність ${product.qty} шт.`;
  const body = `<section class="seo-hero">
      <p class="eyebrow">${esc(product.categoryUa)} / ${esc(product.categoryRu)}</p>
      <h1>${esc(product.nameUa)}<span>${esc(product.nameRu)}</span></h1>
      <p>${esc(description)}</p>
      <div class="seo-product-facts">
        <strong>${esc(product.price)} UAH</strong>
        <span>без ПДВ / без НДС</span>
        <span>Наявність / Наличие: ${esc(product.qty)} шт.</span>
        <span>Код: ${esc(product.sku)}</span>
      </div>
      <div class="hero-actions">
        <a class="primary-button" href="mailto:tpolegat@gmail.com?subject=${encodeURIComponent(`Запит FLAKS: ${product.sku}`)}">Надіслати заявку</a>
        <a class="secondary-button" href="tel:+380675453115">Зателефонувати</a>
      </div>
    </section>`;

  const productUrl = `${siteUrl}/products/${slugProduct(product)}`;
  await fs.writeFile(path.join(productDir, slugProduct(product)), page(title, description, body, productJsonLd(product), productUrl), "utf8");
  urls.push({ loc: productUrl, priority: "0.6" });
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${esc(url.loc)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><priority>${url.priority}</priority></url>`)
  .join("\n")}
</urlset>
`;

await fs.writeFile(path.join(root, "sitemap.xml"), sitemap, "utf8");
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
      background_color: "#f6f7f8",
      theme_color: "#182028",
      description: "Каталог металлообрабатывающего инструмента FLAKS.",
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`SEO generated: ${data.categories.length} categories, ${data.products.length} product pages, ${urls.length} sitemap URLs.`);
