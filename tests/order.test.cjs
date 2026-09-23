const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const catalog = require('../lib/order-catalog.json');
const source = fs.readFileSync(path.join(__dirname, '../api/order.js'), 'utf8');
const [sku, product] = Object.entries(catalog).find(([, p]) => p.price >= 2000 && p.stock >= 2);
const order = () => ({ customer: { phone: '+380 67 000 00 00' }, items: [{ sku, requestQty: 1, price: product.price }] });

function setup({ env = { RESEND_API_KEY: 'test-only' }, fetchImpl, now = Date.now() } = {}) {
  const deliveries = [], logs = [];
  let clock = now;
  class Clock extends Date { static now() { return clock; } }
  const sandbox = {
    module: { exports: {} }, require: () => catalog, Buffer, AbortSignal, FormData, Blob, Date: Clock,
    process: { env }, console: { error: (...args) => logs.push(args) },
    fetch: async (url, options) => {
      deliveries.push({ url, ...options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body });
      return fetchImpl ? fetchImpl(url, options) : { ok: true, json: async () => ({ id: 'test-only' }) };
    },
  };
  vm.runInNewContext(source, sandbox);
  async function request(body = order(), overrides = {}) {
    const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); } };
    await sandbox.module.exports({ method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' }, body, ...overrides }, response);
    return response;
  }
  return { request, deliveries, logs, advance: (ms) => { clock += ms; } };
}

test('server catalog matches every source SKU, price, name and stock', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data.js'), 'utf8').replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
  assert.equal(Object.keys(catalog).length, data.products.length);
  for (const p of data.products) assert.deepEqual(catalog[p.sku], { nameUa: p.nameUa, nameRu: p.nameRu, price: p.price, stock: p.qty });
});

test('successful order uses catalog names and totals, never client claims', async () => {
  const s = setup(), body = order();
  Object.assign(body.items[0], { nameUa: 'FORGED NAME', nameRu: 'FORGED NAME', stock: 999999 });
  body.total = 999999999;
  const r = await s.request(body);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(s.deliveries.length, 1);
  assert.ok(s.deliveries[0].body.text.includes(product.nameUa));
  assert.ok(!s.deliveries[0].body.text.includes('FORGED'));
  assert.ok(s.deliveries[0].signal instanceof AbortSignal);
});

test('tampered or stale prices require confirmation and send nothing', async () => {
  const s = setup(), body = order(); body.items[0].price = 1;
  const r = await s.request(body);
  assert.equal(r.code, 409); assert.equal(r.body.items[0].price, product.price); assert.equal(s.deliveries.length, 0);
});

test('stock is read from catalog, not supplied by caller', async () => {
  const [lowSku, p] = Object.entries(catalog).find(([, p]) => p.stock === 1);
  const s = setup(), body = order(); body.items = [{ sku: lowSku, price: p.price, stock: 999, requestQty: 2 }];
  const r = await s.request(body);
  assert.equal(r.code, 409); assert.equal(r.body.items[0].requestQty, 1); assert.equal(s.deliveries.length, 0);
});

test('SKU + quantity alone use canonical prices', async () => {
  const s = setup(), body = order(); delete body.items[0].price;
  assert.equal((await s.request(body)).code, 200);
});

for (const [label, body] of [
  ['null body', null], ['array body', []], ['malformed JSON', '{'],
  ['null item', { ...order(), items: [null] }], ['primitive item', { ...order(), items: [123] }],
  ['unknown SKU', { ...order(), items: [{ sku: 'FLK-UNKNOWN', requestQty: 1 }] }],
  ['prototype key', { ...order(), items: [{ sku: '__proto__', requestQty: 1 }] }],
  ['duplicate SKU', { ...order(), items: [order().items[0], order().items[0]] }],
  ['fractional quantity', { ...order(), items: [{ sku, requestQty: 1.2 }] }],
  ['boolean quantity', { ...order(), items: [{ sku, requestQty: true }] }],
  ['array quantity', { ...order(), items: [{ sku, requestQty: [1] }] }],
  ['negative quantity', { ...order(), items: [{ sku, requestQty: -1 }] }],
  ['missing quantity', { ...order(), items: [{ sku }] }],
  ['invalid phone', { ...order(), customer: { phone: 'hello' } }],
  ['too many lines', { ...order(), items: Array(101).fill(order().items[0]) }],
]) test(`${label}: validation returns 400, never sends`, async () => {
  const s = setup(); assert.equal((await s.request(body)).code, 400); assert.equal(s.deliveries.length, 0);
});

