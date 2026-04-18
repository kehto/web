/**
 * Preferences demo napplet — exercises storage.setItem + storage.getItem (NAP-04, Phase 19).
 *
 * Per CONTEXT D-03:
 *   - On mount: storage.getItem('display-name') and storage.getItem('theme-preference')
 *     populate the corresponding inputs; #preferences-status flips to 'loaded'
 *   - On click of #preferences-save-btn: storage.setItem('display-name', value) +
 *     storage.setItem('theme-preference', value); #preferences-status flips to 'saved'
 *   - After page reload: same values appear (storage is localStorage-backed per
 *     packages/shell/src/hooks-adapter.ts:256, scoped per napplet identity)
 *
 * Anti-features (per v1.3 milestone): no raw message listener, no NIP-01 arrays,
 *   no BusKind, no global nostr, no signer-service. Shim handles AUTH implicitly.
 */
import '@napplet/shim';
import { storage } from '@napplet/sdk';

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
    color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
}

async function loadPreferences(): Promise<void> {
  // First SDK call gates on shim AUTH completion (D-04 init pattern).
  // Two sequential storage.getItem calls — sequential awaits localize denial.
  // If state:read is denied, the rejected Promise surfaces here and we bail.
  try {
    const name = await storage.getItem(KEY_DISPLAY_NAME);
    const theme = await storage.getItem(KEY_THEME);
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
    await storage.setItem(KEY_DISPLAY_NAME, nameValue);
    await storage.setItem(KEY_THEME, themeValue);
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

// D-04 init pattern: first SDK call (loadPreferences → storage.getItem) gates on AUTH.
async function init(): Promise<void> {
  await loadPreferences();
}

init().catch((err) => {
  // Status already set by loadPreferences if it reached the catch branch.
  // If init failed before loadPreferences ran (e.g. shim AUTH failure), set auth-failed.
  if (statusEl.textContent === 'connecting...') {
    setStatus('auth failed', 'red');
    log(`init failed — ${formatError(err, 'auth/storage failure')}`);
  }
});
