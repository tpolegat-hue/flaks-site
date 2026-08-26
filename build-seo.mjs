import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseSpecs, buildSpecRows, buildDescription, buildMetaDescription, TOOL_KINDS } from "./seo-spec.mjs";

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

// Sync clients (Dropbox/OneDrive) and antivirus scanners briefly lock freshly
// written files, which surfaces as EBUSY/EPERM/UNKNOWN on the next batch.
// Retrying a few times is enough; failing the whole build over it is not.
const TRANSIENT_WRITE_ERRORS = new Set(["EBUSY", "EPERM", "UNKNOWN", "EMFILE", "ENFILE"]);

async function withWriteRetry(operation, attempts = 8) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !TRANSIENT_WRITE_ERRORS.has(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt * attempt));
    }
  }
}

// Most pages are byte-identical between runs. Skipping those writes keeps the
// build fast on slow/synced drives and makes a no-op rebuild produce no diff.
let writtenCount = 0;
async function writeIfChanged(filePath, content) {
  try {
    if ((await fs.readFile(filePath, "utf8")) === content) return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await fs.writeFile(filePath, content, "utf8");
  writtenCount++;
  return true;
}

async function writeBatched(items, writer, batchSize = 150) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map((item) => withWriteRetry(() => writer(item))));
  }
}

async function refreshVersionedDataFile() {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && /^data\.[a-f0-9]{12}\.js$/.test(entry.name) && entry.name !== versionedDataFile) {
      await fs.unlink(path.join(root, entry.name));
    }
  }
  await writeIfChanged(path.join(root, versionedDataFile), dataText);
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

function merchantImagePath(product) {
  return (
    merchantImages.products?.[product.sku] ||
    merchantImages.categoryFallbacks?.[product.categorySlug] ||
    "/assets/flaks-og.jpg"
  );
}

