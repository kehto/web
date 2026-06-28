/**
 * Bot demo napplet — helper-based SDK migration (NAP-01, Phase 18).
 *
 * Exercises: inc (subscribe + emit), storage (rules persistence).
 *
 * - Subscribes via incOn('chat:message') (D-02)
 * - Replies via incEmit('bot:response') (D-02)
 * - Persists learned rules via storageSetItem/storageGetItem under key 'bot-rules' (D-02)
 * - Posts #status-text = 'ready' after init completes (loadRules resolves)
 *
 * NO raw window.message listener — shim handles NIP-5D envelopes (D-01).
 * NO NIP-01 arrays, NO legacy bus enums, NO global nostr (anti-features).
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { incEmit, incOn } from '@napplet/nap/inc/sdk';
import { storageGetItem, storageSetItem } from '@napplet/nap/storage/sdk';

const REQUIRED_NAPS = ['inc', 'storage', 'theme'] as const;

const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

/**
 * Emit a notifications:create event through the real napplet→service path.
 * The shell routes this INC event to the notification service handler.
 */
function notifyCreate(title: string, body: string): void {
  try {
    incEmit('notifications:create', [], JSON.stringify({ title, body }));
  } catch {
    /* best-effort — don't break the main flow if notifications are denied */
  }
}

const statusEl = document.getElementById('status-text')!;
const ruleCountEl = document.getElementById('rule-count')!;
const logEl = document.getElementById('log')!;
const rulesEl = document.getElementById('rules')!;

const RULES_KEY = 'bot-rules';

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

// Rule storage: trigger -> response
let rules: Record<string, string> = {};

// Default responses for when no rule matches
const DEFAULT_RESPONSES = [
  'interesting... tell me more',
  'hmm, I see',
  'roger that',
  'noted!',
  '*beep boop*',
  'processing...',
  'acknowledged',
  'fascinating',
];

function log(text: string, type: 'heard' | 'replied' | 'learned' | 'error' | 'info' = 'info'): void {
  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const prefix = {
    heard: '[heard]',
    replied: '[reply]',
    learned: '[learn]',
    error: '[error]',
    info: '[info]',
  }[type];
  div.textContent = `${time} ${prefix} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

async function loadRules(): Promise<void> {
  try {
    const raw = await storageGetItem(RULES_KEY);
    if (raw) {
      rules = JSON.parse(raw);
      log(`loaded ${Object.keys(rules).length} rules from storage`, 'info');
    }
  } catch (error) {
    log(`state read failed -- ${formatError(error, 'denied: state:read')}`, 'error');
  }
  updateRulesDisplay();
}

async function saveRules(): Promise<void> {
  try {
    await storageSetItem(RULES_KEY, JSON.stringify(rules));
  } catch (error) {
    log(`state write failed -- ${formatError(error, 'denied: state:write')}`, 'error');
  }
}

function updateRulesDisplay(): void {
  const count = Object.keys(rules).length;
  ruleCountEl.textContent = `${count} rule${count === 1 ? '' : 's'}`;

  rulesEl.replaceChildren();
  for (const [trigger, response] of Object.entries(rules)) {
    const div = document.createElement('div');
    div.textContent = `"${trigger}" -> "${response}"`;
    rulesEl.appendChild(div);
  }
}

function handleTeachCommand(text: string): boolean {
  // Format: /teach <trigger> <response>
  const match = text.match(/^\/teach\s+(\S+)\s+(.+)$/);
  if (!match) return false;

  const [, trigger, response] = match;
  rules[trigger.toLowerCase()] = response;
  log(`learned: "${trigger}" -> "${response}"`, 'learned');
  saveRules();
  updateRulesDisplay();

  // Emit a notification so the host can surface this rule learn event
  notifyCreate('Bot activity', `learned: "${trigger}" → "${response}"`);

  // Acknowledge the teach command
  incEmit('bot:response', [], JSON.stringify({
    text: `learned! I'll respond "${response}" when I hear "${trigger}"`,
    timestamp: Date.now(),
  }));

  return true;
}

function findResponse(text: string): string {
  const lower = text.toLowerCase();

  // Check learned rules (substring match)
  for (const [trigger, response] of Object.entries(rules)) {
    if (lower.includes(trigger)) {
      return response;
    }
  }

  // Built-in responses
  if (lower.includes('hello') || lower.includes('hi')) return 'hey there!';
  if (lower.includes('help')) return 'try /teach <trigger> <response> to teach me!';
  if (lower.includes('ping')) return 'pong!';
  if (lower.includes('name')) return "I'm napplet-bot, a demo auto-responder";

  return DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
}

function handleChatMessage(payload: unknown): void {
  const data = payload as { text?: string; timestamp?: number };
  const text = data.text || '';
  if (!text) return;

  log(`inc chat:message received -- ${text}`, 'heard');

  if (handleTeachCommand(text)) return;

  // Find and send response
  const response = findResponse(text);
  log(response, 'replied');

  // Emit response to chat via INC (exercises sign:event for the emit)
  try {
    incEmit('bot:response', [], JSON.stringify({
      text: response,
      timestamp: Date.now(),
    }));
    log('inc bot:response sent', 'info');
    notifyCreate('Bot activity', response.length > 60 ? response.slice(0, 60) + '…' : response);
  } catch (error) {
    log(`inc response failed -- ${formatError(error, 'denied: relay:write')}`, 'error');
  }
}

async function init(): Promise<void> {
  await waitForRequiredNaps();
  installNapTheme();
  onNapThemeChanged((theme) => {
    applyNapTheme(theme);
  });

  await loadRules();

  // Wire the INC subscription per D-02 BEFORE announcing ready, so a chat sender
  // that acts on the bot's "ready" signal cannot race ahead of this subscription.
  incOn('chat:message', handleChatMessage);
  log('subscribed to inc chat:message topic', 'info');

  statusEl.textContent = 'ready';
  statusEl.style.color = 'var(--nap-theme-success, #39ff14)';
  log('listening for inc chat:message input', 'info');
}

init().catch((err) => {
  statusEl.textContent = 'unavailable';
  statusEl.style.color = 'var(--nap-theme-danger, #ff3b3b)';
  log(`init failed -- ${formatError(err, 'NIP-5D capability/storage failure')}`, 'error');
});
