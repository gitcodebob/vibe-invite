import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

const section = html.match(/<section[^>]*id=["']ideeen["'][\s\S]*?<\/section>/)?.[0];
assert.ok(section, 'sectie #ideeen niet gevonden in index.html');

const cards = section.match(/<li\b[^>]*class="[^"]*\bidea\b/g) ?? [];
const arts = [...section.matchAll(/<div class="idea__art idea__art--([a-z-]+)"[^>]*>((?:<i><\/i>)*)<\/div>/g)]
  .map(([, name, blocks]) => ({ name, blocks: blocks.length / '<i></i>'.length }));
const styled = [...new Set([...css.matchAll(/\.idea__art--([a-z-]+)/g)].map((m) => m[1]))];

test('elke ideekaart heeft een eigen illustratie, zodat twee kaarten nooit hetzelfde plaatje delen', () => {
  assert.ok(cards.length > 0, 'geen ideekaarten gevonden');
  assert.equal(arts.length, cards.length);
  assert.deepEqual(arts.map((a) => a.name), [...new Set(arts.map((a) => a.name))]);
});

test('elke illustratie in de ideeën heeft CSS, en er blijft geen CSS over voor verdwenen illustraties', () => {
  assert.deepEqual(arts.map((a) => a.name).sort(), [...styled].sort());
});

test('de CSS stuurt geen blokjes aan die de illustratie niet heeft', () => {
  for (const { name, blocks } of arts) {
    const used = [...css.matchAll(new RegExp(`\\.idea__art--${name} i:nth-child\\((\\d+)\\)`, 'g'))].map((m) => Number(m[1]));
    assert.ok(Math.max(0, ...used) <= blocks, `${name}: CSS gebruikt nth-child(${Math.max(...used)}), maar er zijn ${blocks} <i>`);
  }
});
