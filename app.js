const data = window.FLAKS_DATA;
const productDiameterCache = new WeakMap();
const productSearchTextCache = new WeakMap();

const i18n = {
  uk: {
    brandNote: "Металообробний інструмент",
    aboutNav: "Про компанію",
    deliveryNav: "Доставка",
    returnsNav: "Повернення",
    paymentNav: "Оплата",
    contactsNav: "Контакти",
    articlesNav: "Статті",
    privacyNav: "Конфіденційність",
    eyebrow: "Прайс із наявності",
    heroTitle: "Металообробний інструмент FLAKS",
    heroText: "Каталог із цінами в гривні без ПДВ, залишками на складі та швидкою заявкою через email або телефон.",
    openCatalog: "Відкрити каталог",
    sendRequest: "Надіслати заявку",
    items: "позицій",
    categories: "категорій",
    uah: "UAH",
    noVat: "ціни без ПДВ",
    companySince: "Працюємо з 1991 року",
    companyTitle: "FLAKS постачає професійний металообробний інструмент по всій Україні",
    companyText:
      "Головний офіс у Харкові. Підбираємо фрези, свердла, мітчики, плашки, калібри, розгортки, зенкери та інший металорізальний інструмент для виробництва, ремонту й оснащення цехів.",
    readAbout: "Дізнатися більше",
    readArticles: "Читати статті",
    trustYears: "рік початку роботи",
    trustClients: "замовників різного масштабу",
    trustDelivery: "відправка по всій Україні",
    trustStock: "якісний складський інструмент",
    seoCategories: "Категорії інструменту",
    categoryIndexTitle: "Швидкий перехід до розділів",
    popularSearches: "Популярні запити",
    popularSearchTitle: "Швидко знайти інструмент",
    faqTitle: "Питання перед замовленням",
    faqDeliveryQ: "Чи відправляєте по Україні?",
    faqDeliveryA: "Так. Головний офіс у Харкові, відправляємо інструмент по всій Україні зручними службами доставки.",
    faqSelectionQ: "Чи допоможете з підбором?",
    faqSelectionA: "Так. Допомагаємо підібрати фрези, свердла, мітчики, плашки, розгортки, калібри та режими різання під задачу.",
    faqWholesaleQ: "Чи є оптові знижки?",
    faqWholesaleA: "Так. Приймаємо оптові заявки та можемо запропонувати суттєві знижки для великих і регулярних поставок.",
    catalog: "Каталог",
    search: "Пошук",
    searchPlaceholder: "Назва, розмір, Р6М5, М10...",
    diameterHint: "Ф, Ø, d і діаметр шукаються однаково.",
    category: "Категорія",
    allCategories: "Усі категорії",
    allCategoriesLink: "Усі категорії",
    sort: "Сортування",
    sortRelevance: "За релевантністю",
    sortPriceAsc: "Ціна: від нижчої",
    sortPriceDesc: "Ціна: від вищої",
    sortQtyDesc: "Наявність: більше",
    sortNameAsc: "Назва: А-Я",
    stockOnly: "Тільки з наявністю",
    needHelp: "Потрібна допомога з підбором?",
    helpText: "Надішліть список позицій або артикулів, і ми уточнимо наявність.",
    availableNow: "Доступно зараз",
    found: "позицій знайдено",
    tableName: "Найменування",
    tableCategory: "Категорія",
    tableQty: "К-сть",
    tablePrice: "Ціна без ПДВ",
    tableAction: "Кошик",
    request: "Запит",
    prev: "Назад",
    next: "Далі",
    page: "Сторінка",
    from: "з",
    footerText: "Металообробний інструмент з наявності. Ціни в гривні без ПДВ.",
    section: "Розділ",
    sku: "Код",
    noResults: "Нічого не знайдено. Спробуйте змінити пошук або категорію.",
  },
  ru: {
    brandNote: "Металлообрабатывающий инструмент",
    aboutNav: "О компании",
    deliveryNav: "Доставка",
    returnsNav: "Возврат",
    paymentNav: "Оплата",
    contactsNav: "Контакты",
    articlesNav: "Статьи",
    privacyNav: "Конфиденциальность",
    eyebrow: "Прайс из наличия",
    heroTitle: "Металлообрабатывающий инструмент FLAKS",
    heroText: "Каталог с ценами в гривне без НДС, остатками на складе и быстрой заявкой через email или телефон.",
    openCatalog: "Открыть каталог",
    sendRequest: "Отправить заявку",
    items: "позиций",
    categories: "категорий",
    uah: "UAH",
    noVat: "цены без НДС",
    companySince: "Работаем с 1991 года",
    companyTitle: "FLAKS поставляет профессиональный металлообрабатывающий инструмент по всей Украине",
    companyText:
      "Головной офис в Харькове. Подбираем фрезы, сверла, метчики, плашки, калибры, развертки, зенкеры и другой металлорежущий инструмент для производства, ремонта и оснащения цехов.",
    readAbout: "Узнать больше",
    readArticles: "Читать статьи",
    trustYears: "год начала работы",
    trustClients: "заказчиков разного масштаба",
    trustDelivery: "отправка по всей Украине",
    trustStock: "качественный складской инструмент",
    seoCategories: "Категории инструмента",
    categoryIndexTitle: "Быстрый переход к разделам",
    popularSearches: "Популярные запросы",
    popularSearchTitle: "Быстро найти инструмент",
    faqTitle: "Вопросы перед заказом",
    faqDeliveryQ: "Отправляете по Украине?",
    faqDeliveryA: "Да. Головной офис в Харькове, отправляем инструмент по всей Украине удобными службами доставки.",
    faqSelectionQ: "Поможете с подбором?",
    faqSelectionA: "Да. Помогаем подобрать фрезы, сверла, метчики, плашки, развертки, калибры и режимы резания под задачу.",
    faqWholesaleQ: "Есть оптовые скидки?",
    faqWholesaleA: "Да. Принимаем оптовые заявки и можем предложить существенные скидки для крупных и регулярных поставок.",
    catalog: "Каталог",
    search: "Поиск",
    searchPlaceholder: "Название, размер, Р6М5, М10...",
    diameterHint: "Ф, Ø, d и диаметр ищутся одинаково.",
    category: "Категория",
    allCategories: "Все категории",
    allCategoriesLink: "Все категории",
    sort: "Сортировка",
    sortRelevance: "По релевантности",
    sortPriceAsc: "Цена: от низкой",
    sortPriceDesc: "Цена: от высокой",
    sortQtyDesc: "Наличие: больше",
    sortNameAsc: "Название: А-Я",
    stockOnly: "Только в наличии",
    needHelp: "Нужна помощь с подбором?",
    helpText: "Отправьте список позиций или артикулов, и мы уточним наличие.",
    availableNow: "Доступно сейчас",
    found: "позиций найдено",
    tableName: "Наименование",
    tableCategory: "Категория",
    tableQty: "Кол-во",
    tablePrice: "Цена без НДС",
    tableAction: "Корзина",
    request: "Запрос",
    prev: "Назад",
    next: "Далее",
    page: "Страница",
    from: "из",
    footerText: "Металлообрабатывающий инструмент из наличия. Цены в гривне без НДС.",
    section: "Раздел",
    sku: "Код",
    noResults: "Ничего не найдено. Попробуйте изменить поиск или категорию.",
  },
};

