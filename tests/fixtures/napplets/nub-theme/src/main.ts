/**
 * nub-theme fixture — minimal readiness probe; theme.changed delivery driven by Layer-A spec (E2E-09).
 *
 * The helper surface does not expose a theme readiness probe. The fixture therefore performs
 * a storage readiness probe to satisfy session registration; the Layer-A nub-theme.spec.ts
 * (Plan 21-03) drives theme behaviour via __injectEnvelope__ + __getNubMessage__ on the
 * fixture's windowId.
 *
 * Layer-A spec asserts:
 *   - #nub-status flips to 'ready' (proof the fixture is loadable)
 *   - When spec injects a theme.changed envelope to the fixture window, the harness records
 *     it in envelopeLog and __getNubMessage__(windowId, 'theme.changed') returns it
 *   - Spec calls __injectEnvelope__(windowId, { type: 'theme.get', id: '...' }) to drive a
 *     theme.get round-trip; runtime fallback returns DEFAULT_THEME via theme.get.result
 *
 * Anti-features: NO raw window.addEventListener — fixture is outbound-only.
 */
import '@napplet/shim';
import { storageGetItem } from '@napplet/nap/storage/sdk';

const statusEl = document.getElementById('nub-status')!;

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

async function init(): Promise<void> {
  try {
    // First SDK call gates readiness. storageGetItem is the cheapest probe.
    await storageGetItem('nub-theme-readiness-probe');
  } catch {
    // state:read may be denied in some ACL configurations -- that still proves readiness
    // because the SDK proxy could resolve/reject, which only happens after shim handshake.
  }
  statusEl.textContent = 'ready';
}

init().catch((err) => {
  statusEl.textContent = `denied:${fmt(err, 'theme:readiness-probe')}`;
});
