/**
 * Feed demo napplet — following feed over the shell relay service.
 */
import '@napplet/shim';
import { installNapTheme } from '../../shared-theme';
import { identityGetPublicKey } from '@napplet/nap/identity/sdk';
import type { NostrEvent } from '@napplet/core';
import { createFeedStore, type FeedProfile } from './feed-store.js';
import { createFeedIdentityController } from './feed-identity-controller.js';

const REQUIRED_NAPS = ['identity', 'relay', 'theme'] as const;

const statusEl = document.getElementById('feed-status')!;
const listEl = document.getElementById('feed-list')!;
const logEl = document.getElementById('feed-log')!;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'feed-log-entry';
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
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
}

function shortenPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
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
  const authorEl = document.createElement('span');
  authorEl.className = 'feed-item-author';
  authorEl.textContent = authorName;
  const pubkeyEl = document.createElement('span');
  pubkeyEl.className = 'feed-item-pubkey';
  pubkeyEl.textContent = shortenPubkey(event.pubkey);
  const contentEl = document.createElement('span');
  contentEl.className = 'feed-item-content';
  contentEl.textContent = event.content;
  metaEl.append(authorEl, pubkeyEl);
  bodyEl.append(metaEl, contentEl);
  li.append(renderAvatar(event.pubkey, authorName, profile), bodyEl);
  listEl.appendChild(li);
}

const store = createFeedStore(renderState);
let waitingForSignerLogged = false;

function renderState(): void {
  listEl.replaceChildren();
  for (const event of store.state.timeline) renderEvent(event);
  if (store.state.loading) {
    setStatus('loading', 'gray');
  } else if (store.state.loaded) {
    setStatus(`loaded (${store.state.eventCount})`, 'green');
  }
}

const identityController = createFeedIdentityController({
  readPublicKey: identityGetPublicKey,
  onLoggedOut: () => {
    store.clear();
    setStatus('not logged in', 'red');
    if (!waitingForSignerLogged) {
      waitingForSignerLogged = true;
      log('identity.getPublicKey — empty; waiting for signer');
    } else {
      log('identity.getPublicKey — empty; feed not subscribed');
    }
  },
  onPubkey: (pubkey) => {
    waitingForSignerLogged = false;
    log(`identity.getPublicKey — ${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`);
    log('loading outbox contacts through shell relay');
    store.init(pubkey);
    setStatus('subscribed', 'green');
    log(`relay.subscribe dispatched — kinds:[3], authors:[${pubkey.slice(0, 8)}...]`);
  },
  onError: (err) => {
    const reason = formatError(err, 'denied: identity:read or relay:read');
    setStatus(`denied: ${reason}`, 'red');
    log(`feed identity refresh failed — ${reason}`);
  },
});

async function init(): Promise<void> {
  const missing = getMissingRequiredNaps();
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
  installNapTheme();

  log('reading identity');
  void identityController.start();
}

init().catch((err) => {
  // If status hasn't been set by the inner catch, set unavailable.
  if (statusEl.textContent === 'connecting...') {
    setStatus('unavailable', 'red');
    log(`init failed — ${formatError(err, 'NIP-5D identity/subscribe failure')}`);
  }
});

window.addEventListener('pagehide', () => {
  identityController.stop();
  store.destroy();
});
