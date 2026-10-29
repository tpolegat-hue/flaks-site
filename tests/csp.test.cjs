// Guards the strict Content-Security-Policy: every executable inline script on
// the site must be allowed by a SHA-256 hash, so a template change cannot
// silently break analytics or the language preference after deploy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  .headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
const scriptSrc = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src ')) || '';
const allowed = new Set(scriptSrc.split(/\s+/).map((part) => part.replace(/^'|'$/g, '')).filter((part) => part.startsWith('sha256-')));

function htmlFiles(dir) {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute)
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(dir, name));
}

test('script-src does not allow unsafe-inline', () => {
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), scriptSrc);
  assert.ok(scriptSrc.includes('https://www.googletagmanager.com'), 'GA must stay allowed');
});

test('every executable inline script is covered by a CSP hash', () => {
  const files = [
    ...htmlFiles('products'),
    ...htmlFiles('catalog'),
    ...htmlFiles(path.join('ru', 'products')),
    ...htmlFiles(path.join('ru', 'catalog')),
    ...htmlFiles('articles'),
    ...htmlFiles('.'),
  ];
  const unknown = new Map();
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/application\/ld\+json/i.test(match[1])) continue;
      const hash = `sha256-${crypto.createHash('sha256').update(match[2], 'utf8').digest('base64')}`;
      if (!allowed.has(hash)) {
        if (!unknown.has(hash)) unknown.set(hash, []);
        if (unknown.get(hash).length < 3) unknown.get(hash).push(file);
      }
    }
  }
  assert.equal(unknown.size, 0, [...unknown].map(([hash, list]) => `${hash} in ${list.join(', ')}`).join('\n'));
});

test('every local script reference exists on disk', () => {
  const files = [
    ...htmlFiles('products').slice(0, 5),
    ...htmlFiles('catalog').slice(0, 5),
    ...htmlFiles('articles'),
    ...htmlFiles('.'),
  ];
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const src = match[1];
      if (/^https?:/.test(src)) continue;
      const resolved = src.startsWith('/')
        ? path.join(root, src.slice(1))
        : path.join(root, path.dirname(file), src);
      assert.ok(fs.existsSync(resolved), `${file} -> ${src}`);
    }
  }
});
