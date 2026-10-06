import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';
import { InMemoryCodeStore } from './src/store.js';

// Democodes werken onbeperkt zolang de stub draait. Zet DEMO_CODES="" om ze uit te zetten.
const demoCodes = (process.env.DEMO_CODES ?? 'VIBE-TEST-2345').split(',').map((c) => c.trim()).filter(Boolean);

const store = new InMemoryCodeStore({
  demoCodes,
  // Tot er een database en beheerscherm is, lezen de beheerders aanvragen uit de logs.
  onAccessRequest: (request) => console.log(JSON.stringify({ event: 'access_request', ...request })),
});

const handle = createApp({ store, publicDir: fileURLToPath(new URL('./public', import.meta.url)) });
const port = Number(process.env.PORT ?? 8080);
const server = createServer(handle).listen(port, '0.0.0.0', () => {
  console.log(`vibe-invite luistert op :${port} (store: ${store.describe().kind})`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
