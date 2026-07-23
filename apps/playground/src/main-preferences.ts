import {
  areAllAclPanelsExpanded,
  setAllAclPanelsExpanded,
} from './acl-panel.js';
import {
  clearAllNodeOverlays,
  getPersistenceMode,
  setPersistenceMode,
  type PersistenceMode,
} from './color-state.js';
import { getThemeServiceBundle } from './shell-host.js';
import {
  cancelAllTraceAnimations,
} from './trace-animator.js';
import { applyNapTheme } from './theme.js';
import type { DemoTopology, EdgeFlasher } from './topology.js';

export type { PersistenceMode } from './color-state.js';

export const STATIC_PAGES_BASE_PATH = '/web/playground/';
export const isStaticPagesDemo = import.meta.env.BASE_URL === STATIC_PAGES_BASE_PATH;
export const RESOURCE_DEMO_REMOTE_IMAGE_ORIGIN = 'https://raw.githubusercontent.com';

const NAPPLET_HEIGHT_STORAGE_KEY = 'kehto.playground.nappletHeightPx';
const DEBUGGER_HIDDEN_STORAGE_KEY = 'kehto.playground.debuggerHidden';
const COLOR_MODE_STORAGE_KEY = 'kehto.playground.colorMode';
const THEME_STORAGE_KEY = 'kehto.playground.theme.v1';
const DEFAULT_NAPPLET_HEIGHT_PX = 330;
const MIN_NAPPLET_HEIGHT_PX = 220;
const MAX_NAPPLET_HEIGHT_PX = 720;
const COLOR_MODES: readonly PersistenceMode[] = ['flash', 'rolling', 'decay', 'last-message', 'trace'];

export type PlaygroundTheme = {
  title: string;
  colors: {
    background: string;
    text: string;
    primary: string;
  };
};

const DEFAULT_THEME: PlaygroundTheme = {
  title: 'Dark',
  colors: {
    background: '#0a0a0a',
    text: '#e0e0e0',
    primary: '#7aa2f7',
  },
};

export interface PlaygroundPreferences {
  applyColorMode(mode: PersistenceMode, persist: boolean): void;
  applyTheme(theme: PlaygroundTheme): void;
  getCurrentTheme(): PlaygroundTheme;
  handleThemeMessage(theme: unknown): PlaygroundTheme | null;
  initControls(): void;
}

interface PlaygroundPreferencesOptions {
  edgeFlasher: EdgeFlasher;
  initialTheme?: PlaygroundTheme;
  topology: DemoTopology;
}

export function createPlaygroundPreferences({
  edgeFlasher,
  initialTheme,
  topology,
}: PlaygroundPreferencesOptions): PlaygroundPreferences {
  let currentTheme = initialTheme ?? getPersistedPlaygroundTheme();
  applySelectedTheme(currentTheme, false);

  function applyColorMode(mode: PersistenceMode, persist: boolean): void {
    const prevMode = getPersistenceMode();

    if (prevMode === 'trace' && mode !== 'trace') {
      cancelAllTraceAnimations(edgeFlasher, topology.edges.map((edge) => edge.id));
    }

    setPersistenceMode(mode);
    updateColorModeButtons(mode);

    const ephemeral = ['flash', 'trace'];
    if (ephemeral.includes(mode) || ephemeral.includes(prevMode)) {
      clearAllNodeOverlays();
      for (const edge of topology.edges) {
        edgeFlasher.setColor(edge.id, 'out', null);
        edgeFlasher.setColor(edge.id, 'in', null);
      }
    }

    if (persist) writeStoredValue(COLOR_MODE_STORAGE_KEY, mode);
  }

  function applyTheme(theme: PlaygroundTheme): void {
    handleThemeMessage(theme);
  }

  function getCurrentTheme(): PlaygroundTheme {
    return currentTheme;
  }

  function handleThemeMessage(theme: unknown): PlaygroundTheme | null {
    if (!isThemeLike(theme)) return null;
    currentTheme = theme;
    applySelectedTheme(currentTheme, true);
    getThemeServiceBundle()?.publishTheme(currentTheme);
    return currentTheme;
  }

  function initControls(): void {
    initNappletHeightControl();
    initDebuggerToggle();
    initAclExpandAllControl();
    applyColorMode(readStoredColorMode(), false);
  }

  return {
    applyColorMode,
    applyTheme,
    getCurrentTheme,
    handleThemeMessage,
    initControls,
  };
}

function readStoredNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number.parseInt(stored, 10);
    return Number.isFinite(value) ? value : fallback;
  } catch (error) {
    console.warn('Failed to read stored number preference; using fallback.', { key, error });
    return fallback;
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in hardened contexts; keep the current session usable.
  }
}

function readStoredJson<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn('Failed to read stored JSON preference; using empty value.', { key, error });
    return null;
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === 'true';
  } catch (error) {
    console.warn('Failed to read stored boolean preference; using fallback.', { key, error });
    return fallback;
  }
}

