/**
 * Theme-switcher demo napplet — exercises theme broadcast (NAP-08, Phase 20).
 *
 * Behavior: clicking a button dispatches an outbound postMessage to the parent
 * frame with { type: 'theme.set', theme }. The demo host listens for this,
 * persists the selected theme, applies it to the shell, and rebroadcasts
 * theme.changed envelopes to every loaded napplet.
 *
 * THEME-SDK-GAP (Phase 58 raw-envelope allowlist): the helper surface does not
 * expose a theme.set helper. Outbound parent-frame postMessage is the
 * documented demo-only host-control exception.
 *
 * NOTE: theme-switcher publishes theme changes and also installs the shared
 * NAP-THEME listener so its own frame reflects shell-broadcast theme.changed pushes.
 * The parent-frame postMessage call in dispatchTheme() is the only outbound seam.
 *
 * Anti-features (v1.3, hard-enforced — zero live-code occurrences):
 *   - No raw NIP-01 arrays
 *   - No bus-kind enums or kind 29001/29002 references
 *   - No global nostr accessor
 *   - No legacy signing-service or legacy @napplet/core compat-shim consumers
 *   - No domain-specific global message-event listener
 */
import '@napplet/shim';
import { installNapTheme, onNapThemeChanged } from '../../shared-theme';
import { identityGetPublicKey } from '@napplet/nub/identity/sdk';
import {
  discoverThemeCatalog,
  type DiscoveredTheme,
  type ThemePayload,
  type ThemeSource,
} from './theme-discovery.js';

const REQUIRED_NAPS = ['identity', 'relay', 'theme'] as const;
const CAPABILITY_WAIT_MS = 1_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

const statusEl = document.getElementById('theme-status')!;
const lightBtn = document.getElementById('theme-light-btn') as HTMLButtonElement;
const darkBtn  = document.getElementById('theme-dark-btn') as HTMLButtonElement;
const customBtn = document.getElementById('theme-custom-btn') as HTMLButtonElement;
const customColorEl = document.getElementById('theme-custom-color') as HTMLInputElement;
const discoverBtn = document.getElementById('theme-discover-btn') as HTMLButtonElement;
const showWotEl = document.getElementById('theme-show-wot') as HTMLInputElement;
const showGlobalEl = document.getElementById('theme-show-global') as HTMLInputElement;
const catalogEl = document.getElementById('theme-catalog')!;
const allBtns = [lightBtn, darkBtn, customBtn];
let discoveredThemes: DiscoveredTheme[] = [];
let activeThemeId: string | null = null;
let discovering = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.title = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-primary, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
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

// ── Theme presets ─────────────────────────────────────────────────────────────

const LIGHT_THEME = {
  title: 'Light',
  colors: { background: '#fafafa', text: '#0a0a0a', primary: '#5a3aff' },
};
const DARK_THEME = {
  title: 'Dark',
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
};

// ── Active-state helper ───────────────────────────────────────────────────────

function setActive(target: HTMLButtonElement): void {
  activeThemeId = null;
  for (const btn of allBtns) {
    btn.dataset.active = btn === target ? 'true' : 'false';
  }
  renderCatalog();
}

function clearPresetActive(): void {
  for (const btn of allBtns) btn.dataset.active = 'false';
}

function syncThemeSelection(theme: ThemePayload): void {
  const normalizedTitle = theme.title?.trim().toLowerCase();
  if (normalizedTitle === 'light') {
    setActive(lightBtn);
    return;
  }
  if (normalizedTitle === 'dark') {
    setActive(darkBtn);
    return;
  }

  activeThemeId = null;
  clearPresetActive();
  customBtn.dataset.active = 'true';
  customColorEl.value = theme.colors.background;
  renderCatalog();
}

// ── Theme dispatch (the single outbound seam) ─────────────────────────────────

/**
 * Dispatch a theme.set request to the parent frame.
 * The shell host translates this into a persisted selection and then
 * rebroadcasts `theme.changed` to every loaded napplet.
 */
function dispatchTheme(theme: ThemePayload): void {
  window.parent.postMessage({ type: 'theme.set', theme }, '*');
}

// ── Dynamic discovery catalog ─────────────────────────────────────────────────

function sourceLabel(source: ThemeSource): string {
  if (source === 'user') return 'user';
  if (source === 'wot') return 'WoT';
  return 'global';
}

