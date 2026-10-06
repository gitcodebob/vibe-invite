import { randomInt } from 'node:crypto';

// Geen 0/O en geen 1/I/L: die lees je makkelijk verkeerd van een scherm of briefje.
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PREFIX = 'VIBE';
const BODY_LENGTH = 8;

function format(body) {
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

// 8 tekens uit 31 is ~40 bits: niet te raden binnen de rate limit van de API.
export function generateCode() {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  return format(body);
}

// Maakt van wat iemand typt of plakt de vorm VIBE-XXXX-XXXX, of null als het geen code
// kan zijn. Hoofdletters, spaties, streepjes en het voorvoegsel zijn optioneel.
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  let body = input.toUpperCase().replace(/[\s\-‐–—_.]/g, '');
  if (body.length === PREFIX.length + BODY_LENGTH && body.startsWith(PREFIX)) {
    body = body.slice(PREFIX.length);
  }
  if (body.length !== BODY_LENGTH) return null;
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;
  return format(body);
}