function isPersistenceMode(value: string | null): value is PersistenceMode {
  return COLOR_MODES.includes(value as PersistenceMode);
}

function readStoredColorMode(): PersistenceMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return isPersistenceMode(stored) ? stored : 'flash';
  } catch {
    return 'flash';
  }
}

function isThemeLike(value: unknown): value is PlaygroundTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as PlaygroundTheme;
  return typeof theme.title === 'string'
    && typeof theme.colors?.background === 'string'
    && typeof theme.colors?.text === 'string'
    && typeof theme.colors?.primary === 'string';
}

/**
 * Read the persisted host theme without publishing a theme change.
 *
 * The caller can pass this value into ThemeService construction before any
 * napplet becomes ready, keeping `theme.get` consistent with host CSS.
 *
 * @returns The valid persisted theme, or the complete default theme.
 */
export function getPersistedPlaygroundTheme(): PlaygroundTheme {
  const stored = readStoredJson<unknown>(THEME_STORAGE_KEY);
  return isThemeLike(stored) ? stored : DEFAULT_THEME;
}

function persistTheme(theme: PlaygroundTheme): void {
  writeStoredValue(THEME_STORAGE_KEY, JSON.stringify(theme));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  if (normalized.length === 3) {
    return [
      Number.parseInt(normalized[0] + normalized[0], 16),
      Number.parseInt(normalized[1] + normalized[1], 16),
      Number.parseInt(normalized[2] + normalized[2], 16),
    ];
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  if (!leftRgb || !rightRgb) return left;

  const weight = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    leftRgb[0] + (rightRgb[0] - leftRgb[0]) * weight,
    leftRgb[1] + (rightRgb[1] - leftRgb[1]) * weight,
    leftRgb[2] + (rightRgb[2] - leftRgb[2]) * weight,
  );
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function ensureThemeHostStyle(): void {
  if (document.getElementById('playground-theme-style')) return;
  const style = document.createElement('style');
  style.id = 'playground-theme-style';
  style.textContent = `
    body {
      background: var(--nap-theme-background, #0a0a0f) !important;
      color: var(--nap-theme-text, #e0e0e0) !important;
      color-scheme: var(--nap-theme-color-scheme, dark);
    }

    header.app-header,
    #static-demo-banner,
    #relay-activity-panel,
    #debugger-section,
    #inspector-pane,
    .shell-control-group,
    .shell-control-btn,
    .topology-node,
    .topology-node-content,
    .topology-runtime-demo-card,
    .topology-service-card,
    .topology-acl-slot,
    .topology-flow-log,
    .node-summary,
    .notif-toast,
    .signer-modal-panel,
    .notif-node-controls,
    #notification-inspector,
    .acl-modal,
    .const-grouping-btn,
    .const-reset-all-btn,
    .const-reset-btn,
    .notif-node-btn,
    .notif-item-btn,
    .signer-connect-btn,
    .signer-disconnect-btn,
    .signer-connect-action-btn {
      border-color: var(--nap-theme-border, #2a2a3a) !important;
    }

    header.app-header,
    #static-demo-banner,
    #relay-activity-panel,
    #debugger-section,
    #inspector-pane,
    .shell-control-group,
    .topology-node,
    .topology-node-content,
    .topology-runtime-demo-card,
    .topology-service-card,
    .topology-acl-slot,
    .topology-flow-log,
    .notif-toast,
    .signer-modal-panel,
    .notif-node-controls,
    #notification-inspector,
    .acl-modal {
      background: var(--nap-theme-surface-1, #12121a) !important;
    }

    .shell-control-label,
    .shell-control-value,
    .topology-region-label,
    .topology-node-kicker,
    .topology-node-status,
    .topology-node-title,
    .topology-node-header,
    .topology-node-copy,
    .topology-node-meta,
    .topology-flow-log-body,
    .node-summary-label,
    .node-summary-value,
    .notif-toast-title,
    .notif-item-title,
    .signer-option-title,
    .signer-pubkey,
    .signer-method-badge,
    .notif-toast-body,
    .notif-item-body,
    .signer-relay,
    .signer-option-copy,
    .signer-field-label,
    .notif-inspector-title,
    .notif-list-empty {
      color: var(--nap-theme-muted, #7981a0) !important;
    }

    .shell-control-btn:hover,
    .shell-control-btn[aria-pressed="true"],
    .const-grouping-btn.active,
    .const-grouping-btn:hover:not(.active),
    .notif-node-btn:hover,
    .notif-item-btn:hover,
    .signer-connect-btn:hover,
    .signer-disconnect-btn:hover,
    .signer-connect-action-btn:hover {
      color: var(--nap-theme-primary, #00f0ff) !important;
      border-color: var(--nap-theme-primary-border, #00f0ff) !important;
    }
  `;
  document.head.appendChild(style);
}

function applySelectedTheme(theme: PlaygroundTheme, persist: boolean): void {
  ensureThemeHostStyle();
  (window as Window & { __kehtoCurrentTheme?: PlaygroundTheme }).__kehtoCurrentTheme = theme;
  applyNapTheme(theme);

  const rootStyle = document.documentElement.style;
  const background = theme.colors.background;
  const text = theme.colors.text;
  const primary = theme.colors.primary;
  const isLight = relativeLuminance(background) > 0.35;

  rootStyle.setProperty('--nap-theme-surface-1', mixHexColors(background, text, isLight ? 0.08 : 0.12));
  rootStyle.setProperty('--nap-theme-surface-2', mixHexColors(background, text, isLight ? 0.12 : 0.18));
  rootStyle.setProperty('--nap-theme-surface-3', mixHexColors(background, text, isLight ? 0.18 : 0.24));
  rootStyle.setProperty('--nap-theme-border', mixHexColors(background, text, isLight ? 0.22 : 0.30));
  rootStyle.setProperty('--nap-theme-muted', mixHexColors(text, background, isLight ? 0.38 : 0.55));
  rootStyle.setProperty('--nap-theme-primary-soft', mixHexColors(background, primary, isLight ? 0.18 : 0.14));
  rootStyle.setProperty('--nap-theme-primary-border', mixHexColors(background, primary, isLight ? 0.40 : 0.32));
  rootStyle.setProperty('--nap-theme-primary-text', mixHexColors(primary, background, isLight ? 0.18 : 0.12));
  rootStyle.setProperty('--nap-theme-color-scheme', isLight ? 'light' : 'dark');
  document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';

  if (persist) persistTheme(theme);
}

function clampNappletHeight(value: number): number {
  return Math.min(MAX_NAPPLET_HEIGHT_PX, Math.max(MIN_NAPPLET_HEIGHT_PX, value));
}

function notifyLayoutChanged(): void {
  window.dispatchEvent(new Event('resize'));
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
}

function applyNappletHeight(heightPx: number, persist: boolean): void {
  const clamped = clampNappletHeight(heightPx);
  document.documentElement.style.setProperty('--napplet-frame-height', `${clamped}px`);

  const slider = document.getElementById('napplet-height-slider') as HTMLInputElement | null;
  if (slider) slider.value = String(clamped);

  const valueEl = document.getElementById('napplet-height-value');
  if (valueEl) valueEl.textContent = `${clamped}px`;

  if (persist) writeStoredValue(NAPPLET_HEIGHT_STORAGE_KEY, String(clamped));
  notifyLayoutChanged();
}

function initNappletHeightControl(): void {
  const slider = document.getElementById('napplet-height-slider') as HTMLInputElement | null;
  const resetBtn = document.getElementById('napplet-height-reset');
  const initialHeight = clampNappletHeight(
    readStoredNumber(NAPPLET_HEIGHT_STORAGE_KEY, DEFAULT_NAPPLET_HEIGHT_PX),
  );

  applyNappletHeight(initialHeight, false);

  slider?.addEventListener('input', () => {
    applyNappletHeight(Number.parseInt(slider.value, 10), true);
  });

  resetBtn?.addEventListener('click', () => {
    applyNappletHeight(DEFAULT_NAPPLET_HEIGHT_PX, true);
  });
}

function setDebuggerHidden(hidden: boolean, persist: boolean): void {
  document.body.classList.toggle('debugger-hidden', hidden);

  const btn = document.getElementById('debugger-toggle-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = hidden ? 'show debugger' : 'hide debugger';
    btn.setAttribute('aria-pressed', String(hidden));
  }

  if (persist) writeStoredValue(DEBUGGER_HIDDEN_STORAGE_KEY, String(hidden));
  notifyLayoutChanged();
}

function initDebuggerToggle(): void {
  const btn = document.getElementById('debugger-toggle-btn');
  const initialHidden = readStoredBoolean(DEBUGGER_HIDDEN_STORAGE_KEY, false);
  setDebuggerHidden(initialHidden, false);

  btn?.addEventListener('click', () => {
    setDebuggerHidden(!document.body.classList.contains('debugger-hidden'), true);
  });
}

function updateAclExpandAllButton(): void {
  const btn = document.getElementById('acl-expand-all-btn') as HTMLButtonElement | null;
  if (!btn) return;

  const allExpanded = areAllAclPanelsExpanded();
  btn.textContent = allExpanded ? 'collapse all ACL' : 'expand all ACL';
  btn.setAttribute('aria-pressed', String(allExpanded));
}

function initAclExpandAllControl(): void {
  const btn = document.getElementById('acl-expand-all-btn');
  btn?.addEventListener('click', () => {
    setAllAclPanelsExpanded(!areAllAclPanelsExpanded());
    updateAclExpandAllButton();
    notifyLayoutChanged();
  });

  window.addEventListener('acl-panels:expansion-changed', () => {
    updateAclExpandAllButton();
    notifyLayoutChanged();
  });

  updateAclExpandAllButton();
}

function updateColorModeButtons(mode: PersistenceMode): void {
  document.querySelectorAll('.color-mode-btn').forEach((button) => {
    button.classList.toggle('color-mode-active', (button as HTMLElement).dataset.colorMode === mode);
  });
}