function visibleThemes(): DiscoveredTheme[] {
  return discoveredThemes.filter((theme) => {
    if (theme.source === 'wot') return showWotEl.checked;
    if (theme.source === 'global') return showGlobalEl.checked;
    return true;
  });
}

function renderSwatch(theme: ThemePayload): HTMLElement {
  const swatch = document.createElement('span');
  swatch.className = 'theme-swatch';
  for (const role of ['background', 'text', 'primary'] as const) {
    const color = document.createElement('span');
    color.style.background = theme.colors[role];
    swatch.appendChild(color);
  }
  return swatch;
}

function renderCatalog(): void {
  catalogEl.replaceChildren();
  const themes = visibleThemes();

  if (discovering) {
    const item = document.createElement('li');
    item.className = 'theme-catalog-empty';
    item.textContent = 'Discovering themes...';
    catalogEl.appendChild(item);
    return;
  }

  if (themes.length === 0) {
    const item = document.createElement('li');
    item.className = 'theme-catalog-empty';
    item.textContent = discoveredThemes.length > 0 ? 'No themes visible with current filters.' : 'No discovered themes yet.';
    catalogEl.appendChild(item);
    return;
  }

  for (const entry of themes) {
    const item = document.createElement('li');
    item.className = 'theme-catalog-item';
    item.dataset.source = entry.source;
    item.dataset.active = entry.id === activeThemeId ? 'true' : 'false';

    const body = document.createElement('div');
    body.className = 'theme-catalog-body';

    const title = document.createElement('span');
    title.className = 'theme-catalog-title';
    title.textContent = entry.title;

    const meta = document.createElement('span');
    meta.className = 'theme-catalog-meta';
    meta.textContent = `${sourceLabel(entry.source)} · ${entry.eventKind}`;

    body.append(title, meta);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'theme-btn theme-apply-btn';
    applyBtn.textContent = entry.id === activeThemeId ? 'Active' : 'Apply';
    applyBtn.disabled = entry.id === activeThemeId;
    applyBtn.addEventListener('click', () => {
      activeThemeId = entry.id;
      clearPresetActive();
      dispatchTheme(entry.theme);
      renderCatalog();
    });

    item.append(renderSwatch(entry.theme), body, applyBtn);
    catalogEl.appendChild(item);
  }
}

async function refreshDiscoveredThemes(): Promise<void> {
  if (discovering) return;
  discovering = true;
  discoverBtn.disabled = true;
  setStatus('discovering', 'gray');
  renderCatalog();

  try {
    const result = await discoverThemeCatalog({ readPublicKey: identityGetPublicKey });
    discoveredThemes = result.themes;

    const visibleCount = visibleThemes().length;
    setStatus(`ready (${visibleCount} visible)`, result.errors.length > 0 ? 'gray' : 'green');
  } catch {
    setStatus('discovery failed', 'red');
  } finally {
    discovering = false;
    discoverBtn.disabled = false;
    renderCatalog();
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────

lightBtn.addEventListener('click', () => {
  setActive(lightBtn);
  dispatchTheme(LIGHT_THEME);
});

darkBtn.addEventListener('click', () => {
  setActive(darkBtn);
  dispatchTheme(DARK_THEME);
});

customBtn.addEventListener('click', () => {
  setActive(customBtn);
  const bg = customColorEl.value || '#1a1a2e';
  // Derive a simple custom theme from the color picker value.
  // Single-color theming is sufficient per CONTEXT deferred ideas (no full theme
  // system in v1.3). text and primary stay at dark-theme defaults.
  const customTheme = {
    title: 'Custom',
    colors: { background: bg, text: '#e0e0e0', primary: '#7aa2f7' },
  };
  dispatchTheme(customTheme);
});

discoverBtn.addEventListener('click', () => {
  void refreshDiscoveredThemes();
});

showWotEl.addEventListener('change', () => {
  renderCatalog();
  setStatus(`ready (${visibleThemes().length} visible)`, 'green');
});

showGlobalEl.addEventListener('change', () => {
  renderCatalog();
  setStatus(`ready (${visibleThemes().length} visible)`, 'green');
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
  installNapTheme();
  onNapThemeChanged((theme) => {
    syncThemeSelection(theme as ThemePayload);
  });
  syncThemeSelection(DARK_THEME);
  await waitForRequiredNaps();
  setStatus('ready', 'green');
  renderCatalog();
  void refreshDiscoveredThemes();
}

init().catch((err) => {
  setStatus('unavailable', 'red');
});
