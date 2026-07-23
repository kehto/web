/**
 * Chat demo napplet — helper-based SDK migration (NAP-02, Phase 18).
 *
 * Exercises: inc (incEmit/incOn for chat↔bot round-trip) + storage (history persistence).
 * Optional showcase: relay.publish for kind:1 events (D-03).
 *
 * - Sends incEmit('chat:message', ...) on user input (D-03)
 * - Receives incOn('bot:response', ...) for bot replies (D-03)
 * - Persists chat history via storageSetItem/storageGetItem under key 'chat-history'
 * - Posts #chat-status = 'ready' after init completes (loadHistory resolves)
 *
 * NO window.addEventListener('message') — shim handles NIP-5D envelopes (D-01).
 * NO NIP-01 arrays, NO BusKind, NO window.nostr (anti-features).
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { incEmit, incOn } from '@napplet/nap/inc/sdk';
import { storageGetItem, storageSetItem } from '@napplet/nap/storage/sdk';
import { relayPublish, relaySubscribe } from '@napplet/nap/relay/sdk';
import type { EventTemplate } from '@napplet/core';

const REQUIRED_NAPS = ['inc', 'storage', 'relay', 'theme'] as const;

const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

const statusEl = document.getElementById('chat-status')!;
const messagesEl = document.getElementById('messages')!;
const inputEl = document.getElementById('msg-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn')!;

const HISTORY_KEY = 'chat-history';
const MAX_HISTORY = 50;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
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

function addMessage(text: string, type: 'self' | 'other' | 'system' = 'system'): void {
  const div = document.createElement('div');
  div.className = `msg msg-${type}`;
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const prefix = type === 'self' ? '> ' : type === 'other' ? '< ' : '* ';
  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = time;
  div.append(timeEl, document.createTextNode(`${prefix}${text}`));
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadHistory(): Promise<void> {
  try {
    const raw = await storageGetItem(HISTORY_KEY);
    if (raw) {
      const entries: string[] = JSON.parse(raw);
      for (const entry of entries.slice(-10)) {
        addMessage(entry, 'system');
      }
      addMessage(`loaded ${entries.length} history entries`, 'system');
    }
  } catch (error) {
    addMessage(`state history load failed -- ${formatError(error, 'denied: state:read')}`, 'system');
  }
}

async function saveToHistory(text: string): Promise<void> {
  try {
    const raw = await storageGetItem(HISTORY_KEY);
    const entries: string[] = raw ? JSON.parse(raw) : [];
    entries.push(text);
    if (entries.length > MAX_HISTORY) entries.splice(0, entries.length - MAX_HISTORY);
    await storageSetItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    addMessage(`state history save failed -- ${formatError(error, 'denied: state:write')}`, 'system');
  }
}

async function sendMessage(): Promise<void> {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  addMessage(text, 'self');
  await saveToHistory(text);

  try {
    incEmit('chat:message', [], JSON.stringify({ text, timestamp: Date.now() }));
    addMessage('inc send attempted -- chat:message', 'system');
  } catch (error) {
    addMessage(`inc send failed -- ${formatError(error, 'denied: inc')}`, 'system');
  }

  // Publish to relay (optional showcase — exercises relay:write + signing path per D-03).
  // Wrapped in its own try so relay denial does not break the INC path.
  try {
    const template: EventTemplate = {
      kind: 1,
      content: text,
      tags: [['t', 'demo-chat']],
      created_at: Math.floor(Date.now() / 1000),
    };
    await relayPublish(template);
  } catch (error) {
    addMessage(`relay publish failed -- ${formatError(error, 'denied: relay:write')}`, 'system');
  }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function init(): Promise<void> {
  await waitForRequiredNaps();
  installNapTheme();
  onNapThemeChanged((theme) => {
    applyNapTheme(theme);
  });

  await loadHistory();

  // Subscribe to bot replies via INC (D-03) BEFORE announcing ready, so a sender
  // that acts on the "ready" signal cannot race ahead of this subscription.
  incOn('bot:response', (payload: unknown) => {
    const data = payload as { text?: string };
    if (data.text) {
      addMessage('inc receive -- bot:response', 'system');
      addMessage(`[bot] ${data.text}`, 'other');
    }
  });

  statusEl.textContent = 'ready';
  statusEl.style.color = 'var(--nap-theme-success, #39ff14)';
  addMessage('ready to chat', 'system');

  // Optional: subscribe to a tagged relay topic for the publish showcase (D-03).
  // Wrapped in try so a relay:read denial does not break INC functionality.
  try {
    relaySubscribe(
      [{ kinds: [1], '#t': ['demo-chat'], limit: 10 }],
      (event) => addMessage(event.content, 'other'),
      () => addMessage('relay subscribe ready', 'system'),
    );
  } catch (error) {
    addMessage(`relay subscribe failed -- ${formatError(error, 'denied: relay:read')}`, 'system');
  }
}

init().catch((err) => {
  statusEl.textContent = 'unavailable';
  statusEl.style.color = 'var(--nap-theme-danger, #ff3b3b)';
  addMessage(`init failed -- ${formatError(err, 'NIP-5D capability/storage failure')}`, 'system');
});
