import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { normalizeCode } from './codes.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
    "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

// Mislukte pogingen (onbekende of gebruikte code) per IP, zodat codes niet te raden zijn.
const MAX_FAILED = 10;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_BODY = 4096;

const MESSAGES = {
  codeMissing: 'Vul je invitecode in.',
  codeFormat:
    'Deze code klopt niet. Een code ziet eruit als VIBE-7K3M-Q9TD. ' +
    'De letters O, I en L en de cijfers 0 en 1 komen er niet in voor.',
  codeUnknown: 'Deze code kennen we niet. Kijk of je hem goed hebt overgenomen.',
  codeUsed: 'Deze code is al gebruikt. Vraag de collega die hem gaf om een andere code.',
  nameMissing: 'Vul je naam in.',
  nameLong: 'Je naam mag maximaal 100 tekens zijn.',
  emailMissing: 'Vul je e-mailadres in.',
  emailFormat: 'Vul een geldig e-mailadres in, zoals naam@topicus.nl.',
  tooMany: 'Je hebt te vaak een onjuiste code ingevuld. Probeer het over 15 minuten opnieuw.',
  badRequest: 'Er ging iets mis met je aanvraag. Laad de pagina opnieuw en probeer het nog eens.',
};

function loadStatic(dir) {
  const files = new Map();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const body = readFileSync(full);
      const ext = extname(entry.name);
      files.set('/' + relative(dir, full).split(sep).join('/'), {
        body,
        type: TYPES[ext] ?? 'application/octet-stream',
        etag: '"' + createHash('sha256').update(body).digest('base64url').slice(0, 16) + '"',
        cache: ext === '.woff2' ? 'public, max-age=31536000, immutable' : ext === '.png' ? 'public, max-age=86400' : 'no-cache',
      });
    }
  };
  walk(dir);
  return files;
}

function validate(body) {
  const errors = [];
  const rawCode = typeof body.code === 'string' ? body.code.trim() : '';
  const code = normalizeCode(rawCode);
  if (!rawCode) errors.push({ field: 'code', message: MESSAGES.codeMissing });
  else if (!code) errors.push({ field: 'code', message: MESSAGES.codeFormat });

  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) errors.push({ field: 'name', message: MESSAGES.nameMissing });
  else if (name.length > 100) errors.push({ field: 'name', message: MESSAGES.nameLong });

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) errors.push({ field: 'email', message: MESSAGES.emailMissing });
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: MESSAGES.emailFormat });
  }
  return { errors, value: { code, name, email } };
}

export function createApp({ store, publicDir, now = () => Date.now() }) {
  const files = loadStatic(publicDir);
  const failures = new Map(); // ip -> { count, resetAt }

  const clientIp = (req) =>
    req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'onbekend';

  function isBlocked(ip) {
    const f = failures.get(ip);
    if (!f) return false;
    if (f.resetAt <= now()) { failures.delete(ip); return false; }
    return f.count >= MAX_FAILED;
  }

  function recordFailure(ip) {
    if (failures.size > 10_000) {
      for (const [k, f] of failures) if (f.resetAt <= now()) failures.delete(k);
    }
    const f = failures.get(ip);
    if (f && f.resetAt > now()) f.count++;
    else failures.set(ip, { count: 1, resetAt: now() + WINDOW_MS });
  }

  function send(res, status, headers, body) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  }

  function json(res, status, data, extra = {}) {
    send(res, status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
      JSON.stringify(data));
  }

  const fail = (res, status, field, message, extra) => json(res, status, { errors: [{ field, message }] }, extra);

  async function readJson(req) {
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return null;
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) return null;
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async function redeem(req, res) {
    const ip = clientIp(req);
    if (isBlocked(ip)) return fail(res, 429, null, MESSAGES.tooMany, { 'Retry-After': String(WINDOW_MS / 1000) });

    const body = await readJson(req);
    if (!body) return fail(res, 400, null, MESSAGES.badRequest);

    const { errors, value } = validate(body);
    if (errors.length) return json(res, 422, { errors });

    const result = await store.redeem(value);
    switch (result.status) {
      case 'unknown':
        recordFailure(ip);
        return fail(res, 404, 'code', MESSAGES.codeUnknown);
      case 'used':
        recordFailure(ip);
        return fail(res, 409, 'code', MESSAGES.codeUsed);
      case 'redeemed':
        return json(res, 201, { status: 'redeemed', code: value.code, email: value.email, invites: result.invites });
      case 'member':
        return json(res, 200, {
          status: 'member', code: value.code, sameCode: result.sameCode, email: value.email, invites: result.invites,
        });
    }
  }

  function serveStatic(req, res, path) {
    const file = files.get(path === '/' ? '/index.html' : path);
    if (!file) {
      const page = files.get('/404.html');
      return send(res, 404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' },
        req.method === 'HEAD' ? undefined : page?.body ?? 'Niet gevonden');
    }
    const headers = { 'Content-Type': file.type, 'Cache-Control': file.cache, ETag: file.etag };
    if (req.headers['if-none-match'] === file.etag) return send(res, 304, headers);
    send(res, 200, { ...headers, 'Content-Length': file.body.length }, req.method === 'HEAD' ? undefined : file.body);
  }

  return async function handle(req, res) {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;

      if (path === '/healthz') return json(res, 200, { ok: true, store: store.describe().kind });
      if (path === '/api/status') {
        const { kind, demoCodes } = store.describe();
        return json(res, 200, { store: kind, demoCode: demoCodes[0] ?? null });
      }
      if (path === '/api/redeem') {
        if (req.method !== 'POST') return fail(res, 405, null, MESSAGES.badRequest, { Allow: 'POST' });
        return await redeem(req, res);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, { Allow: 'GET, HEAD', 'Content-Type': TYPES['.txt'] }, 'Methode niet toegestaan');
      }
      serveStatic(req, res, path);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) fail(res, 500, null, MESSAGES.badRequest);
      else res.destroy();
    }
  };
}
