/**
 * Preferences demo napplet — exercises storageSetItem + storageGetItem (NAP-04, Phase 19).
 *
 * Per CONTEXT D-03:
 *   - On mount: storageGetItem('display-name') and storageGetItem('theme-preference')
 *     populate the corresponding inputs; #preferences-status flips to 'loaded'
 *   - On click of #preferences-save-btn: storageSetItem('display-name', value) +
 *     storageSetItem('theme-preference', value); #preferences-status flips to 'saved'
 *   - After page reload: same values appear (storage is localStorage-backed per
 *     packages/shell/src/hooks-adapter.ts:256, scoped per shell-assigned napplet identity)
 *
 * Anti-features (per v1.3 milestone): no raw message listener, no NIP-01 arrays,
 *   no BusKind, no global nostr, no signer-service.
 *
 * Per CONTEXT D-USER-02 (Phase 20):
 *   - Subscribes through the shared NAP-THEME helper for `theme.changed` envelopes broadcast
 *     by the shell's persisted theme broadcaster (triggered when theme-switcher posts
 *     a `theme.set` message that the demo host translates into `theme.changed`).
 *   - On receipt: sets document.body.style.backgroundColor to theme.colors.background AND
 *     sets #preferences-theme-applied textContent to that color hex.
 *
 * THEME-SDK-GAP (Phase 58 raw-envelope allowlist): the shared helper owns the
 * single source-bound message listener because the published helper surface does
 * not expose theme.on / theme.subscribe yet.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { storageGetItem, storageSetItem } from '@napplet/nap/storage/sdk';

const REQUIRED_NAPS = ['storage', 'theme'] as const;

const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const STORAGE_LOAD_ATTEMPTS = 3;
const STORAGE_LOAD_RETRY_MS = 250;

const statusEl = document.getElementById('preferences-status')!;
const displayNameEl = document.getElementById('pref-display-name') as HTMLInputElement;
const themePreferenceEl = document.getElementById('pref-theme-preference') as HTMLInputElement;
const saveBtn = document.getElementById('preferences-save-btn')!;
const logEl = document.getElementById('preferences-log')!;

const KEY_DISPLAY_NAME = 'display-name';
const KEY_THEME = 'theme-preference';

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'preferences-log-entry';
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

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

async function storageGetItemWithRetry(key: string): Promise<string | null> {
  for (let attempt = 1; attempt <= STORAGE_LOAD_ATTEMPTS; attempt += 1) {
    try {
      return await storageGetItem(key);
    } catch (error) {
      if (!isTimeoutError(error) || attempt === STORAGE_LOAD_ATTEMPTS) throw error;
      await sleep(STORAGE_LOAD_RETRY_MS * attempt);
    }
  }
  return null;
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

async function loadPreferences(): Promise<void> {
  // Two sequential storageGetItem calls localize denial.
  // If state:read is denied, the rejected Promise surfaces here and we bail.
  try {
    const name = await storageGetItemWithRetry(KEY_DISPLAY_NAME);
    const theme = await storageGetItemWithRetry(KEY_THEME);
    if (name !== null) displayNameEl.value = name;
    if (theme !== null) themePreferenceEl.value = theme;
    setStatus('loaded', 'green');
    log(`loaded — display-name: ${name ?? '(unset)'}, theme: ${theme ?? '(unset)'}`);
  } catch (error) {
    const reason = formatError(error, 'denied: state:read');
    setStatus(`denied: ${reason}`, 'red');
    log(`load failed — ${reason}`);
    throw error;
  }
}

async function savePreferences(): Promise<void> {
  const nameValue = displayNameEl.value;
  const themeValue = themePreferenceEl.value;
  try {
    await storageSetItem(KEY_DISPLAY_NAME, nameValue);
    await storageSetItem(KEY_THEME, themeValue);
    setStatus('saved', 'green');
    log(`saved — display-name: '${nameValue}', theme: '${themeValue}'`);
  } catch (error) {
    const reason = formatError(error, 'denied: state:write');
    setStatus(`denied: ${reason}`, 'red');
    log(`save failed — ${reason}`);
  }
}

saveBtn.addEventListener('click', () => {
  void savePreferences();
});

const themeAppliedEl = document.getElementById('preferences-theme-applied');
onNapThemeChanged((theme) => {
  applyNapTheme(theme);
  const bg = theme.colors.background;
  if (themeAppliedEl) themeAppliedEl.textContent = bg;
  log(`theme.changed received - bg: ${bg}`);
});

// Load persisted preferences on mount; status flips to 'loaded' on success.
async function init(): Promise<void> {
  await waitForRequiredNaps();
  installNapTheme();
  await loadPreferences();
}

init().catch((err) => {
  // Status already set by loadPreferences if it reached the catch branch.
  // If init failed before loadPreferences ran (e.g. unexpected init error), set unavailable.
  if (statusEl.textContent === 'connecting...') {
    setStatus('unavailable', 'red');
    log(`init failed — ${formatError(err, 'NIP-5D capability/storage failure')}`);
  }
});