function merchantImageRelPath(product) {
  const rel = merchantImagePath(product);
  if (/^https?:\/\//i.test(rel)) return rel;
  return `..${rel.startsWith("/") ? rel : `/${rel}`}`;
}

function merchantImageUrl(product) {
  return absoluteAssetUrl(merchantImagePath(product));
}

const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Parse specs once per product; reused by category stats, product pages and the merchant feed.
const specsBySku = new Map(data.products.map((product) => [product.sku, parseSpecs(product)]));

// 12032 -> "12 032" (non-breaking thin space keeps the number on one line).
function groupDigits(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function ukPlural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function categoryStats(products) {
  let minPrice = Infinity;
  const diameters = [];
  const threads = [];
  const materials = new Map();
  const brands = new Set();
  const kinds = new Map();
  for (const product of products) {
    const specs = specsBySku.get(product.sku);
    const priceValue = Number(product.price);
    if (priceValue > 0 && priceValue < minPrice) minPrice = priceValue;
    if (specs.diameter) diameters.push(Number(specs.diameter));
    if (specs.threadKind === "metric") threads.push(Number(specs.thread.slice(1).split("×")[0]));
    for (const m of specs.materials) materials.set(m.code, (materials.get(m.code) || 0) + 1);
    if (specs.brand) brands.add(specs.brand);
    kinds.set(specs.kindId, (kinds.get(specs.kindId) || 0) + 1);
  }
  const byCount = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
  return {
    minPrice: minPrice === Infinity ? 0 : Math.round(minPrice),
    diaMin: diameters.length ? Math.min(...diameters) : 0,
    diaMax: diameters.length ? Math.max(...diameters) : 0,
    threadMin: threads.length ? Math.min(...threads) : 0,
    threadMax: threads.length ? Math.max(...threads) : 0,
    materials: [...materials.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code).slice(0, 4),
    brands: [...brands].slice(0, 4),
    kindId: byCount[0]?.[0] || "tool",
  };
}

// Cross-links between categories that buyers shop together (taps with dies, drills with reamers).
const RELATED_CATEGORIES = {
  "metchiki-mr-metricheskie-pravye": ["plashki", "metchiki-gaechnye", "metchiki-ruchnye"],
  "metchiki-levye": ["metchiki-mr-metricheskie-pravye", "sverla-tskh-levye"],
  "metchiki-mr-cherez-shag": ["metchiki-mr-metricheskie-pravye", "plashki"],
  "metchiki-g-tr-k-rc-ktr": ["metchiki-mr-metricheskie-pravye", "plashki"],
  "metchiki-ruchnye": ["metchiki-mr-metricheskie-pravye", "plashki"],
  "metchiki-trapetsiya-i-dr": ["metchiki-mr-metricheskie-pravye", "metchiki-g-tr-k-rc-ktr"],
  "metchiki-gaechnye": ["metchiki-mr-metricheskie-pravye", "plashki"],
  "plashki": ["metchiki-mr-metricheskie-pravye", "metchiki-ruchnye"],
  "kalibry": ["metchiki-mr-metricheskie-pravye", "plashki"],
  "sverla-kkh": ["sverla-tskh-srednie", "sverla-kkh-tverdosplavnye", "razvertki-zenkera-zenkovki"],
  "sverla-kkh-tverdosplavnye": ["sverla-kkh", "sverla-tverdosplavnye"],
  "sverla-kkh-kitay": ["sverla-kkh", "sverla-tskh-srednie"],
  "sverla-tskh-srednie": ["sverla-tskh-dlinnye", "sverla-kkh", "sverla-tsentrovochnye"],
  "sverla-tskh-dlinnye": ["sverla-tskh-srednie", "sverla-kkh"],
  "sverla-tskh-levye": ["sverla-tskh-srednie", "metchiki-levye"],
  "sverla-tsentrovochnye": ["sverla-tskh-srednie", "sverla-kkh"],
  "sverla-tverdosplavnye": ["sverla-kkh-tverdosplavnye", "sverla-tskh-srednie"],
  "razvertki-zenkera-zenkovki": ["sverla-kkh", "sverla-tskh-srednie"],
  "frezy-kontsevye": ["frezy-diskovye", "frezy-tortsevye-i-drugoe"],
  "frezy-diskovye": ["frezy-kontsevye", "frezy-chervyachnye-dolbyaki-t-obr"],
  "frezy-chervyachnye-dolbyaki-t-obr": ["frezy-diskovye", "frezy-kontsevye"],
  "frezy-tortsevye-i-drugoe": ["frezy-kontsevye", "frezy-diskovye"],
};

const ARTICLE_LINKS = {
  drillForThread: { href: "/articles/diametr-sverdla-pid-rizbu.html", ua: "Діаметр свердла під різьбу: таблиця М2–М30", ru: "Диаметр сверла под резьбу: таблица М2–М30" },
  morse: { href: "/articles/konus-morze-rozmiry.html", ua: "Конус Морзе: таблиця розмірів КМ0–КМ6", ru: "Конус Морзе: таблица размеров КМ0–КМ6" },
  tapping: { href: "/articles/narizannya-rizby-mitchykom.html", ua: "Як нарізати різьбу мітчиком", ru: "Как нарезать резьбу метчиком" },
  steel: { href: "/articles/stal-r6m5-ta-r6m5k5.html", ua: "Р6М5 чи Р6М5К5: яку сталь вибрати", ru: "Р6М5 или Р6М5К5: какую сталь выбрать" },
  pick: { href: "/articles/yak-pidibraty-metalorizalnyi-instrument.html", ua: "Як підібрати металорізальний інструмент", ru: "Как подобрать металлорежущий инструмент" },
};

function categoryArticleLinks(slug) {
  if (slug.startsWith("metchiki") || slug === "plashki" || slug === "kalibry")
    return [ARTICLE_LINKS.drillForThread, ARTICLE_LINKS.tapping];
  if (slug.startsWith("sverla-kkh")) return [ARTICLE_LINKS.morse, ARTICLE_LINKS.steel];
  if (slug.startsWith("sverla")) return [ARTICLE_LINKS.drillForThread, ARTICLE_LINKS.steel];
  if (slug === "razvertki-zenkera-zenkovki") return [ARTICLE_LINKS.morse, ARTICLE_LINKS.pick];
  if (slug.startsWith("frezy")) return [ARTICLE_LINKS.steel, ARTICLE_LINKS.pick];
  return [ARTICLE_LINKS.pick];
}

function categorySeoTextHtml(category, stats, count, categoriesBySlug) {
  const kind = TOOL_KINDS[stats.kindId];
  const sizeUa = [];
  const sizeRu = [];
  if (stats.threadMin && stats.threadMax && stats.threadMin !== stats.threadMax) {
    sizeUa.push(`різьби від М${stats.threadMin} до М${stats.threadMax}`);
    sizeRu.push(`резьбы от М${stats.threadMin} до М${stats.threadMax}`);
  }
  if (stats.diaMin && stats.diaMax && stats.diaMin !== stats.diaMax) {
    sizeUa.push(`діаметри від ${stats.diaMin} до ${stats.diaMax} мм`);
    sizeRu.push(`диаметры от ${stats.diaMin} до ${stats.diaMax} мм`);
  }
  const posUa = ukPlural(count, "позиція", "позиції", "позицій");
  const posRu = ukPlural(count, "позиция", "позиции", "позиций");

  const partsUa = [`${category.ua} зі складу FLAKS у Харкові: ${count} ${posUa} для ${kind.purposeUa}.`];
  const partsRu = [`${category.ru} со склада FLAKS в Харькове: ${count} ${posRu} для ${kind.purposeRu}.`];
  if (sizeUa.length) {
    partsUa.push(`В асортименті ${sizeUa.join(", ")}.`);
    partsRu.push(`В ассортименте ${sizeRu.join(", ")}.`);
  }
  if (stats.materials.length) {
    partsUa.push(`Матеріали: ${stats.materials.join(", ")}.`);
    partsRu.push(`Материалы: ${stats.materials.join(", ")}.`);
  }
  if (stats.brands.length) {
    partsUa.push(`Серед виробників: ${stats.brands.join(", ")}.`);
    partsRu.push(`Среди производителей: ${stats.brands.join(", ")}.`);
  }
  partsUa.push(`Ціни від ${stats.minPrice} грн без ПДВ, відправлення по всій Україні, опт і роздріб, замовлення від 2 000 грн.`);
  partsRu.push(`Цены от ${stats.minPrice} грн без НДС, отправка по всей Украине, опт и розница, заказ от 2 000 грн.`);

  const related = (RELATED_CATEGORIES[category.slug] || [])
    .map((slug) => categoriesBySlug.get(slug))
    .filter(Boolean)
    .map((c) => `<a href="../catalog/${esc(c.slug)}.html" data-keep-lang>${bilingual(c.ua, c.ru)}</a>`);
  const articles = categoryArticleLinks(category.slug)
    .map((a) => `<a href="..${esc(a.href)}" data-keep-lang>${bilingual(a.ua, a.ru)}</a>`);

  return `<section class="content-section seo-prose">
        <h2>${bilingual(`${category.ua} — асортимент і ціни`, `${category.ru} — ассортимент и цены`)}</h2>
        <p>${bilingual(partsUa.join(" "), partsRu.join(" "))}</p>
        <p class="seo-note">${bilingual("Дивіться також:", "Смотрите также:")} ${[...related, ...articles].join(" · ")}</p>
      </section>`;
}

function categoryFaq(category, stats, count) {
  const items = [
    {
      qUa: `Як купити: ${category.ua.toLowerCase()} зі складу FLAKS?`,
      qRu: `Как купить: ${category.ru.toLowerCase()} со склада FLAKS?`,
      aUa: `Додайте потрібні позиції в кошик на цій сторінці або надішліть список на tpolegat@gmail.com чи за телефоном +380 67 545 31 15. Підтвердимо наявність, ціну без ПДВ і строки відправлення. Мінімальне замовлення — 2 000 грн.`,
      aRu: `Добавьте нужные позиции в корзину на этой странице или отправьте список на tpolegat@gmail.com либо по телефону +380 67 545 31 15. Подтвердим наличие, цену без НДС и сроки отправки. Минимальный заказ — 2 000 грн.`,
    },
    {
      qUa: `Скільки коштує ${category.ua.toLowerCase()} в Україні?`,
      qRu: `Сколько стоит ${category.ru.toLowerCase()} в Украине?`,
      aUa: `У каталозі FLAKS ${count} ${ukPlural(count, "позиція", "позиції", "позицій")} цієї категорії, ціни від ${stats.minPrice} грн без ПДВ. Вартість залежить від розміру, матеріалу та виробника — актуальні ціни в таблиці на цій сторінці (станом на ${contentLastmod}).`,
      aRu: `В каталоге FLAKS ${count} ${ukPlural(count, "позиция", "позиции", "позиций")} этой категории, цены от ${stats.minPrice} грн без НДС. Стоимость зависит от размера, материала и производителя — актуальные цены в таблице на этой странице (на ${contentLastmod}).`,
    },
    {
      qUa: `Чи відправляєте інструмент по Україні?`,
      qRu: `Отправляете ли инструмент по Украине?`,
      aUa: `Так, FLAKS базується у Харкові та відправляє металорізальний інструмент по всій Україні. Надішліть заявку — уточнимо наявність, ціну і строки відправлення.`,
      aRu: `Да, FLAKS базируется в Харькове и отправляет металлорежущий инструмент по всей Украине. Отправьте заявку — уточним наличие, цену и сроки отправки.`,
    },
  ];
  const html = `<section class="content-section seo-faq">
        <h2>${bilingual("Часті питання", "Частые вопросы")}</h2>
        ${items
          .map(
            (item) => `<details><summary>${bilingual(item.qUa, item.qRu)}</summary><p>${bilingual(item.aUa, item.aRu)}</p></details>`,
          )
          .join("\n        ")}
      </section>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.qUa,
      acceptedAnswer: { "@type": "Answer", text: item.aUa },
    })),
  };
  return { html, jsonLd };
}

// catalog/ used to be wiped here. It is pruned after generation instead, so
// unchanged pages keep their bytes and are not rewritten on every build.

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

function page(title, description, body, jsonLd, canonicalUrl, titleRu = title, descriptionRu = description, lang = "uk", og = {}) {
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
    <meta property="og:type" content="${esc(og.type || "website")}">
    <meta property="og:site_name" content="FLAKS">
    <meta property="og:url" content="${esc(canonicalUrl)}">
    <meta property="og:image" content="${esc(og.image || `${siteUrl}/assets/flaks-og.jpg`)}">
    <link rel="canonical" href="${esc(canonicalUrl)}">
    <link rel="icon" type="image/png" href="../assets/favicon-32.png">
    <link rel="stylesheet" href="../styles.css">
    ${(Array.isArray(jsonLd) ? jsonLd : [jsonLd])
      .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry).replaceAll("<", "\\u003c")}</script>`)
      .join("\n    ")}
  </head>
  <body data-title-uk="${esc(title)}" data-title-ru="${esc(titleRu)}" data-description-uk="${esc(description)}" data-description-ru="${esc(descriptionRu)}">
    <header class="topbar">
      <a class="brand" href="../index.html" data-keep-lang>
        <span class="brand-mark"><img src="../assets/icon-192.png" alt=""></span>
        <span><strong>FLAKS</strong><small><span data-lang-content="uk">Металообробний інструмент</span><span data-lang-content="ru" hidden>Металлообрабатывающий инструмент</span></small></span>
      </a>
      <nav class="top-actions">
        <a class="contact-link" href="../catalog" data-keep-lang><span data-lang-content="uk">Каталог</span><span data-lang-content="ru" hidden>Каталог</span></a>
        <a class="contact-link" href="../about.html" data-keep-lang><span data-lang-content="uk">Про компанію</span><span data-lang-content="ru" hidden>О компании</span></a>
        <a class="contact-link" href="../delivery.html" data-keep-lang><span data-lang-content="uk">Доставка</span><span data-lang-content="ru" hidden>Доставка</span></a>
        <a class="contact-link" href="../payment.html" data-keep-lang><span data-lang-content="uk">Оплата</span><span data-lang-content="ru" hidden>Оплата</span></a>
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
      <a href="../catalog" data-keep-lang><span data-lang-content="uk">Усі категорії</span><span data-lang-content="ru" hidden>Все категории</span></a>
      <a href="../index.html#catalog" data-keep-lang><span data-lang-content="uk">Пошук по каталогу</span><span data-lang-content="ru" hidden>Поиск по каталогу</span></a>
      <a href="../delivery.html" data-keep-lang><span data-lang-content="uk">Доставка</span><span data-lang-content="ru" hidden>Доставка</span></a>
      <a href="../payment.html" data-keep-lang><span data-lang-content="uk">Оплата</span><span data-lang-content="ru" hidden>Оплата</span></a>
      <a href="../returns.html" data-keep-lang><span data-lang-content="uk">Повернення</span><span data-lang-content="ru" hidden>Возврат</span></a>
      <a href="../contacts.html" data-keep-lang><span data-lang-content="uk">Контакти</span><span data-lang-content="ru" hidden>Контакты</span></a>
      <a href="../privacy.html" data-keep-lang><span data-lang-content="uk">Конфіденційність</span><span data-lang-content="ru" hidden>Конфиденциальность</span></a>
      <span>+380 67 545 31 15 · tpolegat@gmail.com</span>
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
      { "@type": "ListItem", position: 1, name: "FLAKS", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Каталог", item: `${siteUrl}/catalog` },
      {
        "@type": "ListItem",
        position: 3,
        name: product.categoryUa || product.categoryRu,
        item: `${siteUrl}/catalog/${product.categorySlug}.html`,
      },
      { "@type": "ListItem", position: 4, name: product.nameUa || product.nameRu, item: `${siteUrl}/products/${slugProduct(product)}` },
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
  { loc: `${siteUrl}/catalog`, priority: "0.95" },
  { loc: `${siteUrl}/about.html`, priority: "0.9" },
  { loc: `${siteUrl}/delivery.html`, priority: "0.7" },
  { loc: `${siteUrl}/payment.html`, priority: "0.6" },
  { loc: `${siteUrl}/returns.html`, priority: "0.5" },
  { loc: `${siteUrl}/contacts.html`, priority: "0.7" },
  { loc: `${siteUrl}/privacy.html`, priority: "0.3" },
  { loc: `${siteUrl}/articles`, priority: "0.8" },
  { loc: `${siteUrl}/articles/yak-pidibraty-metalorizalnyi-instrument.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles/narizannya-rizby-mitchykom.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles/stal-r6m5-ta-r6m5k5.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles/diametr-sverdla-pid-rizbu.html`, priority: "0.7" },
  { loc: `${siteUrl}/articles/konus-morze-rozmiry.html`, priority: "0.7" },
];
const categoryUrls = [];
const productUrls = [];
const categoryPageWrites = [];
// Summary rows for the /catalog hub page, filled while category pages are generated.
const categorySummaries = [];

const categoriesBySlug = new Map(data.categories.map((item) => [item.slug, item]));

for (const category of data.categories.filter((item) => item.count > 0)) {
  const products = data.products.filter((product) => product.categorySlug === category.slug);
  const totalPages = Math.max(1, Math.ceil(products.length / categoryPageSize));
  const stats = categoryStats(products);
  const categoryLastmod = products.reduce((date, product) => {
    const productDate = lastmod(product.updatedAt);
    return productDate > date ? productDate : date;
  }, contentLastmod);
  categorySummaries.push({ category, count: products.length, minPrice: stats.minPrice, lastmod: categoryLastmod });

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

    const isFirstPage = pageNumber === 1;
    const title = isFirstPage
      ? `${category.ua} — купити в Україні, ціна від ${stats.minPrice} грн | FLAKS`
      : `${category.ua} — купити в Україні${pageSuffixUk} | FLAKS`;
    const titleRu = isFirstPage
      ? `${category.ru} купить в Украине, цена от ${stats.minPrice} грн | FLAKS`
      : `${category.ru} купить в Украине${pageSuffixRu} | FLAKS`;
    const description = isFirstPage
      ? `${category.ua}: ${products.length} ${ukPlural(products.length, "позиція", "позиції", "позицій")} зі складу у Харкові, ціна від ${stats.minPrice} грн без ПДВ. Відправлення по всій Україні, опт і роздріб.`
      : `${category.ua}: позиції ${rangeStart}-${rangeEnd} із ${products.length} зі складу. Ціни в гривні без ПДВ, заявки через email або телефон.`;
    const descriptionRu = isFirstPage
      ? `${category.ru}: ${products.length} ${ukPlural(products.length, "позиция", "позиции", "позиций")} со склада в Харькове, цена от ${stats.minPrice} грн без НДС. Отправка по всей Украине, опт и розница.`
      : `${category.ru}: позиции ${rangeStart}-${rangeEnd} из ${products.length} со склада. Цены в гривне без НДС, заявки через email или телефон.`;
    const faq = isFirstPage ? categoryFaq(category, stats, products.length) : null;
    const body = `${categoryBreadcrumbHtml(category, pageNumber)}
      <section class="seo-hero">
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
      ${pagination(category, pageNumber, totalPages)}
      ${isFirstPage ? categorySeoTextHtml(category, stats, products.length, categoriesBySlug) : ""}
      ${faq ? faq.html : ""}`;

    const href = categoryPageHref(category, pageNumber);
    const categoryUrl = `${siteUrl}${href}`;
    const fileName = pageNumber === 1 ? `${category.slug}.html` : `${category.slug}-page-${pageNumber}.html`;
    categoryPageWrites.push({
      fileName,
      html: page(
        title,
        description,
        body,
        faq
          ? [categoryJsonLd(category, pageProducts), categoryBreadcrumbJsonLd(category, pageNumber), faq.jsonLd]
          : [categoryJsonLd(category, pageProducts), categoryBreadcrumbJsonLd(category, pageNumber)],
        categoryUrl,
        titleRu,
        descriptionRu,
      ),
    });
    categoryUrls.push({ loc: categoryUrl, priority: pageNumber === 1 ? "0.8" : "0.55", lastmod: categoryLastmod });
  }
}

