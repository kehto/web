/**
 * Chat demo napplet — helper-based SDK migration (NAP-02, Phase 18).
 *
 * Exercises: ifc (ifcEmit/ifcOn for chat↔bot round-trip) + storage (history persistence).
 * Optional showcase: relay.publish for kind:1 events (D-03).
 *
 * - Sends ifcEmit('chat:message', ...) on user input (D-03)
 * - Receives ifcOn('bot:response', ...) for bot replies (D-03)
 * - Persists chat history via storageSetItem/storageGetItem under key 'chat-history'
 * - Posts #chat-status = 'authenticated' after init completes (loadHistory resolves)
 *
 * NO window.addEventListener('message') — shim handles AUTH implicitly (D-01).
 * NO NIP-01 arrays, NO BusKind, NO window.nostr (anti-features).
 */
import '@napplet/shim';
import { ifcEmit, ifcOn } from '@napplet/nub/ifc/sdk';
import { storageGetItem, storageSetItem } from '@napplet/nub/storage/sdk';
import { relayPublish, relaySubscribe } from '@napplet/nub/relay/sdk';
import type { EventTemplate } from '@napplet/core';

// ─── Notification Helpers ─────────────────────────────────────────────────────

/**
 * Emit a notifications:create event through the real napplet→service path.
 * The shell routes this IPC_PEER event to the notification service handler.
 */
function notifyCreate(title: string, body: string): void {
  try {
    ifcEmit('notifications:create', [], JSON.stringify({ title, body }));
  } catch {
    /* best-effort — don't break the main flow if notifications are denied */
  }
}

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

// --- Message Display ---

function addMessage(text: string, type: 'self' | 'other' | 'system' = 'system'): void {
  const div = document.createElement('div');
  div.className = `msg msg-${type}`;
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const prefix = type === 'self' ? '> ' : type === 'other' ? '< ' : '* ';
  div.innerHTML = `<span class="msg-time">${time}</span>${prefix}${escapeHtml(text)}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Chat History (storage) ---

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

// --- Send Message ---

async function sendMessage(): Promise<void> {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  addMessage(text, 'self');
  await saveToHistory(text);

  try {
    ifcEmit('chat:message', [], JSON.stringify({ text, timestamp: Date.now() }));
    addMessage('ifc send attempted -- chat:message', 'system');
    // Emit notification so the host can surface this message send as a toast
    notifyCreate('Chat message sent', text.length > 60 ? text.slice(0, 60) + '…' : text);
  } catch (error) {
    addMessage(`ifc send failed -- ${formatError(error, 'denied: ifc')}`, 'system');
  }

  // Publish to relay (optional showcase — exercises relay:write + signing path per D-03).
  // Wrapped in its own try so relay denial does not break the IFC path.
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

// --- Event Handlers ---

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// --- SDK Init ---
// Load chat history, set the positive status marker, wire up IFC subscriptions.

async function init(): Promise<void> {
  // Load history then set the positive status marker.
  await loadHistory();
  statusEl.textContent = 'authenticated';
  statusEl.style.color = '#39ff14';
  addMessage('ready to chat', 'system');

  // Subscribe to bot replies via IFC (D-03).
  ifcOn('bot:response', (payload: unknown) => {
    const data = payload as { text?: string };
    if (data.text) {
      addMessage('ifc receive -- bot:response', 'system');
      addMessage(`[bot] ${data.text}`, 'other');
    }
  });

  // Optional: subscribe to a tagged relay topic for the publish showcase (D-03).
  // Wrapped in try so a relay:read denial does not break IFC functionality.
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
  statusEl.textContent = 'auth failed';
  statusEl.style.color = '#ff3b3b';
  addMessage(`init failed -- ${formatError(err, 'auth/storage failure')}`, 'system');
});
