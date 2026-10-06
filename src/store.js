import { generateCode } from './codes.js';

export const INVITES_PER_MEMBER = 3;

/**
 * STUB — vervangt de database tot die er is. Alles staat in het geheugen en is na een
 * herstart weg. Een echte implementatie levert dezelfde `redeem` en `describe` en moet
 * `redeem` in één transactie doen (code claimen + lid aanmaken + nieuwe codes uitgeven).
 *
 * redeem({ code, name, email }) geeft een van:
 *   { status: 'unknown' }                       code bestaat niet
 *   { status: 'used' }                          code is al door iemand anders gebruikt
 *   { status: 'redeemed', invites }             nieuw lid; invites zijn vers uitgegeven
 *   { status: 'member', invites, sameCode }     e-mailadres had al toegang; de ingevoerde
 *                                               code is dan níet verbruikt (tenzij sameCode)
 */
export class InMemoryCodeStore {
  #codes = new Map();   // code -> { issuedBy: email|null, redeemedBy: email|null, demo: bool }
  #members = new Map(); // email (lowercase) -> { name, email, code, invitedBy, invites, at }
  #onAccessRequest;

  constructor({ demoCodes = [], onAccessRequest = () => {} } = {}) {
    for (const code of demoCodes) this.#codes.set(code, { issuedBy: null, redeemedBy: null, demo: true });
    this.#onAccessRequest = onAccessRequest;
  }

  describe() {
    return { kind: 'stub', demoCodes: [...this.#codes].filter(([, c]) => c.demo).map(([code]) => code) };
  }

  async redeem({ code, name, email }) {
    const entry = this.#codes.get(code);
    if (!entry) return { status: 'unknown' };

    const key = email.toLowerCase();
    const member = this.#members.get(key);
    if (member) return { status: 'member', invites: member.invites, sameCode: member.code === code };

    // Democodes zijn herbruikbaar, zodat iedereen de flow kan proberen.
    if (entry.redeemedBy && !entry.demo) return { status: 'used' };

    if (!entry.demo) entry.redeemedBy = key;
    const invites = [];
    while (invites.length < INVITES_PER_MEMBER) {
      const fresh = generateCode();
      if (this.#codes.has(fresh)) continue;
      this.#codes.set(fresh, { issuedBy: key, redeemedBy: null, demo: false });
      invites.push(fresh);
    }
    const request = { name, email, code, invitedBy: entry.issuedBy, invites, at: new Date().toISOString() };
    this.#members.set(key, request);
    this.#onAccessRequest(request);
    return { status: 'redeemed', invites };
  }
}
