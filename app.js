const data = window.FLAKS_DATA;

const i18n = {
  uk: {
    brandNote: "Металообробний інструмент",
    eyebrow: "Прайс із наявності",
    heroTitle: "Металообробний інструмент FLAKS",
    heroText: "Каталог із цінами в гривні без ПДВ, залишками на складі та швидкою заявкою через email або телефон.",
    openCatalog: "Відкрити каталог",
    sendRequest: "Надіслати заявку",
    items: "позицій",
    categories: "категорій",
    uah: "UAH",
    noVat: "ціни без ПДВ",
    seoCategories: "Категорії інструменту",
    categoryIndexTitle: "Швидкий перехід до розділів",
    catalog: "Каталог",
    search: "Пошук",
    searchPlaceholder: "Назва, розмір, Р6М5, М10...",
    diameterHint: "Ф, Ø, d і діаметр шукаються однаково.",
    category: "Категорія",
    allCategories: "Усі категорії",
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
    tableAction: "Заявка",
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
    eyebrow: "Прайс из наличия",
    heroTitle: "Металлообрабатывающий инструмент FLAKS",
    heroText: "Каталог с ценами в гривне без НДС, остатками на складе и быстрой заявкой через email или телефон.",
    openCatalog: "Открыть каталог",
    sendRequest: "Отправить заявку",
    items: "позиций",
    categories: "категорий",
    uah: "UAH",
    noVat: "цены без НДС",
    seoCategories: "Категории инструмента",
    categoryIndexTitle: "Быстрый переход к разделам",
    catalog: "Каталог",
    search: "Поиск",
    searchPlaceholder: "Название, размер, Р6М5, М10...",
    diameterHint: "Ф, Ø, d и диаметр ищутся одинаково.",
    category: "Категория",
    allCategories: "Все категории",
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
    tableAction: "Заявка",
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
  return Number.isInteger(qty) ? String(qty) : qty.toLocaleString("uk-UA");
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
    .replace(/[.,;:()[\]{}]/g, " ")
    .replace(/[×х]/g, "x")
    .replace(/[øØ⌀]/g, " ф ")
    .replace(/\b(d|dia|diam|diameter)\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $2 ")
    .replace(/ф\.?\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $1 ")
    .replace(/\bдиам(?:етр)?\.?\s*([0-9]+(?:[.,][0-9]+)?)/g, " ф $1 ")
    .replace(/([0-9]+),([0-9]+)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(value) {
  const withoutDiameter = String(value || "").replace(
    /(?:ф|ø|Ø|⌀|d|dia|diam|diameter|диам(?:етр)?)\.?\s*[0-9]+(?:[.,][0-9]+)?/gi,
    " ",
  );
  const normalized = normalizeSearchText(withoutDiameter);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .flatMap((token) => {
      const variants = [token];
      if (token.startsWith("m")) variants.push(token.replace(/^m/, "м"));
      if (token.startsWith("м")) variants.push(token.replace(/^м/, "m"));
      return variants;
    })
    .filter((token, index, arr) => token && arr.indexOf(token) === index);
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
  if (!product._diameters) {
    const source = [product.nameRu, product.nameUa, product.sectionRu, product.sectionUa].join(" ");
    product._diameters = [...source.matchAll(/(?:ф|ø|Ø|⌀)\.?\s*([0-9]+(?:[.,][0-9]+)?)/gi)]
      .map((match) => Number(match[1].replace(",", ".")))
      .filter((number) => Number.isFinite(number));
  }

  return product._diameters;
}

function productSearchText(product) {
  if (!product._searchText) {
    product._searchText = normalizeSearchText(
      [
        product.sku,
        product.nameRu,
        product.nameUa,
        product.categoryRu,
        product.categoryUa,
        product.sectionRu,
        product.sectionUa,
      ].join(" "),
    );
  }

  return product._searchText;
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

function matchScore(product, tokens, diameters) {
  if (!diameterMatches(product, diameters)) return -1;
  if (!tokens.length) return diameters.length ? 6 : 0;
  const haystack = productSearchText(product);
  const name = normalizeSearchText(productName(product));
  let score = diameters.length * 10;

  for (const token of tokens) {
    if (!haystack.includes(token)) return -1;
    if (name.includes(token)) score += 8;
    if (haystack.includes(` ${token} `)) score += 3;
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
  const tokens = queryTokens(state.query);
  const diameters = diameterQueries(state.query);

  let list = data.products.filter((product) => {
    if (state.stockOnly && product.qty <= 0) return false;
    if (state.category !== "all" && product.categorySlug !== state.category) return false;
    return matchScore(product, tokens, diameters) >= 0;
  });

  list = list.slice();
  const byName = (a, b) => productName(a).localeCompare(productName(b), state.lang === "uk" ? "uk" : "ru");

  if (state.sort === "relevance" && (tokens.length || diameters.length)) {
    list.sort((a, b) => matchScore(b, tokens, diameters) - matchScore(a, tokens, diameters) || byName(a, b));
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
            <strong>${escapeHtml(productName(product))}</strong>
            <small>${escapeHtml(t("sku"))}: ${escapeHtml(product.sku)}${section ? ` · ${escapeHtml(t("section"))}: ${escapeHtml(section)}` : ""}</small>
          </td>
          <td>${escapeHtml(categoryName(product))}</td>
          <td><span class="qty-badge">${escapeHtml(formatQty(product.qty))}</span></td>
          <td class="price">${escapeHtml(formatPrice(product.price))}</td>
          <td><a class="request-link" href="${requestHref(product)}">${escapeHtml(t("request"))}</a></td>
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
            <h3>${escapeHtml(productName(product))}</h3>
            <span class="muted">${escapeHtml(t("sku"))}: ${escapeHtml(product.sku)}${section ? ` · ${escapeHtml(section)}` : ""}</span>
          </div>
          <div class="card-meta">
            <span class="qty-badge">${escapeHtml(formatQty(product.qty))}</span>
            <strong class="price">${escapeHtml(formatPrice(product.price))}</strong>
          </div>
          <a class="request-link" href="${requestHref(product)}">${escapeHtml(t("request"))}</a>
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
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("flaks-lang", lang);
  translatePage();
  updateSearchUrl();
  render();
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

  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.page = 1;
    updateSearchUrl();
    render();
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
  setView(state.view);
  render();
}

init();