test('minimum order checked against trusted prices', async () => {
  const [smallSku, p] = Object.entries(catalog).find(([, p]) => p.price < 2000);
  const s = setup();
  assert.equal((await s.request({ ...order(), total: 2000, items: [{ sku: smallSku, requestQty: 1, price: p.price }] })).code, 400);
});

test('honeypot works for both string and parsed JSON bodies', async () => {
  for (const body of [{ ...order(), website: 'spam' }, JSON.stringify({ ...order(), website: 'spam' })]) {
    const s = setup(); assert.equal((await s.request(body)).code, 200); assert.equal(s.deliveries.length, 0);
  }
});

test('payload limit counts UTF-8 bytes', async () => {
  const s = setup(); assert.equal((await s.request({ comment: 'я'.repeat(51000) })).code, 413);
});

test('reject non-JSON, cross-site browser requests, and GET', async () => {
  const s = setup();
  assert.equal((await s.request(order(), { headers: { 'content-type': 'text/plain' } })).code, 415);
  assert.equal((await s.request(order(), { headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' } })).code, 403);
  const r = await s.request(order(), { method: 'GET' }); assert.equal(r.code, 405); assert.equal(r.headers.Allow, 'POST');
});

test('failed notification responses do not expose provider secrets in logs or response', async () => {
  const s = setup({ fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'SECRET' }) });
  const r = await s.request(); assert.equal(r.code, 500); assert.ok(!JSON.stringify([r, s.logs]).includes('SECRET'));
});

test('one working notification channel is sufficient', async () => {
  const s = setup({ env: { RESEND_API_KEY: 'test-only', TELEGRAM_BOT_TOKEN: 'test-only', TELEGRAM_CHAT_ID: 'test-only' },
    fetchImpl: async (url) => { if (url.includes('resend')) throw new Error('SECRET'); return { ok: true, json: async () => ({ ok: true }) }; } });
  assert.equal((await s.request()).code, 200); assert.equal(s.deliveries.length, 2);
});

test('no configured notification service is an error', async () => {
  const s = setup({ env: {} }); assert.equal((await s.request()).code, 500);
});

test('long Telegram orders arrive as a complete text attachment, including final SKU and total', async () => {
  const s = setup({ env: { TELEGRAM_BOT_TOKEN: 'test-only', TELEGRAM_CHAT_ID: 'test-only' } });
  const body = order();
  body.items = Object.entries(catalog).slice(0, 100).map(([sku, p]) => ({ sku, price: p.price, requestQty: 1 }));
  assert.equal((await s.request(body)).code, 200);
  assert.ok(s.deliveries[0].url.endsWith('/sendDocument'));
  const content = await s.deliveries[0].body.get('document').text();
  assert.ok(content.includes(body.items[99].sku));
  assert.ok(content.includes('Разом:'));
  assert.ok(content.length > 3900);
});

test('attempt rate limit has Retry-After; validation does not consume delivery quota', async () => {
  const s = setup(); assert.equal((await s.request({})).code, 400);
  const blocked = await s.request(); assert.equal(blocked.code, 429); assert.equal(blocked.headers['Retry-After'], '2');
  s.advance(2100); assert.equal((await s.request()).code, 200);
  s.advance(2100); assert.equal((await s.request()).code, 429);
});