await writeBatched(categoryPageWrites, ({ fileName, html }) => writeIfChanged(path.join(categoryDir, fileName), html), 50);

// ---------------------------------------------------------------------------
// Catalog hub (/catalog) — the crawlable entry point into every category page.
// Without it the whole catalog is only reachable through sitemap.xml.
// ---------------------------------------------------------------------------
const catalogHubUrl = `${siteUrl}/catalog`;
const catalogTotalCount = categorySummaries.reduce((sum, item) => sum + item.count, 0);
const catalogMinPriceRaw = categorySummaries.reduce(
  (min, item) => (item.minPrice > 0 && item.minPrice < min ? item.minPrice : min),
  Infinity,
);
const catalogMinPrice = catalogMinPriceRaw === Infinity ? 0 : catalogMinPriceRaw;
const catalogLastmod = categorySummaries.reduce((date, item) => (item.lastmod > date ? item.lastmod : date), contentLastmod);

// prefix is "../catalog/" for pages inside catalog/, "catalog/" for the homepage.
function categoryCardsHtml(prefix) {
  return categorySummaries
    .map(
      ({ category, count, minPrice }) => `<a href="${prefix}${esc(category.slug)}.html" data-keep-lang>
        <strong>${bilingual(`${category.ua} — від ${minPrice} грн`, `${category.ru} — от ${minPrice} грн`)}</strong>
        <span>${groupDigits(count)}</span>
      </a>`,
    )
    .join("\n        ");
}

