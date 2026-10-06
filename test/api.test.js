import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { InMemoryCodeStore } from '../src/store.js';

let server;
let base;

before(async () => {
  const store = new InMemoryCodeStore({ demoCodes: ['VIBE-TEST-2345'] });
  const publicDir = fileURLToPath(new URL('../public', import.meta.url));
  server = createServer(createApp({ store, publicDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const redeem = (body, headers = {}) =>
  fetch(`${base}/api/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('de pagina en de bestanden worden geserveerd met security-headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await res.text(), /lang="nl"/);
  for (const path of ['/styles.css', '/app.js', '/motion.js', '/js-flag.js', '/favicon.svg', '/og.png', '/fonts/montserrat-latin.woff2']) {
    assert.equal((await fetch(`${base}${path}`)).status, 200, path);
  }
  assert.equal((await fetch(`${base}/../server.js`)).status, 404);
  assert.equal((await fetch(`${base}/bestaat-niet`)).status, 404);
});

test('status meldt de stub en de democode', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/status`)).json(), { store: 'stub', demoCode: 'VIBE-TEST-2345' });
});

test('lege velden geven per veld een foutmelding', async () => {
  const res = await redeem({});
  assert.equal(res.status, 422);
  const { errors } = await res.json();
  assert.deepEqual(errors.map((e) => e.field), ['code', 'name', 'email']);
});

test('een geldige code geeft drie invitecodes, ook als hij slordig is getypt', async () => {
  const res = await redeem({ code: ' vibe test 2345 ', name: ' Anna ', email: 'anna@topicus.nl' });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, 'redeemed');
  assert.equal(data.code, 'VIBE-TEST-2345');
  assert.equal(data.invites.length, 3);

  const reuse = await redeem({ code: data.invites[0], name: 'Bram', email: 'bram@topicus.nl' });
  assert.equal(reuse.status, 201);
  const used = await redeem({ code: data.invites[0], name: 'Cor', email: 'cor@topicus.nl' });
  assert.equal(used.status, 409);
  assert.equal((await used.json()).errors[0].field, 'code');
});

test('na te veel onjuiste codes volgt een 429', async () => {
  const ip = { 'X-Forwarded-For': '203.0.113.9' };
  for (let i = 0; i < 10; i++) {
    assert.equal((await redeem({ code: 'VIBE-2222-2222', name: 'X', email: 'x@topicus.nl' }, ip)).status, 404);
  }
  const blocked = await redeem({ code: 'VIBE-TEST-2345', name: 'X', email: 'x@topicus.nl' }, ip);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
});

test('geen JSON of te groot is een 400', async () => {
  const res = await fetch(`${base}/api/redeem`, { method: 'POST', body: 'code=x' });
  assert.equal(res.status, 400);
  assert.equal((await redeem({ code: 'x'.repeat(5000) })).status, 400);
  assert.equal((await fetch(`${base}/api/redeem`)).status, 405);
});
