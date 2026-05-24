/**
 * Theme-switcher demo napplet — exercises theme broadcast (NAP-08, Phase 20).
 *
 * Behavior: clicking a button dispatches an outbound postMessage to the parent
 * frame with { type: 'demo.publishTheme', theme }. The demo host (Plan 20-06) listens
 * for this and calls relay.publishTheme(theme) which fan-outs theme.changed envelopes
 * to every napplet via session-registry.
 *
 * THEME-SDK-GAP (Phase 58 raw-envelope allowlist): the helper surface does not
 * expose a theme.publish API. Outbound parent-frame postMessage is the
 * documented demo-only host-control exception.
 *
 * NOTE: theme-switcher is OUTBOUND-ONLY and does NOT install any global message
 * listener. Only element-scoped click handlers are registered on the three buttons.
 * The parent-frame postMessage call in dispatchTheme() is the sole cross-frame seam.
 *
 * Anti-features (v1.3, hard-enforced — zero live-code occurrences):
 *   - No raw NIP-01 arrays
 *   - No bus-kind enums or kind 29001/29002 references
 *   - No global nostr accessor
 *   - No legacy signing-service or legacy @napplet/core compat-shim consumers
 *   - No global message-event listener (OUTBOUND-ONLY napplet)
 */
import '@napplet/shim';

const REQUIRED_NUBS = ['theme'] as const;

const statusEl = document.getElementById('theme-status')!;
const lightBtn = document.getElementById('theme-light-btn') as HTMLButtonElement;
const darkBtn  = document.getElementById('theme-dark-btn') as HTMLButtonElement;
const customBtn = document.getElementById('theme-custom-btn') as HTMLButtonElement;
const customColorEl = document.getElementById('theme-custom-color') as HTMLInputElement;
const logEl = document.getElementById('theme-log')!;
const allBtns = [lightBtn, darkBtn, customBtn];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'theme-log-entry';
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

function getMissingRequiredNubs(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

// ── Theme presets ─────────────────────────────────────────────────────────────

const LIGHT_THEME = {
  colors: { background: '#fafafa', text: '#0a0a0a', primary: '#5a3aff' },
};
const DARK_THEME = {
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
};

// ── Active-state helper ───────────────────────────────────────────────────────

function setActive(target: HTMLButtonElement): void {
  for (const btn of allBtns) {
    btn.dataset.active = btn === target ? 'true' : 'false';
  }
}

// ── Theme dispatch (the single outbound seam) ─────────────────────────────────

/**
 * Dispatch a demo.publishTheme message to the parent frame.
 * The demo host (Plan 20-06) listens for this event type and calls
 * relay.publishTheme(theme), which fan-outs theme.changed envelopes
 * to every napplet registered in the session-registry.
 */
function dispatchTheme(
  themeName: string,
  theme: { colors: { background: string; text: string; primary: string } },
): void {
  log(`demo.publishTheme dispatch — ${themeName} (bg: ${theme.colors.background})`);
  window.parent.postMessage({ type: 'demo.publishTheme', theme }, '*');
}

// ── Button handlers ───────────────────────────────────────────────────────────

lightBtn.addEventListener('click', () => {
  setActive(lightBtn);
  dispatchTheme('light', LIGHT_THEME);
});

darkBtn.addEventListener('click', () => {
  setActive(darkBtn);
  dispatchTheme('dark', DARK_THEME);
});

customBtn.addEventListener('click', () => {
  setActive(customBtn);
  const bg = customColorEl.value || '#1a1a2e';
  // Derive a simple custom theme from the color picker value.
  // Single-color theming is sufficient per CONTEXT deferred ideas (no full theme
  // system in v1.3). text and primary stay at dark-theme defaults.
  const customTheme = {
    colors: { background: bg, text: '#e0e0e0', primary: '#7aa2f7' },
  };
  dispatchTheme('custom', customTheme);
});

// ── Init ────────────────────────────────────────────────────────────────────

/**
 * Flip status sentinel to 'ready'. NIP-5D identity is assigned by the shell at
 * iframe creation; theme broadcast still fires from button handlers, not init.
 *
 * Status sentinel contract (Plan 20-07 greps for these strings):
 *   'connecting...' — HTML default (before init runs)
 *   'ready'         — set when init resolves
 *   'unavailable'   — set if init throws unexpectedly
 */
async function init(): Promise<void> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    throw new Error(`unsupported NUB capability: ${missing.join(', ')}`);
  }
  setStatus('ready', 'green');
  log('ready to broadcast theme');
}

init().catch((err) => {
  setStatus('unavailable', 'red');
  log(`init failed — ${formatError(err, 'init failure')}`);
});
