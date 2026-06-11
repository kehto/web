/**
 * Profile viewer napplet - consumes NAP-01 profile:open events and loads kind 0 metadata.
 */
import '@napplet/shim';
import { installNapTheme } from '../../shared-theme';
import { ifcOn } from '@napplet/nap/ifc/sdk';
import { relaySubscribe } from '@napplet/nap/relay/sdk';
import type { NostrEvent, Subscription } from '@napplet/core';

const REQUIRED_NAPS = ['ifc', 'relay', 'theme'] as const;
const REQUIRED_IFC_PROTOCOL = 'ifc:NAP-01';
const CAPABILITY_WAIT_MS = 1_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const PROFILE_LOAD_TIMEOUT_MS = 8_000;

const statusEl = document.getElementById('profile-status')!;
const pubkeyEl = document.getElementById('profile-pubkey')!;
const nameEl = document.getElementById('profile-name')!;
const aboutEl = document.getElementById('profile-about')!;
const pictureEl = document.getElementById('profile-picture') as HTMLImageElement;
const detailEl = document.getElementById('profile-details')!;
const logEl = document.getElementById('profile-log')!;

type ProfileMetadata = {
  name?: string;
  display_name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud16?: string;
};

let profileSub: Subscription | null = null;
let ifcSub: Subscription | null = null;
let profileLoadTimer: number | null = null;

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

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports;
  return [
    ...REQUIRED_NAPS.filter((capability) => !supports(capability)),
    ...(!supports(REQUIRED_IFC_PROTOCOL) ? [REQUIRED_IFC_PROTOCOL] : []),
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingRequiredNaps();
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingRequiredNaps();
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

function normalizePubkey(pubkey: unknown): string | null {
  if (typeof pubkey !== 'string') return null;
  const normalized = pubkey.toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function truncatePubkey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseProfile(event: NostrEvent): ProfileMetadata | null {
  if (event.kind !== 0) return null;

  try {
    const data = JSON.parse(event.content) as Record<string, unknown>;
    return {
      name: optionalString(data.name),
      display_name: optionalString(data.display_name),
      displayName: optionalString(data.displayName),
      about: optionalString(data.about),
      picture: optionalString(data.picture),
      nip05: optionalString(data.nip05),
      lud16: optionalString(data.lud16),
    };
  } catch {
    return null;
  }
}

function getDisplayName(profile: ProfileMetadata | null, pubkey: string): string {
  return profile?.display_name ?? profile?.displayName ?? profile?.name ?? truncatePubkey(pubkey);
}

function getProfilePicture(profile: ProfileMetadata | null): string | null {
  if (!profile?.picture) return null;
  try {
    const url = new URL(profile.picture);
    return url.protocol === 'http:' || url.protocol === 'https:' ? profile.picture : null;
  } catch {
    return null;
  }
}

function renderDetails(profile: ProfileMetadata | null): void {
  detailEl.replaceChildren();
  const details: Array<[string, string | undefined]> = [
    ['nip05', profile?.nip05],
    ['lud16', profile?.lud16],
  ];

  for (const [label, value] of details) {
    if (value === undefined) continue;
    const row = document.createElement('div');
    row.className = 'profile-detail-row';
    const keyEl = document.createElement('span');
    keyEl.className = 'profile-detail-label';
    keyEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'profile-detail-value';
    valueEl.textContent = value;
    row.append(keyEl, valueEl);
    detailEl.appendChild(row);
  }
}

function renderProfile(pubkey: string, profile: ProfileMetadata | null): void {
  const displayName = getDisplayName(profile, pubkey);
  pubkeyEl.textContent = pubkey;
  nameEl.textContent = displayName;
  aboutEl.textContent = profile?.about ?? 'No profile metadata found.';
  renderDetails(profile);

  const picture = getProfilePicture(profile);
  if (picture) {
    pictureEl.src = picture;
    pictureEl.alt = `${displayName} profile picture`;
    pictureEl.style.display = '';
  } else {
    pictureEl.removeAttribute('src');
    pictureEl.alt = 'profile';
    pictureEl.style.display = 'none';
  }

  setStatus(profile ? 'loaded' : 'not found', profile ? 'green' : 'gray');
}

function clearProfileLoadTimer(): void {
  if (profileLoadTimer !== null) {
    window.clearTimeout(profileLoadTimer);
    profileLoadTimer = null;
  }
}

function clearProfile(): void {
  profileSub?.close();
  profileSub = null;
  clearProfileLoadTimer();
  pictureEl.removeAttribute('src');
  pictureEl.alt = 'profile';
  pictureEl.style.display = 'none';
  pubkeyEl.textContent = '';
  nameEl.textContent = '';
  aboutEl.textContent = 'Select a profile from the feed.';
  detailEl.replaceChildren();
}

function loadProfile(pubkey: string): void {
  clearProfile();
  pubkeyEl.textContent = pubkey;
  setStatus('loading', 'gray');
  log(`profile:open received -- ${truncatePubkey(pubkey)}`);

  let latest: NostrEvent | null = null;
  let done = false;
  let sub: Subscription | null = null;
  const finish = (reason: 'complete' | 'timeout') => {
    if (done) return;
    done = true;
    clearProfileLoadTimer();
    if (!latest) renderProfile(pubkey, null);
    log(`relay.subscribe profile metadata ${reason} -- ${truncatePubkey(pubkey)}`);
    sub?.close();
    if (profileSub === sub) profileSub = null;
  };

  profileLoadTimer = window.setTimeout(() => finish('timeout'), PROFILE_LOAD_TIMEOUT_MS);
  sub = relaySubscribe(
    [{ kinds: [0], authors: [pubkey], limit: 1 }],
    (event) => {
      if (done) return;
      if (event.kind !== 0 || event.pubkey !== pubkey) return;
      if (latest && latest.created_at > event.created_at) return;
      latest = event;
      renderProfile(pubkey, parseProfile(event));
    },
    () => finish('complete'),
  );
  profileSub = sub;
}

function payloadPubkey(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  return normalizePubkey((payload as { pubkey?: unknown }).pubkey);
}

function subscribeToProfileOpen(): void {
  ifcSub = ifcOn('profile:open', (payload) => {
    const pubkey = payloadPubkey(payload);
    if (!pubkey) {
      log('profile:open ignored -- invalid payload');
      return;
    }
    loadProfile(pubkey);
  });
}

async function init(): Promise<void> {
  installNapTheme();
  await waitForRequiredNaps();
  clearProfile();
  subscribeToProfileOpen();
  setStatus('waiting', 'gray');
  log('listening for profile:open');
}

init().catch((err) => {
  if (statusEl.textContent === 'connecting...') {
    setStatus('unavailable', 'red');
  }
  log(`init failed -- ${formatError(err, 'NAP-01 profile open failure')}`);
});

window.addEventListener('pagehide', () => {
  clearProfileLoadTimer();
  profileSub?.close();
  ifcSub?.close();
});
