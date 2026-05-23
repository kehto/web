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
 *   - Installs ONE narrowly-scoped window message listener for `theme.changed` envelopes broadcast
 *     by the demo's shell-bridge.publishTheme() (triggered when theme-switcher (Plan 20-04) posts
 *     a `demo.publishTheme` message that the demo host (Plan 20-06) forwards to relay.publishTheme).
 *   - On receipt: sets document.body.style.backgroundColor to theme.colors.background AND
 *     sets #preferences-theme-applied textContent to that color hex.
 *
 * THEME-SDK-GAP (Phase 58 raw-envelope allowlist): the helper surface does not
 * expose theme.on / theme.subscribe. The single source-bound message listener
 * registered below is the explicit, narrowly scoped deviation for theme.changed.
 */
import '@napplet/shim';
import { storageGetItem, storageSetItem } from '@napplet/nub/storage/sdk';

const REQUIRED_NUBS = ['storage', 'theme'] as const;

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

function getMissingRequiredNubs(): string[] {
  const supports = (window as unknown as {
    napplet: { shell: { supports(capability: string): boolean } };
  }).napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

async function loadPreferences(): Promise<void> {
  // Two sequential storageGetItem calls localize denial.
  // If state:read is denied, the rejected Promise surfaces here and we bail.
  try {
    const name = await storageGetItem(KEY_DISPLAY_NAME);
    const theme = await storageGetItem(KEY_THEME);
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

// Load persisted preferences on mount; status flips to 'loaded' on success.
async function init(): Promise<void> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
  }
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

/**
 * THE ONLY raw window message listener in this napplet (Phase 58 allowlist).
 *
 * Justified because the helper surface does not expose theme.on / theme.subscribe. This handler:
 *   - Guards on event.source === window.parent (drop messages from other origins)
 *   - Guards on event.data being a plain object with type === 'theme.changed'
 *   - Reads theme.colors.background (string) and applies it to document.body.style.backgroundColor
 *   - Sets #preferences-theme-applied textContent to the hex string
 *   - Tolerates malformed payloads (missing fields → silent return)
 *
 * Does NOT intercept storage.*, ifc.*, or any other envelope types — those still flow through
 * the shim-mounted NUB helper surface so the Phase 19 storage round-trip remains intact.
 */
const themeAppliedEl = document.getElementById('preferences-theme-applied');
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'theme.changed') return;
  const theme = (data as { theme?: { colors?: { background?: unknown } } }).theme;
  const bg = theme?.colors?.background;
  if (typeof bg !== 'string' || bg.length === 0) return;
  document.body.style.backgroundColor = bg;
  if (themeAppliedEl) themeAppliedEl.textContent = bg;
  log(`theme.changed received — bg: ${bg}`);
});
