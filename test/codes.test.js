import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALPHABET, generateCode, normalizeCode } from '../src/codes.js';

test('gegenereerde codes hebben de vorm VIBE-XXXX-XXXX zonder verwarrende tekens', () => {
  for (let i = 0; i < 500; i++) {
    const code = generateCode();
    assert.match(code, /^VIBE-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    assert.equal(normalizeCode(code), code);
  }
  assert.ok(![...'01ILO'].some((ch) => ALPHABET.includes(ch)));
});

test('normalizeCode accepteert hoe mensen codes typen en plakken', () => {
  for (const input of ['VIBE-7K3M-Q9TD', 'vibe-7k3m-q9td', ' vibe 7k3m q9td ', 'VIBE7K3MQ9TD', '7K3M-Q9TD', '7k3m–q9td']) {
    assert.equal(normalizeCode(input), 'VIBE-7K3M-Q9TD', input);
  }
});

test('normalizeCode weigert wat geen code kan zijn', () => {
  for (const input of ['', 'VIBE', 'VIBE-7K3M-Q9T', 'VIBE-7K3M-Q9TDX', 'VIBE-0K3M-Q9TD', 'VIBE-IK3M-Q9TD', 'VIBE7K3M', null, 42]) {
    assert.equal(normalizeCode(input), null, String(input));
  }
});
