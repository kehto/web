/**
 * nub-identity fixture — exercises identity.getPublicKey + identity.getProfile (E2E-09).
 *
 * Layer-A spec drives this fixture via window.__loadNapplet__('nub-identity') from
 * tests/e2e/nub-identity.spec.ts. Spec asserts:
 *   - #nub-status flips to 'authenticated' then to 'pubkey:<truncated>' or 'denied:*'
 *   - #nub-pubkey contains a truncated hex pubkey OR 'no-pubkey' sentinel
 *   - The harness's __getNubMessage__(windowId, 'identity.getPublicKey') returns a
 *     non-null envelope after fixture init (proves the request was dispatched)
 *
 * Anti-features (hard-enforced): NO raw window.addEventListener, NO NIP-01 arrays,
 *   NO raw postMessage, NO NIP-01 envelopes, NO bus-kind references, NO signer service.
 */
import '@napplet/shim';
import { identity } from '@napplet/sdk';

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
    // First SDK call gates AUTH. Runtime fallback returns
    // { type: 'identity.getPublicKey.error', error: 'no signer configured' } when
    // no signer is wired in the harness — we treat that as a successful AUTH because
    // the await rejects with the error message, proving the envelope round-tripped.
    const pubkey = await identity.getPublicKey();
    statusEl.textContent = 'authenticated';
    pubkeyEl.textContent = truncate(pubkey);

    try {
      const profile = await identity.getProfile();
      profileNameEl.textContent = profile?.name ?? '';
    } catch {
      // identity.getProfile is allowed to fail without poisoning the spec — its purpose
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
