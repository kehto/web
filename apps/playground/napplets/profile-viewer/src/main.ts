/**
 * Profile viewer napplet - receives published profile intents and loads kind 0 metadata.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { incOn } from '@napplet/nap/inc/sdk';
import { relaySubscribe } from '@napplet/nap/relay/sdk';
import { resourceBytes } from '@napplet/nap/resource/sdk';
import type { IncEvent, NostrEvent, Subscription } from '@napplet/core';
import { createProfileMediaController } from './profile-media.js';
import { createProfileLoadController } from './profile-load-controller.js';

const REQUIRED_NAPS = ['inc', 'relay', 'resource', 'theme'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const PROFILE_LOAD_TIMEOUT_MS = 8_000;

const statusEl = document.getElementById('profile-status')!;
const pubkeyEl = document.getElementById('profile-pubkey')!;
const nameEl = document.getElementById('profile-name')!;
const aboutEl = document.getElementById('profile-about')!;
const pictureEl = document.getElementById('profile-picture') as HTMLImageElement;
const bannerEl = document.getElementById('profile-banner') as HTMLImageElement;
const detailEl = document.getElementById('profile-details')!;
const profileMedia = createProfileMediaController({ loadBytes: resourceBytes });

pictureEl.addEventListener('error', () => profileMedia.handleError(pictureEl));
bannerEl.addEventListener('error', () => profileMedia.handleError(bannerEl));

type ProfileMetadata = {
  name?: string;
  display_name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
};

let profileIntentSub: Subscription | null = null;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingNapDomains(REQUIRED_NAPS);
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingNapDomains(REQUIRED_NAPS);
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
      banner: optionalString(data.banner),
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

function getProfileMedia(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
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

  const picture = getProfileMedia(profile?.picture);
  if (picture) {
    pictureEl.alt = `${displayName} profile picture`;
    pictureEl.style.display = '';
    void profileMedia.load(picture, pictureEl);
  } else {
    profileMedia.clear(pictureEl);
    pictureEl.alt = 'profile';
    pictureEl.style.display = 'none';
  }

  const banner = getProfileMedia(profile?.banner);
  if (banner) {
    bannerEl.alt = `${displayName} profile banner`;
    bannerEl.style.display = '';
    void profileMedia.load(banner, bannerEl);
  } else {
    profileMedia.clear(bannerEl);
    bannerEl.alt = 'profile banner';
    bannerEl.style.display = 'none';
  }

  setStatus(profile ? 'loaded' : 'not found', profile ? 'green' : 'gray');
}

function clearProfileView(): void {
  profileMedia.clear(pictureEl);
  pictureEl.alt = 'profile';
  pictureEl.style.display = 'none';
  profileMedia.clear(bannerEl);
  bannerEl.alt = 'profile banner';
  bannerEl.style.display = 'none';
  pubkeyEl.textContent = '';
  nameEl.textContent = '';
  aboutEl.textContent = 'Select a profile from the feed.';
  detailEl.replaceChildren();
}

const profileLoader = createProfileLoadController<NostrEvent>({
  timeoutMs: PROFILE_LOAD_TIMEOUT_MS,
  subscribe(pubkey, onEvent, onComplete) {
    let latest: NostrEvent | null = null;
    return relaySubscribe(
      [{ kinds: [0], authors: [pubkey], limit: 1 }],
      (event) => {
        if (event.kind !== 0 || event.pubkey !== pubkey) return;
        if (latest && latest.created_at > event.created_at) return;
        latest = event;
        onEvent(event);
      },
      onComplete,
    );
  },
  setTimeout: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
  clearTimeout: (timer) => window.clearTimeout(timer),
  onStart(pubkey) {
    clearProfileView();
    pubkeyEl.textContent = pubkey;
    setStatus('loading', 'gray');
  },
  onEvent(pubkey, event) {
    renderProfile(pubkey, parseProfile(event));
  },
  onEmpty(pubkey) {
    renderProfile(pubkey, null);
  },
});

function clearProfile(): void {
  profileLoader.clear();
  clearProfileView();
}

function loadProfile(pubkey: string): void {
  profileLoader.load(pubkey);
}

function payloadPubkey(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  return normalizePubkey((payload as { pubkey?: unknown }).pubkey);
}

function subscribeToProfileDelivery(): void {
  profileIntentSub = incOn('napplet:profile/open', (event: IncEvent) => {
    const pubkey = payloadPubkey(event.payload);
    if (!pubkey) return;
    loadProfile(pubkey);
  });
}

async function init(): Promise<void> {
  installNapTheme();
  onNapThemeChanged((theme) => {
    applyNapTheme(theme);
  });
  subscribeToProfileDelivery();
  await waitForRequiredNaps();
  clearProfile();
  setStatus('waiting', 'gray');
}

init().catch((err) => {
  if (statusEl.textContent === 'connecting...') {
    setStatus(`denied: ${formatError(err, 'inc, relay, or resource unavailable')}`, 'red');
  }
});

window.addEventListener('pagehide', () => {
  profileLoader.clear();
  profileIntentSub?.close();
  profileMedia.destroy();
});
