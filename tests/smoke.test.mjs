import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production layout excludes test reset styling', async () => {
  const layout = await read('app/layout.tsx');
  assert.equal(layout.includes('test-data-reset.css'), false);
});

test('home has neutral dynamic startup values and Supabase session bootstrap', async () => {
  const page = await read('app/page.tsx');
  assert.equal(page.includes('Dra. Andrea Vargas'), false);
  assert.match(page, /useState\("Profesional ASHA"\)/);
  assert.match(page, /useState\(todayLabel\(\)\)/);
  assert.match(page, /\/api\/asha-auth\/session/);
});

test('secondary product UI keeps sales operational but master actions admin-only', async () => {
  const products = await read('app/products.tsx');
  const page = await read('app/page.tsx');
  assert.match(products, /adminMode&&/);
  assert.match(products, /kind:\"sell\"/);
  assert.match(page, /adminMode=\{isPrimary\}/);
});

test('accounting reports profit only for products while preserving total income', async () => {
  const accounting = await read('app/accounting.tsx');
  assert.match(accounting, /label=\"Ingresos totales\"/);
  assert.match(accounting, /label=\"Ingresos clínicos \/ servicios\"/);
  assert.match(accounting, /label=\"Utilidad de productos\"/);
  assert.match(accounting, /label=\"Margen de productos\"/);
  assert.match(accounting, /origin===\"product-sale\"/);
});
