/**
 * Profile Viewer demo napplet — exercises identityGetPublicKey + identityGetProfile (NAP-07, Phase 20).
 *
 * Per CONTEXT D-03:
 *   - On init: identityGetPublicKey() populates #profile-pubkey (truncated to 8...4 chars)
 *   - Then: identityGetProfile() populates #profile-name, #profile-about, #profile-picture (if returned)
 *   - #profile-status sentinel contract: 'connecting...' (HTML default) -> 'authenticated' ->
 *     'loaded' on success, or 'denied: <reason>' on ACL denial
 *
 * Anti-features (per v1.3 milestone): no raw message protocol listener, no NIP-01 arrays,
 *   no legacy bus enums, no global nostr accessor, no signer-service, no BusKind.
 *   Anti-feature surface unchanged — AUTHENTICATED fires from shim bootstrap.
 */
import '@napplet/shim';
import { identityGetProfile, identityGetPublicKey } from '@napplet/nub/identity/sdk';

const statusEl = document.getElementById('profile-status')!;
const pubkeyEl = document.getElementById('profile-pubkey')!;
const nameEl   = document.getElementById('profile-name')!;
const aboutEl  = document.getElementById('profile-about')!;
const pictureEl = document.getElementById('profile-picture') as HTMLImageElement;
const logEl = document.getElementById('profile-log')!;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'profile-log-entry';
  const time = new Date().toLocaleTimeString('en', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

function truncatePubkey(pubkey: string): string {
  if (pubkey === '') return 'no-pubkey';
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

async function loadIdentity(): Promise<void> {
  // Load identity: flip status to 'authenticated' then fetch pubkey + profile.
  setStatus('authenticated', 'green');
  log('reading identity');

  // Step B (getPublicKey): read caller's public key
  let pubkey = '';
  try {
    pubkey = await identityGetPublicKey();
    pubkeyEl.textContent = truncatePubkey(pubkey);
    log(`identity.getPublicKey — ${truncatePubkey(pubkey)}`);
  } catch (err) {
    const reason = formatError(err, 'denied: identity:read');
    setStatus(`denied: ${reason}`, 'red');
    log(`identity.getPublicKey failed — ${reason}`);
    throw err;
  }

  // Step C (getProfile): fetch kind:0 metadata; may return null when no metadata is known
  try {
    const profile = await identityGetProfile();
    if (profile) {
      if (profile.name) nameEl.textContent = profile.name;
      else if (profile.displayName) nameEl.textContent = profile.displayName;
      if (profile.about) aboutEl.textContent = profile.about;
      if (profile.picture) {
        pictureEl.src = profile.picture;
        pictureEl.style.display = '';
      }
      log(`identity.getProfile — ${profile.name ?? profile.displayName ?? '(no name)'}`);
    } else {
      log('identity.getProfile — null (no metadata)');
    }
    setStatus('loaded', 'green');
  } catch (err) {
    const reason = formatError(err, 'denied: identity:read (profile)');
    setStatus(`denied: ${reason}`, 'red');
    log(`identity.getProfile failed — ${reason}`);
  }
}

loadIdentity().catch((err) => {
  if (statusEl.textContent === 'connecting...') {
    setStatus('auth failed', 'red');
    log(`init failed — ${formatError(err, 'auth/identity failure')}`);
  }
});
