// Smoke check only: the API probe has no customer and cannot create an order.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const normalize = (text) => text.replace(/\r\n/g, '\n');
async function get(url, options) {
  return fetch(url, { signal: AbortSignal.timeout(20000), ...options });
}
async function main() {
  for (const origin of ['https://www.flaks.com.ua', 'https://flaks-site.vercel.app']) {
    await Promise.all(['app.js', 'assets/cart.js', 'assets/seo-lang-switch.js'].map(async (file) => {
      const r = await get(`${origin}/${file}`);
      assert.equal(r.status, 200, `${origin}/${file}`);
      assert.equal(normalize(await r.text()), normalize(fs.readFileSync(path.join(root, file), 'utf8')), `${origin}/${file} is not current`);
    }));
    await Promise.all(['/', '/cart.html', '/catalog/frezy-diskovye.html', '/products/flk-12037.html', '/ru/products/flk-12037.html', '/robots.txt', '/sitemap.xml'].map(async (file) => {
      const r = await get(origin + file); assert.equal(r.status, 200, origin + file);
    }));
    const method = await get(origin + '/api/order');
    assert.equal(method.status, 405, `${origin}: API must be running and reject GET`);
    assert.equal(method.headers.get('cache-control'), 'no-store');
    const internal = await get(origin + '/docs/audit-and-roadmap-2026-09-23.md');
    assert.equal(internal.status, 404, `${origin}: internal report must not be public`);
    console.log(`${origin}: current scripts, key pages, API and private-file exclusion OK`);
  }
  const r = await get('https://www.flaks.com.ua/api/order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ sku: 'FLK-12037', requestQty: 1, price: -1 }] }),
  });
  assert.equal(r.status, 409, 'API must detect stale/tampered price');
  const result = await r.json();
  const catalog = require('../lib/order-catalog.json');
  assert.equal(result.items[0].price, catalog['FLK-12037'].price);
  console.log('Production API: server catalog loaded; tampered price rejected with 409; no order submitted.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