{
  const posUa = ukPlural(catalogTotalCount, "позиція", "позиції", "позицій");
  const posRu = ukPlural(catalogTotalCount, "позиция", "позиции", "позиций");
  const catUa = ukPlural(categorySummaries.length, "категорія", "категорії", "категорій");
  const catRu = ukPlural(categorySummaries.length, "категория", "категории", "категорий");

  const title = `Каталог металорізального інструменту — ${categorySummaries.length} ${catUa}, ціна від ${catalogMinPrice} грн | FLAKS`;
  const titleRu = `Каталог металлорежущего инструмента — ${categorySummaries.length} ${catRu}, цена от ${catalogMinPrice} грн | FLAKS`;
  const description = `Каталог FLAKS: ${categorySummaries.length} ${catUa} та ${groupDigits(catalogTotalCount)} ${posUa} металорізального інструменту зі складу у Харкові. Мітчики, плашки, свердла, фрези, розгортки та зенкери. Ціни в гривні без ПДВ, від ${catalogMinPrice} грн.`;
  const descriptionRu = `Каталог FLAKS: ${categorySummaries.length} ${catRu} и ${groupDigits(catalogTotalCount)} ${posRu} металлорежущего инструмента со склада в Харькове. Метчики, плашки, сверла, фрезы, развертки и зенкеры. Цены в гривне без НДС, от ${catalogMinPrice} грн.`;

  const articles = Object.values(ARTICLE_LINKS)
    .map((article) => `<a href="..${esc(article.href)}" data-keep-lang>${bilingual(article.ua, article.ru)}</a>`)
    .join(" · ");

  const body = `<nav class="seo-breadcrumb" aria-label="breadcrumb">
      <a href="../index.html" data-keep-lang>${bilingual("Головна", "Главная")}</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">${bilingual("Каталог", "Каталог")}</span>
    </nav>
      <section class="seo-hero">
        <p class="eyebrow">${bilingual("Каталог інструменту", "Каталог инструмента")}</p>
        <h1>${bilingual("Каталог металорізального інструменту FLAKS", "Каталог металлорежущего инструмента FLAKS")}</h1>
        <p>${bilingual(description, descriptionRu)}</p>
      </section>
      <section class="content-section">
        <h2>${bilingual("Категорії інструменту", "Категории инструмента")}</h2>
        <div class="category-links">
        ${categoryCardsHtml("../catalog/")}
        </div>
      </section>
      <section class="content-section seo-prose">
        <h2>${bilingual("Як користуватися каталогом", "Как пользоваться каталогом")}</h2>
        <p>${bilingual(
          `Кожна категорія — це повний перелік позицій зі складу з кодом, залишком і ціною без ПДВ. Усередині категорії позиції розбиті посторінково, а з картки товару можна перейти до схожих розмірів. Для точного підбору за діаметром, різьбою чи маркою сталі скористайтеся пошуком на головній сторінці.`,
          `Каждая категория — это полный перечень позиций со склада с кодом, остатком и ценой без НДС. Внутри категории позиции разбиты постранично, а из карточки товара можно перейти к похожим размерам. Для точного подбора по диаметру, резьбе или марке стали воспользуйтесь поиском на главной странице.`,
        )}</p>
        <p class="seo-note">${bilingual("Корисні статті:", "Полезные статьи:")} ${articles}</p>
      </section>`;

  const hubJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: catalogHubUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categorySummaries.length,
      itemListElement: categorySummaries.map(({ category }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/catalog/${category.slug}.html`,
        name: category.ua || category.ru,
      })),
    },
  };
  const hubBreadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "FLAKS", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Каталог", item: catalogHubUrl },
    ],
  };

  await writeIfChanged(
    path.join(categoryDir, "index.html"),
    page(title, description, body, [hubJsonLd, hubBreadcrumbJsonLd], catalogHubUrl, titleRu, descriptionRu),
  );

  // Prune category pages that no longer exist (renamed slug, removed category).
  const expected = new Set([...categoryPageWrites.map((entry) => entry.fileName), "index.html"]);
  const stale = (await fs.readdir(categoryDir)).filter((name) => name.endsWith(".html") && !expected.has(name));
  for (const name of stale) await fs.unlink(path.join(categoryDir, name));
  if (stale.length) console.log(`Removed ${stale.length} orphaned category pages: ${stale.join(", ")}`);

  const hubSitemapEntry = pageUrls.find((entry) => entry.loc === catalogHubUrl);
  if (hubSitemapEntry) hubSitemapEntry.lastmod = catalogLastmod;
}

// Server-render the homepage category grid between the markers in index.html,
// so crawlers (and no-JS visitors) reach every category from the front page.
{
  const indexPath = path.join(root, "index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const markers = /(<!-- category-links:start -->)[\s\S]*?(<!-- category-links:end -->)/;
  if (!markers.test(indexHtml)) {
    throw new Error("index.html: markers <!-- category-links:start/end --> not found; homepage category grid not generated.");
  }
  const cards = categoryCardsHtml("catalog/");
  const nextHtml = indexHtml
    .replace(markers, (match, start, end) => `${start}\n        ${cards}\n        ${end}`)
    // Keep the hero counters honest without JS — app.js overwrites them once it loads.
    .replace(/(<strong id="statProducts">)[^<]*(<\/strong>)/, `$1${groupDigits(catalogTotalCount)}$2`)
    .replace(/(<strong id="statCategories">)[^<]*(<\/strong>)/, `$1${categorySummaries.length}$2`);
  if (nextHtml !== indexHtml) await fs.writeFile(indexPath, nextHtml, "utf8");
}

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

function categoryBreadcrumbHtml(category, pageNumber) {
  const self =
    pageNumber > 1
      ? `<a href="../catalog/${esc(category.slug)}.html" data-keep-lang>${bilingual(category.ua, category.ru)}</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">${bilingual(`Сторінка ${pageNumber}`, `Страница ${pageNumber}`)}</span>`
      : `<span aria-current="page">${bilingual(category.ua, category.ru)}</span>`;
  return `<nav class="seo-breadcrumb" aria-label="breadcrumb">
      <a href="../index.html" data-keep-lang>${bilingual("Головна", "Главная")}</a>
      <span aria-hidden="true">›</span>
      <a href="../catalog" data-keep-lang>${bilingual("Каталог", "Каталог")}</a>
      <span aria-hidden="true">›</span>
      ${self}
    </nav>`;
}

function categoryBreadcrumbJsonLd(category, pageNumber) {
  const items = [
    { "@type": "ListItem", position: 1, name: "FLAKS", item: `${siteUrl}/` },
    { "@type": "ListItem", position: 2, name: "Каталог", item: `${siteUrl}/catalog` },
    { "@type": "ListItem", position: 3, name: category.ua || category.ru, item: `${siteUrl}/catalog/${category.slug}.html` },
  ];
  if (pageNumber > 1) {
    items.push({
      "@type": "ListItem",
      position: 4,
      name: `Сторінка ${pageNumber}`,
      item: `${siteUrl}${categoryPageHref(category, pageNumber)}`,
    });
  }
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function breadcrumbHtml(product) {
  return `<nav class="seo-breadcrumb" aria-label="breadcrumb">
      <a href="../index.html" data-keep-lang>${bilingual("Головна", "Главная")}</a>
      <span aria-hidden="true">›</span>
      <a href="../catalog" data-keep-lang>${bilingual("Каталог", "Каталог")}</a>
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
  const specs = specsBySku.get(product.sku);
  const title = `${product.nameUa} купити в Україні | FLAKS`;
  const titleRu = `${product.nameRu} купить в Украине | FLAKS`;
  const description = buildMetaDescription(product, specs, "ua");
  const descriptionRu = buildMetaDescription(product, specs, "ru");
  const body = `${breadcrumbHtml(product)}
    <section class="seo-hero seo-product-hero">
      <div class="seo-product-media">
        <img src="${esc(merchantImageRelPath(product))}" alt="${esc(product.nameUa)}" fetchpriority="high" width="360" height="360">
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
      "uk",
      { type: "product", image: merchantImageUrl(product) },
    ),
  });
  productUrls.push({ loc: productUrl, priority: "0.6", lastmod: lastmod(product.updatedAt) });
}

