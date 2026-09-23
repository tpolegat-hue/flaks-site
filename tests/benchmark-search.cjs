// Local CPU microbenchmark; does not measure network or browser paint time.
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^\uFEFF?window\.FLAKS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
const baseline = cp.execFileSync('git', ['show', 'HEAD:app.js'], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const [label, source] of [['HEAD', baseline], ['Working tree', current]]) {
  const ctx = { window: { FLAKS_DATA: data }, document: { documentElement: {}, querySelector: () => ({}) }, localStorage: { getItem: () => 'uk' } };
  vm.runInNewContext(source.replace(/\ninit\(\);\s*$/, '\nglobalThis.bench = {state, filteredProducts};'), ctx);
  ctx.bench.state.query = 'М10';
  let start = performance.now();
  const result = ctx.bench.filteredProducts();
  const first = performance.now() - start;
  start = performance.now();
  for (let i = 0; i < 20; i++) { ctx.bench.state.page = i + 1; ctx.bench.filteredProducts(); }
  console.log(JSON.stringify({ version: label, products: data.products.length, matches: result.length, firstSearchMs: +first.toFixed(2), twentyPageFiltersMs: +(performance.now() - start).toFixed(2) }));
}
