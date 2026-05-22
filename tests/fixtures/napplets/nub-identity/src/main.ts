/**
 * nub-identity fixture — exercises identityGetPublicKey + identityGetProfile (E2E-09).
 * Rebuild: shim updated to route identity.*.error messages (Phase 21-03).
 *
 * Layer-A spec drives this fixture via window.__loadNapplet__('nub-identity') from
 * tests/e2e/nub-identity.spec.ts. Spec asserts:
 *   - #nub-status flips to 'authenticated' then to 'pubkey:<truncated>'
 *   - #nub-pubkey contains a truncated hex pubkey
 *   - The harness's __getNubMessage__(windowId, 'identity.getPublicKey') returns a
 *     non-null envelope after fixture init (proves the request was dispatched)
 *
 * Anti-features (hard-enforced): NO raw window.addEventListener, NO NIP-01 arrays,
 *   NO raw postMessage, NO NIP-01 envelopes, NO bus-kind references, NO signer service.
 */
import '@napplet/shim';
import { identityGetProfile, identityGetPublicKey } from '@napplet/nub/identity/sdk';

const statusEl = document.getElementById('nub-status')!;
const pubkeyEl = document.getElementById('nub-pubkey')!;
const profileNameEl = document.getElementById('nub-profile-name')!;

function fmt(err: unknown, fb: string): string {
  return err instanceof Error && err.message ? err.message : (typeof err === 'string' && err.length > 0 ? err : fb);
}

function truncate(pk: string): string {
  if (!pk || pk.length === 0) return 'no-pubkey';
  return `${pk.slice(0, 8)}...${pk.slice(-4)}`;
}

async function init(): Promise<void> {
  try {
    // First SDK call gates AUTH. The E2E harness wires a deterministic signer
    // because @napplet/nub@0.3.0 resolves this helper through result envelopes.
    const pubkey = await identityGetPublicKey();
    statusEl.textContent = 'authenticated';
    pubkeyEl.textContent = truncate(pubkey);

    try {
      const profile = await identityGetProfile();
      profileNameEl.textContent = profile?.name ?? '';
    } catch {
      // identityGetProfile is allowed to fail without poisoning the spec — its purpose
      // is only to demonstrate a second envelope dispatch. Spec does not assert profile content.
    }

    statusEl.textContent = `pubkey:${truncate(pubkey)}`;
  } catch (err) {
    // No signer / denial — still proof of AUTH + envelope round-trip.
    statusEl.textContent = `denied:${fmt(err, 'identity:read')}`;
    pubkeyEl.textContent = 'no-pubkey';
  }
}

void init();