await writeBatched(productPageWrites, ({ fileName, html }) => writeIfChanged(path.join(productDir, fileName), html), 50);

// Drop product pages whose SKU is no longer in data.js. Unlike catalog/, this
// directory is not wiped up front (rewriting 12k files is slower than pruning),
// so without this step delisted SKUs stay online as orphans.
{
  const expected = new Set(productPageWrites.map((entry) => entry.fileName));
  const stale = (await fs.readdir(productDir)).filter((name) => name.endsWith(".html") && !expected.has(name));
  for (const name of stale) await fs.unlink(path.join(productDir, name));
  if (stale.length) console.log(`Removed ${stale.length} orphaned product pages: ${stale.slice(0, 5).join(", ")}${stale.length > 5 ? " …" : ""}`);
}

// Previous lastmod values, so regenerating a page never moves its date backwards:
// data.js carries older per-product dates than some already published sitemaps,
// and a receding lastmod is a bad recrawl signal. Set SITEMAP_TOUCH=1 to stamp
// today on every URL — use it after a template change that really did rewrite
// every page.
const previousLastmod = new Map();
for (const file of ["sitemap-pages.xml", "sitemap-categories.xml", "sitemap-products.xml"]) {
  try {
    const xml = await fs.readFile(path.join(root, file), "utf8");
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) {
      previousLastmod.set(match[1], match[2]);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const buildDate = new Date().toISOString().slice(0, 10);
const touchAllSitemaps = globalThis.process?.env?.SITEMAP_TOUCH === "1";
let newestLastmod = contentLastmod;

function resolveLastmod(url) {
  const computed = touchAllSitemaps ? buildDate : lastmod(url.lastmod);
  const previous = previousLastmod.get(url.loc);
  const value = !touchAllSitemaps && previous && previous > computed ? previous : computed;
  if (value > newestLastmod) newestLastmod = value;
  return value;
}

function sitemapUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${esc(url.loc)}</loc><lastmod>${resolveLastmod(url)}</lastmod><priority>${url.priority}</priority></url>`)
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
      const condition = specsBySku.get(product.sku).condition === "used" ? "used" : "new";
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
${files.map((file) => `  <sitemap><loc>${siteUrl}/${file}</loc><lastmod>${newestLastmod}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
}

await writeIfChanged(path.join(root, "merchant-feed.xml"), merchantFeed(data.products));
await writeIfChanged(path.join(root, "sitemap-pages.xml"), sitemapUrlset(pageUrls));
await writeIfChanged(path.join(root, "sitemap-categories.xml"), sitemapUrlset(categoryUrls));
await writeIfChanged(path.join(root, "sitemap-products.xml"), sitemapUrlset(productUrls));
await writeIfChanged(path.join(root, "sitemap.xml"), sitemapIndex(["sitemap-pages.xml", "sitemap-categories.xml", "sitemap-products.xml"]));
await writeIfChanged(
  path.join(root, "robots.txt"),
  `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`,
);

await writeIfChanged(
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
);

console.log(`SEO generated: ${data.categories.length} categories, ${data.products.length} product pages, ${pageUrls.length + categoryUrls.length + productUrls.length} sitemap URLs, ${writtenCount} files written.`);
