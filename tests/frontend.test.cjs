const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.js'), 'utf8').replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

function cartHarness(initial = '[]', blocked = false, fetchImpl) {
  const stored = new Map([['flaks-cart', initial]]);
  const storage = {
    getItem: (k) => { if (blocked) throw new Error('blocked'); return stored.get(k) || null; },
    setItem: (k, v) => { if (blocked) throw new Error('blocked'); stored.set(k, v); },
    removeItem: (k) => stored.delete(k),
  };
  const context = {
    localStorage: storage, sessionStorage: storage, URLSearchParams, CustomEvent: class {},
    document: { readyState: 'loading', addEventListener() {}, documentElement: { lang: 'uk' }, querySelector: () => null, querySelectorAll: () => [] },
    window: { dispatchEvent() {} },
    fetch: fetchImpl,
    FormData: class { get(key) { return key === 'phone' ? '+380670000000' : ''; } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../assets/cart.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'globalThis.cartTest = { readCart, writeCart, addItem, cartTotal, updateQty, submitOrder }; })();');
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
    .replace(/\ninit\(\);\s*$/, '\nglobalThis.searchTest = { state, filteredProducts, formatPrice };');
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
