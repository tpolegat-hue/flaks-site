import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const siteUrl = (globalThis.process?.env?.SITE_URL || "https://www.flaks.com.ua").replace(/\/$/, "");
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

function page(title, description, body, jsonLd, canonicalUrl, titleRu = title, descriptionRu = description, lang = "uk") {
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
  <body data-title-uk="${esc(title)}" data-title-ru="${esc(titleRu)}" data-description-uk="${esc(description)}" data-description-ru="${esc(descriptionRu)}">
    <header class="topbar">
      <a class="brand" href="../index.html" data-keep-lang>
        <span class="brand-mark"><img src="../assets/flaks-logo.png" alt=""></span>
        <span><strong>FLAKS</strong><small><span data-lang-content="uk">Металообробний інструмент</span><span data-lang-content="ru" hidden>Металлообрабатывающий инструмент</span></small></span>
      </a>
      <nav class="top-actions">
        <a class="contact-link" href="tel:+380675453115">+380 67 545 31 15</a>
        <a class="contact-link" href="mailto:tpolegat@gmail.com">tpolegat@gmail.com</a>
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
    <script>
      (() => {
        const params = new URLSearchParams(window.location.search);
        const stored = localStorage.getItem("flaks-lang");
        const lang = params.get("lang") === "ru" || params.get("lang") === "uk" ? params.get("lang") : stored === "ru" ? "ru" : "uk";
        const applyLang = (nextLang) => {
          document.documentElement.lang = nextLang;
          localStorage.setItem("flaks-lang", nextLang);
          document.querySelectorAll("[data-lang-content]").forEach((node) => {
            node.hidden = node.dataset.langContent !== nextLang;
          });
          document.querySelectorAll("[data-lang]").forEach((button) => {
            button.classList.toggle("active", button.dataset.lang === nextLang);
          });
          const title = document.body.dataset[nextLang === "ru" ? "titleRu" : "titleUk"];
          const description = document.body.dataset[nextLang === "ru" ? "descriptionRu" : "descriptionUk"];
          if (title) document.title = title;
          const meta = document.querySelector('meta[name="description"]');
          if (meta && description) meta.setAttribute("content", description);
          document.querySelectorAll("a[data-keep-lang], .seo-table-wrap a").forEach((link) => {
            const url = new URL(link.getAttribute("href"), window.location.href);
            if (nextLang === "ru") url.searchParams.set("lang", "ru");
            else url.searchParams.delete("lang");
            link.setAttribute("href", url.pathname + url.search + url.hash);
          });
        };
        document.querySelectorAll("[data-lang]").forEach((button) => {
          button.addEventListener("click", () => applyLang(button.dataset.lang));
        });
        applyLang(lang);
      })();
    </script>
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
      <td><a href="../products/${slugProduct(product)}"><span data-lang-content="uk">${esc(product.nameUa)}</span><span data-lang-content="ru" hidden>${esc(product.nameRu)}</span></a><small>${esc(product.sku)}</small></td>
      <td>${esc(product.sku)}</td>
      <td>${esc(product.qty)}</td>
      <td>${esc(product.price)} UAH</td>
    </tr>`)
    .join("");

  const title = `${category.ua} / ${category.ru} купити в Україні | FLAKS`;
  const description = `${category.ua}: ${products.length} позицій зі складу. Ціни в гривні без ПДВ, заявки через email або телефон.`;
  const titleRu = `${category.ru} купить в Украине | FLAKS`;
  const descriptionRu = `${category.ru}: ${products.length} позиций со склада. Цены в гривне без НДС, заявки через email или телефон.`;
  const body = `<section class="seo-hero">
      <p class="eyebrow"><span data-lang-content="uk">Категорія інструменту</span><span data-lang-content="ru" hidden>Категория инструмента</span></p>
      <h1><span data-lang-content="uk">${esc(category.ua)}</span><span data-lang-content="ru" hidden>${esc(category.ru)}</span></h1>
      <p><span data-lang-content="uk">${esc(description)}</span><span data-lang-content="ru" hidden>${esc(descriptionRu)}</span></p>
    </section>
    <section class="seo-table-wrap">
      <table>
        <thead><tr><th><span data-lang-content="uk">Найменування</span><span data-lang-content="ru" hidden>Наименование</span></th><th>Код</th><th><span data-lang-content="uk">К-сть</span><span data-lang-content="ru" hidden>Кол-во</span></th><th><span data-lang-content="uk">Ціна без ПДВ</span><span data-lang-content="ru" hidden>Цена без НДС</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;

  const categoryUrl = `${siteUrl}/catalog/${category.slug}.html`;
  await fs.writeFile(path.join(categoryDir, `${category.slug}.html`), page(title, description, body, categoryJsonLd(category, products), categoryUrl, titleRu, descriptionRu), "utf8");
  urls.push({ loc: `${siteUrl}/catalog/${category.slug}.html`, priority: "0.8" });
}

for (const product of data.products) {
  const title = `${product.nameUa} купити | FLAKS`;
  const description = `${product.nameUa}. ${product.nameRu}. Ціна ${product.price} UAH без ПДВ, наявність ${product.qty} шт.`;
  const titleRu = `${product.nameRu} купить | FLAKS`;
  const descriptionRu = `${product.nameRu}. ${product.nameUa}. Цена ${product.price} UAH без НДС, наличие ${product.qty} шт.`;
  const body = `<section class="seo-hero">
      <p class="eyebrow"><span data-lang-content="uk">${esc(product.categoryUa)}</span><span data-lang-content="ru" hidden>${esc(product.categoryRu)}</span></p>
      <h1><span data-lang-content="uk">${esc(product.nameUa)}</span><span data-lang-content="ru" hidden>${esc(product.nameRu)}</span></h1>
      <p><span data-lang-content="uk">${esc(description)}</span><span data-lang-content="ru" hidden>${esc(descriptionRu)}</span></p>
      <div class="seo-product-facts">
        <strong>${esc(product.price)} UAH</strong>
        <span><span data-lang-content="uk">без ПДВ</span><span data-lang-content="ru" hidden>без НДС</span></span>
        <span><span data-lang-content="uk">Наявність</span><span data-lang-content="ru" hidden>Наличие</span>: ${esc(product.qty)} шт.</span>
        <span><span data-lang-content="uk">Код</span><span data-lang-content="ru" hidden>Код</span>: ${esc(product.sku)}</span>
      </div>
      <div class="hero-actions">
        <a class="primary-button" href="mailto:tpolegat@gmail.com?subject=${encodeURIComponent(`Запит FLAKS: ${product.sku}`)}"><span data-lang-content="uk">Надіслати заявку</span><span data-lang-content="ru" hidden>Отправить заявку</span></a>
        <a class="secondary-button" href="tel:+380675453115"><span data-lang-content="uk">Зателефонувати</span><span data-lang-content="ru" hidden>Позвонить</span></a>
      </div>
    </section>`;

  const productUrl = `${siteUrl}/products/${slugProduct(product)}`;
  await fs.writeFile(path.join(productDir, slugProduct(product)), page(title, description, body, productJsonLd(product), productUrl, titleRu, descriptionRu), "utf8");
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
