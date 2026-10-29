const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.js'), 'utf8').replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

function cartHarness(initial = '[]', blocked = false, fetchImpl, language = 'uk') {
  const stored = new Map([['flaks-cart', initial]]);
  const storage = {
    getItem: (k) => { if (blocked) throw new Error('blocked'); return stored.get(k) || null; },
    setItem: (k, v) => { if (blocked) throw new Error('blocked'); stored.set(k, v); },
    removeItem: (k) => stored.delete(k),
  };
  const context = {
    localStorage: storage, sessionStorage: storage, URLSearchParams, CustomEvent: class {},
    document: { readyState: 'loading', addEventListener() {}, documentElement: { lang: language }, querySelector: () => null, querySelectorAll: () => [] },
    window: { dispatchEvent() {} },
    fetch: fetchImpl,
    FormData: class { get(key) { return key === 'phone' ? '+380670000000' : ''; } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../assets/cart.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'globalThis.cartTest = { readCart, writeCart, addItem, cartTotal, updateQty, submitOrder, cartBodyHtml, setSuccessMessage }; })();');
  vm.runInNewContext(source, context);
  return context.cartTest;
}

const p = { sku: 'FLK-TEST', nameUa: 'Тест', nameRu: 'Тест', price: 2000, stock: 5, requestQty: 1 };

test('corrupt stored items cannot crash cart and duplicate SKUs are discarded', () => {
  const c = cartHarness(JSON.stringify([null, 42, {}, p, p]));
  assert.equal(c.readCart().length, 1); assert.equal(c.cartTotal(), 2000);
});

test('invalid JSON cart recovers when a product is added', () => {
  const c = cartHarness('{'); c.addItem(p); assert.equal(c.readCart()[0].sku, p.sku);
});

test('blocked browser storage still allows shopping within current page', () => {
  const c = cartHarness('[]', true); c.addItem(p); c.addItem(p);
  assert.equal(c.readCart()[0].requestQty, 2);
  c.updateQty(p.sku, 99); assert.equal(c.readCart()[0].requestQty, 5);
});

test('adding a previously saved product refreshes old price and stock', () => {
  const c = cartHarness(JSON.stringify([p])); c.addItem({ ...p, price: 2100, stock: 1 });
  assert.equal(c.readCart()[0].price, 2100); assert.equal(c.readCart()[0].requestQty, 1);
});

test('cart money is calculated in kopecks without floating point accumulation', () => {
  const c = cartHarness(); assert.equal(c.cartTotal([{ price: 0.1, requestQty: 3 }]), 0.3);
});

test('empty and completed Russian carts return to Russian catalog search', () => {
  const c = cartHarness('[]', false, undefined, 'ru');
  assert.match(c.cartBodyHtml([], 'page'), /href="\/index\.html\?lang=ru#catalog"/);
  c.setSuccessMessage(true);
  assert.match(c.cartBodyHtml([], 'page'), /href="\/index\.html\?lang=ru#catalog"/);
  const uk = cartHarness();
  assert.match(uk.cartBodyHtml([], 'page'), /href="\/index\.html#catalog"/);
});

function checkoutForm() {
  const status = { dataset: {}, textContent: '' }, button = { disabled: false };
  return { dataset: {}, status, button, reset() {}, querySelector: (selector) => selector === '[data-cart-status]' ? status : button };
}

test('409 refreshes stale cart and asks for confirmation without a second request', async () => {
  let requests = 0;
  const c = cartHarness(JSON.stringify([p]), false, async () => {
    requests++; return { status: 409, json: async () => ({ items: [{ ...p, price: 2300 }] }) };
  });
  const form = checkoutForm(); await c.submitOrder(form);
  assert.equal(requests, 1); assert.equal(c.readCart()[0].price, 2300);
  assert.ok(form.status.textContent.includes('підтвердьте')); assert.equal(form.dataset.cartSubmitting, undefined);
});

test('parallel submit is ignored and successful request preserves later cart additions', async () => {
  let finish, requests = 0;
  const c = cartHarness(JSON.stringify([p]), false, () => { requests++; return new Promise((resolve) => { finish = resolve; }); });
  const form = checkoutForm(); const pending = c.submitOrder(form);
  await c.submitOrder(form); assert.equal(requests, 1);
  c.addItem(p); finish({ status: 200, ok: true }); await pending;
  assert.equal(c.readCart()[0].requestQty, 1);
});

function searchHarness(storedLang) {
  const context = {
    window: { FLAKS_DATA: data }, document: { documentElement: {}, querySelector: () => ({}) },
    localStorage: { getItem: () => { if (storedLang === 'blocked') throw new Error(); return storedLang; } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8')
    .replace(/\ninit\(\);\s*$/, '\nglobalThis.searchTest = { state, filteredProducts, formatPrice, productPageHref, foundLabel };');
  vm.runInNewContext(source, context); return context.searchTest;
}

test('invalid and blocked language preferences fall back to Ukrainian', () => {
  for (const lang of ['broken', 'blocked']) {
    const s = searchHarness(lang); assert.equal(s.state.lang, 'uk'); assert.ok(s.formatPrice(1));
  }
});

test('pagination reuses search results; changing filters invalidates the cache', () => {
  const s = searchHarness('uk'); s.state.query = 'М10';
  const first = s.filteredProducts(); assert.ok(first.length > 0);
  s.state.page = 2; assert.equal(s.filteredProducts(), first);
  s.state.query = 'FLK-12037'; const changed = s.filteredProducts();
  assert.notEqual(changed, first); assert.equal(changed.length, 1); assert.equal(changed[0].sku, 'FLK-12037');
  s.state.category = 'plashki'; assert.equal(s.filteredProducts().length, 0);
});

test('price sorting stays correct after locale/collator optimization', () => {
  const s = searchHarness('ru'); s.state.sort = 'priceAsc';
  const list = s.filteredProducts();
  assert.ok(list.every((p, i) => i === 0 || p.price >= list[i - 1].price));
});

test('search product links point to the selected language tree', () => {
  const s = searchHarness('ru');
  assert.equal(s.productPageHref({ sku: 'FLK-12037' }), '/ru/products/flk-12037.html');
  s.state.lang = 'uk';
  assert.equal(s.productPageHref({ sku: 'FLK-12037' }), '/products/flk-12037.html');
});

test('search result count uses the right Ukrainian and Russian word forms', () => {
  const s = searchHarness('uk');
  assert.equal(s.foundLabel(1), 'позицію знайдено');
  assert.equal(s.foundLabel(2), 'позиції знайдено');
  assert.equal(s.foundLabel(11), 'позицій знайдено');
  assert.equal(s.foundLabel(21), 'позицію знайдено');
  s.state.lang = 'ru';
  assert.equal(s.foundLabel(1), 'позиция найдена');
  assert.equal(s.foundLabel(3), 'позиции найдены');
  assert.equal(s.foundLabel(12), 'позиций найдено');
  assert.equal(s.foundLabel(25), 'позиций найдено');
});

test('generated search links reach the interactive catalog and preserve language', () => {
  for (const file of ['ru/index.html', 'ru/catalog/index.html', 'ru/catalog/frezy-diskovye.html', 'ru/products/flk-12037.html', 'products/flk-12037.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(?:Поиск|Пошук) по каталогу<\/a>/g)];
    assert.ok(links.length, `${file}: missing search link`);
    for (const [, href] of links) {
      const url = new URL(href, `https://www.flaks.com.ua/${file}`);
      assert.equal(url.pathname, '/index.html', file);
      assert.equal(url.hash, '#catalog', file);
      assert.equal(url.searchParams.get('lang'), file.startsWith('ru/') ? 'ru' : null, file);
    }
  }
  const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(index, /id="catalog"/);
  assert.match(index, /id="searchInput"/);
  const popularSearchLinks = [...index.matchAll(/<a\b[^>]*href="\?q=[^"]+#catalog"[^>]*>/g)];
  assert.equal(popularSearchLinks.length, 8);
  assert.ok(popularSearchLinks.every(([link]) => link.includes('data-keep-lang')));
});

test('catalog loader keeps language on links before the catalog JavaScript loads', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/catalog-loader.js'), 'utf8');
  let href = '?q=фреза%20Р6М5#catalog';
  const link = { getAttribute: () => href, setAttribute: (_name, value) => { href = value; } };
  const context = {
    URL, URLSearchParams,
    window: { location: { href: 'https://www.flaks.com.ua/index.html?lang=ru', search: '?lang=ru', hash: '' } },
    document: {
      currentScript: undefined,
      querySelector: () => null,
      querySelectorAll: (selector) => selector === 'a[data-keep-lang]' ? [link] : [],
    },
    localStorage: { getItem: () => null },
  };
  vm.runInNewContext(source, context);
  assert.equal(href, '/index.html?q=%D1%84%D1%80%D0%B5%D0%B7%D0%B0+%D0%A06%D0%9C5&lang=ru#catalog');
});

test('deployed pages carry no inline executable scripts', () => {
  const pages = ['index.html', 'cart.html', '404.html', 'about.html', 'contacts.html', 'delivery.html', 'payment.html', 'returns.html', 'privacy.html', 'articles/index.html', 'articles/konus-morze-rozmiry.html'];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)]
      .filter(([, attrs]) => !/application\/ld\+json/i.test(attrs));
    assert.equal(inline.length, 0, `${page}: inline script would be blocked by the CSP`);
    assert.ok(!/\son(?:load|error|click|change|input|submit)="/.test(html), `${page}: inline event handler would be blocked by the CSP`);
  }
});

test('Russian home page links stay inside the Russian tree', () => {
  const html = fs.readFileSync(path.join(__dirname, '../ru/index.html'), 'utf8');
  const brand = html.match(/<a class="brand" href="([^"]+)"/)?.[1];
  assert.equal(brand, '/ru');
  const catalog = html.match(/<a class="contact-link" href="([^"]+)"[^>]*>Каталог<\/a>/)?.[1];
  assert.equal(catalog, '/ru/catalog');
  assert.match(html, /<a class="primary-button" href="\/ru\/catalog">/);
  const cards = [...html.matchAll(/<a href="([^"]+)" data-keep-lang>/g)].map((match) => match[1]);
  const categoryCards = cards.filter((href) => href.includes('/catalog/') && href.endsWith('.html'));
  assert.ok(categoryCards.length > 0, 'category grid is missing');
  assert.ok(categoryCards.every((href) => href.startsWith('/ru/catalog/')), categoryCards.filter((href) => !href.startsWith('/ru/catalog/')).join(', '));
});

test('Russian catalog hub links stay inside the Russian tree', () => {
  const html = fs.readFileSync(path.join(__dirname, '../ru/catalog/index.html'), 'utf8');
  assert.match(html, /<a href="\/ru" data-keep-lang>Главная<\/a>/);
  const cards = [...html.matchAll(/<a href="([^"]+)" data-keep-lang>/g)].map((match) => match[1]);
  const categoryCards = cards.filter((href) => href.includes('/catalog/') && href.endsWith('.html'));
  assert.ok(categoryCards.length > 0, 'category grid is missing');
  assert.ok(categoryCards.every((href) => href.startsWith('/ru/catalog/')), categoryCards.filter((href) => !href.startsWith('/ru/catalog/')).join(', '));
});

