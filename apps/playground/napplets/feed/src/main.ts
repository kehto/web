/**
 * Feed demo napplet — following feed over the shell relay service.
 */
import '@napplet/shim';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { identityGetPublicKey } from '@napplet/nap/identity/sdk';
import { ifcEmit } from '@napplet/nap/ifc/sdk';
import type { NostrEvent } from '@napplet/core';
import { createFeedStore, type FeedProfile } from './feed-store.js';
import { createFeedIdentityEventController } from './feed-identity-events.js';

const REQUIRED_NAPS = ['identity', 'relay', 'ifc', 'theme'] as const;
const REQUIRED_IFC_PROTOCOL = 'ifc:NAP-01';
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

const statusEl = document.getElementById('feed-status')!;
const listEl = document.getElementById('feed-list')!;
const RELATIVE_TIME_REFRESH_MS = 60_000;

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

function shortenPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function canonicalPubkey(pubkey: string): string | null {
  const normalized = pubkey.toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function openProfile(pubkey: string): void {
  const normalized = canonicalPubkey(pubkey);
  if (!normalized) {
    return;
  }

  try {
    ifcEmit('profile:open', [], JSON.stringify({ pubkey: normalized }));
  } catch {
    // Best effort; the profile viewer itself surfaces the failure state.
  }
}

function getAuthorName(pubkey: string, profile?: FeedProfile): string {
  if (profile?.display_name) return profile.display_name;
  if (profile?.name) return profile.name;
  return shortenPubkey(pubkey);
}

function getAvatarFallback(pubkey: string, authorName: string): string {
  const source = authorName === shortenPubkey(pubkey) ? pubkey : authorName;
  return source.trim().slice(0, 2).toUpperCase() || pubkey.slice(0, 2).toUpperCase();
}

function getProfilePicture(profile?: FeedProfile): string | null {
  if (!profile?.picture) return null;
  try {
    const url = new URL(profile.picture);
    return url.protocol === 'http:' || url.protocol === 'https:' ? profile.picture : null;
  } catch {
    return null;
  }
}

function formatPublishedAgo(createdAtSeconds: number, nowMs = Date.now()): string {
  if (!Number.isFinite(createdAtSeconds) || createdAtSeconds <= 0) return 'unknown time';
  const elapsedSeconds = Math.max(0, Math.floor(nowMs / 1000) - createdAtSeconds);
  const units: Array<[string, number]> = [
    ['y', 31_536_000],
    ['mo', 2_592_000],
    ['w', 604_800],
    ['d', 86_400],
    ['h', 3_600],
    ['m', 60],
  ];

  for (const [label, seconds] of units) {
    if (elapsedSeconds >= seconds) return `${Math.floor(elapsedSeconds / seconds)}${label} ago`;
  }
  return elapsedSeconds < 5 ? 'just now' : `${elapsedSeconds}s ago`;
}

function renderPublishedTime(event: NostrEvent): HTMLTimeElement {
  const timeEl = document.createElement('time');
  timeEl.className = 'feed-item-time';
  timeEl.textContent = formatPublishedAgo(event.created_at);
  if (Number.isFinite(event.created_at) && event.created_at > 0) {
    const publishedAt = new Date(event.created_at * 1000);
    timeEl.dateTime = publishedAt.toISOString();
    timeEl.title = publishedAt.toLocaleString();
  }
  return timeEl;
}

function renderAvatar(pubkey: string, authorName: string, profile?: FeedProfile): HTMLElement {
  const avatarEl = document.createElement('span');
  avatarEl.className = 'feed-item-avatar';
  const fallback = document.createElement('span');
  fallback.className = 'feed-item-avatar-fallback';
  fallback.textContent = getAvatarFallback(pubkey, authorName);

  const picture = getProfilePicture(profile);
  if (picture === null) {
    avatarEl.appendChild(fallback);
    return avatarEl;
  }

  const img = document.createElement('img');
  img.src = picture;
  img.alt = authorName;
  img.loading = 'lazy';
  img.addEventListener('error', () => {
    avatarEl.replaceChildren(fallback);
  }, { once: true });
  avatarEl.appendChild(img);
  return avatarEl;
}

function renderProfileAvatarButton(pubkey: string, authorName: string, profile?: FeedProfile): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feed-profile-button feed-profile-avatar-button';
  button.setAttribute('aria-label', `Open ${authorName} profile`);
  button.appendChild(renderAvatar(pubkey, authorName, profile));
  button.addEventListener('click', () => openProfile(pubkey));
  return button;
}

function renderAuthorButton(pubkey: string, authorName: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feed-item-author feed-profile-button feed-profile-name-button';
  button.textContent = authorName;
  button.addEventListener('click', () => openProfile(pubkey));
  return button;
}

function renderEvent(event: NostrEvent): void {
  const li = document.createElement('li');
  li.className = 'feed-item';
  li.dataset.eventId = event.id;
  const profile = store.state.profiles.get(event.pubkey);
  const authorName = getAuthorName(event.pubkey, profile);
  const bodyEl = document.createElement('div');
  bodyEl.className = 'feed-item-body';
  const metaEl = document.createElement('div');
  metaEl.className = 'feed-item-meta';
  const authorEl = renderAuthorButton(event.pubkey, authorName);
  const timeEl = renderPublishedTime(event);
  const contentEl = document.createElement('span');
  contentEl.className = 'feed-item-content';
  contentEl.textContent = event.content;
  metaEl.append(authorEl, timeEl);
  bodyEl.append(metaEl, contentEl);
  li.append(renderProfileAvatarButton(event.pubkey, authorName, profile), bodyEl);
  listEl.appendChild(li);
}

const store = createFeedStore(renderState);
let waitingForSignerLogged = false;
const relativeTimeRefreshId = window.setInterval(() => {
  if (store.state.timeline.length > 0) renderState();
}, RELATIVE_TIME_REFRESH_MS);

function renderState(): void {
  listEl.replaceChildren();
  for (const event of store.state.timeline) renderEvent(event);
  if (store.state.loading) {
    setStatus('loading', 'gray');
  } else if (store.state.loaded) {
    setStatus(`loaded (${store.state.eventCount})`, 'green');
  }
}

const identityController = createFeedIdentityEventController({
  readPublicKey: identityGetPublicKey,
  onLoggedOut: () => {
    store.clear();
    setStatus('not logged in', 'red');
    waitingForSignerLogged = true;
  },
  onPubkey: (pubkey) => {
    waitingForSignerLogged = false;
    store.init(pubkey);
    setStatus('subscribed', 'green');
  },
  onError: (err) => {
    const reason = formatError(err, 'denied: identity:read or relay:read');
    setStatus(`denied: ${reason}`, 'red');
  },
});

async function init(): Promise<void> {
  installNapTheme();
  onNapThemeChanged((theme) => {
    applyNapTheme(theme);
  });
  await waitForRequiredNaps();
  void identityController.start();
}

init().catch((err) => {
  // If status hasn't been set by the inner catch, set unavailable.
  if (statusEl.textContent === 'connecting...') {
    setStatus('unavailable', 'red');
  }
});

window.addEventListener('pagehide', () => {
  window.clearInterval(relativeTimeRefreshId);
  identityController.stop();
  store.destroy();
});
