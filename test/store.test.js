import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InMemoryCodeStore } from '../src/store.js';

const anna = { name: 'Anna', email: 'anna@topicus.nl' };
const bram = { name: 'Bram', email: 'bram@topicus.nl' };
const cor = { name: 'Cor', email: 'cor@topicus.nl' };

test('onbekende code', async () => {
  const store = new InMemoryCodeStore();
  assert.deepEqual(await store.redeem({ code: 'VIBE-2222-2222', ...anna }), { status: 'unknown' });
});

test('een code geeft drie nieuwe codes en een toegangsaanvraag', async () => {
  const requests = [];
  const store = new InMemoryCodeStore({ demoCodes: ['VIBE-TEST-2345'], onAccessRequest: (r) => requests.push(r) });
  const result = await store.redeem({ code: 'VIBE-TEST-2345', ...anna });
  assert.equal(result.status, 'redeemed');
  assert.equal(new Set(result.invites).size, 3);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].email, anna.email);
  assert.equal(requests[0].invitedBy, null);
});

test('uitgegeven codes werken één keer en houden bij wie uitnodigde', async () => {
  const requests = [];
  const store = new InMemoryCodeStore({ demoCodes: ['VIBE-TEST-2345'], onAccessRequest: (r) => requests.push(r) });
  const { invites } = await store.redeem({ code: 'VIBE-TEST-2345', ...anna });

  assert.equal((await store.redeem({ code: invites[0], ...bram })).status, 'redeemed');
  assert.equal(requests.at(-1).invitedBy, anna.email);
  assert.deepEqual(await store.redeem({ code: invites[0], ...cor }), { status: 'used' });
});

test('democodes zijn herbruikbaar, voor iedereen een eigen set', async () => {
  const store = new InMemoryCodeStore({ demoCodes: ['VIBE-TEST-2345'] });
  const a = await store.redeem({ code: 'VIBE-TEST-2345', ...anna });
  const b = await store.redeem({ code: 'VIBE-TEST-2345', ...bram });
  assert.equal(b.status, 'redeemed');
  assert.notDeepEqual(a.invites, b.invites);
});

test('wie al lid is krijgt zijn eigen codes terug en verbruikt geen nieuwe code', async () => {
  const store = new InMemoryCodeStore({ demoCodes: ['VIBE-TEST-2345'] });
  const { invites } = await store.redeem({ code: 'VIBE-TEST-2345', ...anna });
  const { invites: bramInvites } = await store.redeem({ code: invites[0], ...bram });

  const again = await store.redeem({ code: invites[0], name: 'Bram', email: 'BRAM@topicus.nl' });
  assert.deepEqual(again, { status: 'member', invites: bramInvites, sameCode: true });

  const other = await store.redeem({ code: invites[1], ...bram });
  assert.deepEqual(other, { status: 'member', invites: bramInvites, sameCode: false });
  assert.equal((await store.redeem({ code: invites[1], ...cor })).status, 'redeemed');
});