const state = {
  lang: localStorage.getItem("flaks-lang") || "uk",
  query: "",
  category: "all",
  sort: "relevance",
  stockOnly: true,
  view: "table",
  page: 1,
  perPage: 40,
};

const els = {
  html: document.documentElement,
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categorySelect"),
  sort: document.querySelector("#sortSelect"),
  stockOnly: document.querySelector("#stockOnly"),
  reset: document.querySelector("#resetFilters"),
  rows: document.querySelector("#productRows"),
  cards: document.querySelector("#cardsView"),
  table: document.querySelector("#tableView"),
  resultCount: document.querySelector("#resultCount"),
  pageInfo: document.querySelector("#pageInfo"),
  prev: document.querySelector("#prevPage"),
  next: document.querySelector("#nextPage"),
  statProducts: document.querySelector("#statProducts"),
  statCategories: document.querySelector("#statCategories"),
  categoryLinks: document.querySelector("#categoryLinks"),
};

function t(key) {
  return i18n[state.lang][key] || key;
}

function productName(product) {
  return state.lang === "uk" ? product.nameUa : product.nameRu;
}

function categoryName(product) {
  return state.lang === "uk" ? product.categoryUa : product.categoryRu;
}

function sectionName(product) {
  return state.lang === "uk" ? product.sectionUa : product.sectionRu;
}

