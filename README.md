# vibe-invite

Onepager in Topicus-huisstijl waar je een invitecode (activatiecode) invult om toegang aan te
vragen tot het **Education Vibe Cluster**. Wie een geldige code invult, krijgt direct drie nieuwe
codes om door te geven aan collega's. De beheerders regelen daarna de echte toegang.

Live: https://vibe-invite.hetzner.bobreijnders.nl

## Opbouw

| Pad | Wat |
| --- | --- |
| `server.js` | start de HTTP-server (Node ≥ 22, geen dependencies) |
| `src/app.js` | routes, validatie, rate limiting, security-headers |
| `src/store.js` | **stub** van de database: alles in het geheugen, weg na een herstart |
| `src/codes.js` | codes maken en normaliseren (`VIBE-XXXX-XXXX`, zonder 0/O/1/I/L) |
| `public/` | de pagina zelf: HTML, CSS, JS, Montserrat, favicon |
| `test/` | `npm test` (node:test) |

### API

- `POST /api/redeem` `{ code, name, email }` →
  `201 { status: 'redeemed', invites: [3 codes] }`,
  `200 { status: 'member', sameCode, invites }` (dit e-mailadres had al toegang; de code is niet verbruikt),
  `422/404/409 { errors: [{ field, message }] }`, `429` na 10 onjuiste codes per IP per 15 minuten.
- `GET /api/status` → `{ store: 'stub', demoCode }`. De pagina toont dan een testbanner.
- `GET /healthz`

### De stub vervangen door een database

Implementeer `redeem({ code, name, email })` en `describe()` uit `src/store.js` op een echte
opslag, in één transactie (code claimen, lid aanmaken, drie codes uitgeven), en geef die store mee
in `server.js`. Toegangsaanvragen gaan nu als JSON-regel `{"event":"access_request",...}` naar
stdout; daar lezen de beheerders ze voorlopig uit (`app_logs(app="vibe-invite")`).

`DEMO_CODES` (komma-gescheiden, standaard `VIBE-TEST-2345`) zijn herbruikbare testcodes. Zet hem
leeg (`DEMO_CODES=""`) om ze uit te zetten; dan verdwijnt ook de testbanner.

## Lokaal

```bash
npm start          # http://localhost:8080
npm test
```

## Uitrollen

Geen buildstap: de container draait de bronbestanden zoals ze hier staan.

```
run_app(project_dir="/home/botrey/projects/vibe-invite", app="vibe-invite", kind="node", rebuild=true)
```

Verifiëren: `curl -fsS https://vibe-invite.hetzner.bobreijnders.nl/ | diff - public/index.html`
(en idem voor `/styles.css` en `/app.js`).

## Toegankelijkheid

Doel is WCAG 2.2 niveau AAA: contrast ≥ 7:1, focus altijd zichtbaar (3px), klikdoelen ≥ 44×44,
foutoverzicht met links naar de velden, statusmeldingen via `role="status"`, begrippenlijst voor
ongewone woorden, geen tijdslimieten, reflow tot 320px en respect voor `prefers-reduced-motion`
en `forced-colors`.
