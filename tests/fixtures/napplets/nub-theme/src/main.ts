/**
 * nub-theme fixture — minimal AUTH probe; theme.changed delivery driven by Layer-A spec (E2E-09).
 *
 * @napplet/sdk does NOT expose a theme namespace (only type re-exports — verified against
 * /home/sandwich/Develop/napplet/packages/sdk/src/index.ts). The fixture therefore performs
 * a storage AUTH probe to satisfy session registration; the Layer-A nub-theme.spec.ts
 * (Plan 21-03) drives theme behaviour via __injectEnvelope__ + __getNubMessage__ on the
 * fixture's windowId.
 *
 * Layer-A spec asserts:
 *   - #nub-status flips to 'authenticated' (proof AUTH completed and the fixture is loadable)
 *   - When spec injects a theme.changed envelope to the fixture window, the harness records
 *     it in envelopeLog and __getNubMessage__(windowId, 'theme.changed') returns it
 *   - Spec calls __injectEnvelope__(windowId, { type: 'theme.get', id: '...' }) to drive a
 *     theme.get round-trip; runtime fallback returns DEFAULT_THEME via theme.get.result
 *
 * Anti-features: NO raw window.addEventListener — fixture is OUTBOUND/AUTH-ONLY.
 */
import '@napplet/shim';
import { storage } from '@napplet/sdk';

const statusEl = document.getElementById('nub-status')!;

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

async function init(): Promise<void> {
  try {
    // First SDK call gates AUTH. storage.getItem is the cheapest probe.
    await storage.getItem('nub-theme-auth-probe');
  } catch {
    // state:read may be denied in some ACL configurations — that still proves AUTH completed
    // because the SDK proxy could resolve/reject, which only happens after shim handshake.
  }
  statusEl.textContent = 'authenticated';
}

init().catch((err) => {
  statusEl.textContent = `denied:${fmt(err, 'theme:auth-probe')}`;
});