function formatQty(qty) {
  return qty.toLocaleString("uk-UA");
}

function formatPrice(price) {
  return new Intl.NumberFormat(state.lang === "uk" ? "uk-UA" : "ru-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("і", "и")
    .replaceAll("ї", "и")
    .replaceAll("є", "е")
    .replaceAll("ґ", "г")
    // Protect decimal separators before punctuation is stripped: without this
    // "ф 8.5" turned into "ф 8 5" and a search for 8.5 matched anything holding
    // a stray 8 and a stray 5, including ф 5.8.
    .replace(/([0-9])[.,]([0-9])/g, "$1\u0000$2")
    .replace(/[.,;:()[\]{}]/g, " ")
    .replace(/\u0000/g, ".")
    .replace(/[×х]/g, "x")
    .replace(/[øØ⌀]/g, " ф ")
    .replace(/\b(d|dia|diam|diameter)\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $2 ")
    .replace(/ф\.?\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $1 ")
    .replace(/\bдиам(?:етр)?\.?\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $1 ")
    .replace(/([0-9]+),([0-9]+)/g, "$1.$2")
    // "М 2.0" and "М 2" are the same thread, "ф 10.0" the same diameter.
    .replace(/([0-9])\.0+(?![0-9])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    // The price list spells the same thread both ways: "М 10" (292 times) and
    // "М10" (12). Gluing a short marker to the number it labels — м, g, тр, к,
    // тип, исп — makes both spellings meet on the same string. "ф" is left
    // alone: diameters are parsed separately from the raw text.
    .replace(/(^| )(?!ф )([a-zа-я]{1,4}) (?=[0-9])/g, "$1$2");
}

// Each entry is a group of interchangeable spellings: the product has to match
// ONE of them. Latin "m10" and Cyrillic "м10" are the same thread, so putting
// them in one flat token list (as this used to) demanded both at once and made
// "М10 Р6М5" match nothing at all.
function queryTokenGroups(value) {
  const withoutDiameter = String(value || "").replace(
    /(?:ф|ø|Ø|⌀|d|dia|diam|diameter|диам(?:етр)?)\.?\s*[0-9]+(?:[.,][0-9]+)?/gi,
    " ",
  );
  const normalized = normalizeSearchText(withoutDiameter);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const variants = new Set([token]);
      if (token.startsWith("m")) variants.add(`м${token.slice(1)}`);
      if (token.startsWith("м")) variants.add(`m${token.slice(1)}`);
      return [...variants].map(searchMatcher);
    });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compiled once per query, not once per product.
function searchMatcher(token) {
  // A bare number has to match as a whole word, or "8.5" also pulls in 18.5,
  // 28.5 and 128.5, plus every length and shank dimension containing it.
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(token)) return { token, kind: "number" };
  // A size marker is bounded on both sides: "м2" is not "м20" or "м2.5" on the
  // right, and not "км2" (Морзе taper) or "р9м4к8" (steel grade) on the left.
  // Written as a leading character class rather than a lookbehind so that older
  // Safari, which throws on lookbehind, keeps working.
  if (/^[a-zа-яіїєґ]+[0-9]/.test(token)) {
    return {
      token,
      kind: "size",
      pattern: new RegExp(`(?:^|[^0-9a-zа-яіїєґ])${escapeRegExp(token)}(?![0-9.])`),
    };
  }
  return { token, kind: "word" };
}

function matcherHits(matcher, haystack, paddedHaystack) {
  if (matcher.kind === "number") return paddedHaystack.includes(` ${matcher.token} `);
  // Padded so a marker at position 0 still has a left boundary to match.
  if (matcher.kind === "size") return matcher.pattern.test(paddedHaystack);
  return haystack.includes(matcher.token);
}

function diameterQueries(value) {
  const matches = String(value || "").matchAll(
    /(?:ф|ø|Ø|⌀|d|dia|diam|diameter|диам(?:етр)?)\.?\s*([0-9]+(?:[.,][0-9]+)?)/gi,
  );

  return [...matches]
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((number) => Number.isFinite(number));
}

function productDiameters(product) {
  if (!productDiameterCache.has(product)) {
    const source = [product.nameRu, product.nameUa, product.sectionRu, product.sectionUa].join(" ");
    const diameters = [...source.matchAll(/(?:ф|ø|Ø|⌀)\.?\s*([0-9]+(?:[.,][0-9]+)?)/gi)]
      .map((match) => Number(match[1].replace(",", ".")))
      .filter((number) => Number.isFinite(number));
    productDiameterCache.set(product, diameters);
  }

  return productDiameterCache.get(product);
}

function productSearchText(product) {
  if (!productSearchTextCache.has(product)) {
    productSearchTextCache.set(
      product,
      normalizeSearchText(
        [
          product.sku,
          product.nameRu,
          product.nameUa,
          product.categoryRu,
          product.categoryUa,
          product.sectionRu,
          product.sectionUa,
        ].join(" "),
      ),
    );
  }

  return productSearchTextCache.get(product);
}

function diameterMatches(product, diameters) {
  if (!diameters.length) return true;
  const productValues = productDiameters(product);

  return diameters.every((queryValue) =>
    productValues.some((productValue) => {
      if (Number.isInteger(queryValue)) {
        return productValue >= queryValue && productValue < queryValue + 1;
      }
      return Math.abs(productValue - queryValue) < 0.001;
    }),
  );
}

function matchScore(product, tokenGroups, diameters) {
  if (!diameterMatches(product, diameters)) return -1;
  if (!tokenGroups.length) return diameters.length ? 6 : 0;
  const haystack = productSearchText(product);
  const paddedHaystack = ` ${haystack} `;
  const name = normalizeSearchText(productName(product));
  const paddedName = ` ${name} `;
  let score = diameters.length * 10;

  for (const group of tokenGroups) {
    if (!group.some((matcher) => matcherHits(matcher, haystack, paddedHaystack))) return -1;
    if (group.some((matcher) => matcherHits(matcher, name, paddedName))) score += 8;
    if (group.some((matcher) => paddedHaystack.includes(` ${matcher.token} `))) score += 3;
    score += 1;
  }

  return score;
}

function requestHref(product) {
  const subject = state.lang === "uk" ? `Запит FLAKS: ${product.sku}` : `Запрос FLAKS: ${product.sku}`;
  const lines =
    state.lang === "uk"
      ? [
          "Добрий день.",
          "Прошу уточнити наявність та умови замовлення:",
          `${product.sku} — ${productName(product)}`,
          `Кількість на сайті: ${formatQty(product.qty)} шт.`,
          `Ціна без ПДВ: ${formatPrice(product.price)}`,
        ]
      : [
          "Добрый день.",
          "Прошу уточнить наличие и условия заказа:",
          `${product.sku} — ${productName(product)}`,
          `Количество на сайте: ${formatQty(product.qty)} шт.`,
          `Цена без НДС: ${formatPrice(product.price)}`,
        ];

  return `mailto:${data.store.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function productPageHref(product) {
  const suffix = state.lang === "ru" ? "?lang=ru" : "";
  return `products/${encodeURIComponent(product.sku.toLowerCase())}.html${suffix}`;
}

function cartButtonAttrs(product) {
  return [
    "data-cart-add",
    `data-cart-sku="${escapeHtml(product.sku)}"`,
    `data-cart-name-ua="${escapeHtml(product.nameUa)}"`,
    `data-cart-name-ru="${escapeHtml(product.nameRu)}"`,
    `data-cart-price="${escapeHtml(product.price)}"`,
    `data-cart-stock="${escapeHtml(product.qty)}"`,
  ].join(" ");
}

function translatePage() {
  els.html.lang = state.lang;
  document.title =
    state.lang === "uk"
      ? "Металообробний інструмент FLAKS купити в Україні | Фрези, свердла, мітчики"
      : "Металлообрабатывающий инструмент FLAKS купить в Украине | Фрезы, сверла, метчики";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("[data-lang-content]").forEach((node) => {
    node.hidden = node.dataset.langContent !== state.lang;
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === state.lang);
  });

  populateCategories();
  renderCategoryLinks();
}

function populateCategories() {
  const current = els.category.value || state.category;
  const options = [`<option value="all">${escapeHtml(t("allCategories"))}</option>`].concat(
    data.categories
      .filter((cat) => cat.count > 0)
      .map((cat) => {
        const label = state.lang === "uk" ? cat.ua : cat.ru;
        return `<option value="${escapeHtml(cat.slug)}">${escapeHtml(label)} (${cat.count})</option>`;
      }),
  );

  els.category.innerHTML = options.join("");
  els.category.value = current;
  if (!els.category.value) {
    els.category.value = "all";
    state.category = "all";
  }
}

function renderCategoryLinks() {
  if (!els.categoryLinks) return;
  // build-seo.mjs server-renders this grid into index.html with both languages in
  // data-lang-content spans, so translatePage() already handles switching. Only
  // build it here if the server-rendered markup is missing.
  if (els.categoryLinks.querySelector("a")) return;

  els.categoryLinks.innerHTML = data.categories
    .filter((cat) => cat.count > 0)
    .map((cat) => {
      const label = state.lang === "uk" ? cat.ua : cat.ru;
      const locale = state.lang === "uk" ? "uk-UA" : "ru-UA";
      return `<a href="catalog/${escapeHtml(cat.slug)}.html">
        <strong>${escapeHtml(label)}</strong>
        <span>${cat.count.toLocaleString(locale)}</span>
      </a>`;
    })
    .join("");
}

function filteredProducts() {
  const tokenGroups = queryTokenGroups(state.query);
  const diameters = diameterQueries(state.query);
  // Scored once here and reused by the sort below: recomputing the score inside
  // the comparator ran the whole string match twice per comparison.
  const scores = new Map();

  const list = data.products.filter((product) => {
    if (state.stockOnly && product.qty <= 0) return false;
    if (state.category !== "all" && product.categorySlug !== state.category) return false;
    const score = matchScore(product, tokenGroups, diameters);
    if (score < 0) return false;
    scores.set(product, score);
    return true;
  });

  const byName = (a, b) => productName(a).localeCompare(productName(b), state.lang === "uk" ? "uk" : "ru");

  if (state.sort === "relevance" && (tokenGroups.length || diameters.length)) {
    list.sort((a, b) => scores.get(b) - scores.get(a) || byName(a, b));
  }
  if (state.sort === "priceAsc") list.sort((a, b) => a.price - b.price || byName(a, b));
  if (state.sort === "priceDesc") list.sort((a, b) => b.price - a.price || byName(a, b));
  if (state.sort === "qtyDesc") list.sort((a, b) => b.qty - a.qty || byName(a, b));
  if (state.sort === "nameAsc") list.sort(byName);

  return list;
}

function renderRows(products) {
  if (!products.length) {
    els.rows.innerHTML = `<tr><td colspan="5">${escapeHtml(t("noResults"))}</td></tr>`;
    return;
  }

  els.rows.innerHTML = products
    .map((product) => {
      const section = sectionName(product);
      return `
        <tr>
          <td class="name-cell">
            <strong><a href="${escapeHtml(productPageHref(product))}">${escapeHtml(productName(product))}</a></strong>
            <small>${escapeHtml(t("sku"))}: ${escapeHtml(product.sku)}${section ? ` · ${escapeHtml(t("section"))}: ${escapeHtml(section)}` : ""}</small>
          </td>
          <td>${escapeHtml(categoryName(product))}</td>
          <td><span class="qty-badge">${escapeHtml(formatQty(product.qty))}</span></td>
          <td class="price">${escapeHtml(formatPrice(product.price))}</td>
          <td><button class="cart-add-button" type="button" ${cartButtonAttrs(product)}></button></td>
        </tr>
      `;
    })
    .join("");
}

function renderCards(products) {
  if (!products.length) {
    els.cards.innerHTML = `<div class="product-card">${escapeHtml(t("noResults"))}</div>`;
    return;
  }

  els.cards.innerHTML = products
    .map((product) => {
      const section = sectionName(product);
      return `
        <article class="product-card">
          <div>
            <p class="eyebrow">${escapeHtml(categoryName(product))}</p>
            <h3><a href="${escapeHtml(productPageHref(product))}">${escapeHtml(productName(product))}</a></h3>
            <span class="muted">${escapeHtml(t("sku"))}: ${escapeHtml(product.sku)}${section ? ` · ${escapeHtml(section)}` : ""}</span>
          </div>
          <div class="card-meta">
            <span class="qty-badge">${escapeHtml(formatQty(product.qty))}</span>
            <strong class="price">${escapeHtml(formatPrice(product.price))}</strong>
          </div>
          <button class="cart-add-button" type="button" ${cartButtonAttrs(product)}></button>
        </article>
      `;
    })
    .join("");
}

function render() {
  const list = filteredProducts();
  const pages = Math.max(1, Math.ceil(list.length / state.perPage));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * state.perPage;
  const pageItems = list.slice(start, start + state.perPage);

  els.resultCount.textContent = list.length.toLocaleString(state.lang === "uk" ? "uk-UA" : "ru-UA");
  els.pageInfo.textContent = `${t("page")} ${state.page} ${t("from")} ${pages}`;
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.page >= pages;

  renderRows(pageItems);
  renderCards(pageItems);
  window.dispatchEvent(new CustomEvent("flaks-cart-change"));
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("flaks-lang", lang);
  translatePage();
  updateSearchUrl();
  render();
  window.dispatchEvent(new CustomEvent("flaks-lang-change", { detail: { lang } }));
}

function setView(view) {
  state.view = view;
  els.table.classList.toggle("hidden", view !== "table");
  els.cards.classList.toggle("hidden", view !== "cards");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  // Every keystroke rescans all 12k products, so hold off until typing pauses.
  let searchTimer;
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      updateSearchUrl();
      render();
    }, 150);
  });

  els.category.addEventListener("change", (event) => {
    state.category = event.target.value;
    state.page = 1;
    render();
  });

  els.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    render();
  });

  els.stockOnly.addEventListener("change", (event) => {
    state.stockOnly = event.target.checked;
    state.page = 1;
    render();
  });

  els.reset.addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    state.sort = "relevance";
    state.stockOnly = true;
    state.page = 1;
    els.search.value = "";
    els.category.value = "all";
    els.sort.value = "relevance";
    els.stockOnly.checked = true;
    updateSearchUrl();
    render();
  });

  els.prev.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    render();
  });

  els.next.addEventListener("click", () => {
    state.page += 1;
    render();
  });
}

function updateSearchUrl() {
  const url = new URL(window.location.href);
  if (state.query.trim()) {
    url.searchParams.set("q", state.query.trim());
  } else {
    url.searchParams.delete("q");
  }
  if (state.lang === "ru") {
    url.searchParams.set("lang", "ru");
  } else {
    url.searchParams.delete("lang");
  }
  window.history.replaceState({}, "", url);
  updateLanguageLinks();
}

function updateLanguageLinks() {
  document.querySelectorAll("a[data-keep-lang]").forEach((link) => {
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (state.lang === "ru") {
      url.searchParams.set("lang", "ru");
    } else {
      url.searchParams.delete("lang");
    }
    link.setAttribute("href", url.pathname + url.search + url.hash);
  });
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  const query = params.get("q") || "";

  if (lang === "ru" || lang === "uk") {
    state.lang = lang;
    localStorage.setItem("flaks-lang", lang);
  }

  if (query) {
    state.query = query;
    els.search.value = query;
  }
}

function init() {
  els.statProducts.textContent = data.products.length.toLocaleString("uk-UA");
  els.statCategories.textContent = data.categories.filter((cat) => cat.count > 0).length.toLocaleString("uk-UA");
  applyUrlState();
  bindEvents();
  translatePage();
  updateLanguageLinks();
  setView(state.view);
  render();
}

init();
