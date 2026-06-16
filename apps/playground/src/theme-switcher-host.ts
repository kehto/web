/**
 * theme-switcher-host.ts — Host-side theme-switcher UI mounted on the theme service card.
 *
 * Provides full-parity controls to the deleted theme-switcher napplet but runs in
 * host context with NO sandbox boundary. Theme application calls options.applyTheme
 * (which routes through preferences.applyTheme -> handleThemeMessage -> publishTheme
 * + theme.changed fan-out). No raw postMessage outbound seam.
 */
import type { NappletMessage, ServiceHandler } from '@kehto/shell';
import {
  discoverThemeCatalog,
  type DiscoveredTheme,
  type NostrEvent,
  type NostrFilter,
  type ThemePayload,
  type ThemeRelaySubscribe,
  type ThemeSource,
} from './theme-discovery.js';
import type { PlaygroundTheme } from './main-preferences.js';

export interface ThemeSwitcherHostOptions {
  /** Called to apply a selected theme — routes through preferences.applyTheme. */
  applyTheme: (theme: PlaygroundTheme) => void;
  /** Returns the current user's hex pubkey (may be empty if not signed in). */
  getHostPubkey: () => string;
  /** Injected relay subscribe adapter from the host relay service. */
  subscribe: ThemeRelaySubscribe;
}

const STYLE_ID = 'playground-theme-switcher-style';

const LIGHT_THEME: PlaygroundTheme = {
  title: 'Light',
  colors: { background: '#fafafa', text: '#0a0a0a', primary: '#5a3aff' },
};
const DARK_THEME: PlaygroundTheme = {
  title: 'Dark',
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
};

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .theme-toolbar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--nap-theme-border, #2a2a3a);
      background: var(--nap-theme-surface-1, rgba(18, 18, 30, 0.78));
      margin-top: 6px;
    }
    .theme-row { display: flex; align-items: center; gap: 6px; }
    .theme-row-wrap { flex-wrap: wrap; }
    .theme-discovery-row { gap: 6px; flex-wrap: wrap; }
    .theme-discovery-row .theme-btn { padding: 4px 10px; font-size: 10px; }
    #playground-host-theme-status {
      color: var(--nap-theme-muted, #888);
      font-size: 10px;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: clip;
      white-space: nowrap;
      text-align: right;
      padding: 3px 8px;
      border: 1px solid var(--nap-theme-border, #2a2a3a);
      background: var(--nap-theme-surface-2, rgba(255, 255, 255, 0.04));
    }
    .theme-btn {
      background: var(--nap-theme-surface-1, #1a1a2e);
      border: 1px solid var(--nap-theme-border, #3a3a5a);
      color: var(--nap-theme-text, #e0e0e0);
      padding: 5px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      cursor: pointer;
    }
    .theme-btn:hover { background: var(--nap-theme-surface-2, #2a2a4e); }
    .theme-btn[data-active='true'] {
      background: var(--nap-theme-primary-soft, #39ff14);
      border-color: var(--nap-theme-primary-border, #39ff14);
      color: var(--nap-theme-primary-text, #0a0a0f);
      box-shadow: 0 0 0 1px var(--nap-theme-primary-border, #39ff14) inset;
    }
    .theme-btn:disabled { opacity: 0.55; cursor: default; }
    #playground-host-theme-custom-color {
      width: 40px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--nap-theme-border, #3a3a5a);
      cursor: pointer;
      background: var(--nap-theme-surface-1, #1a1a2e);
    }
    .theme-toggle {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--nap-theme-muted, #9aa0aa);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .theme-toggle input { width: 12px; height: 12px; accent-color: var(--nap-theme-primary, #39ff14); }
    #playground-host-theme-catalog {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
      max-height: 240px;
      border-top: 1px solid var(--nap-theme-border, #2a2a3a);
      padding-top: 8px;
      margin-top: 6px;
    }
    .theme-catalog-empty { color: var(--nap-theme-muted, #666); font-size: 10px; padding: 4px 0; }
    .theme-catalog-item {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 6px;
      border: 1px solid var(--nap-theme-border, #24243a);
      background: var(--nap-theme-surface-1, rgba(18, 18, 30, 0.72));
    }
    .theme-catalog-item[data-active='true'] { border-color: var(--nap-theme-primary-border, #39ff14); }
    .theme-swatch { display: flex; width: 34px; height: 24px; border: 1px solid var(--nap-theme-border, #3a3a5a); overflow: hidden; }
    .theme-swatch span { flex: 1; }
    .theme-catalog-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .theme-catalog-title { color: var(--nap-theme-text, #d6dae3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .theme-catalog-meta { color: var(--nap-theme-muted, #6c7486); font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
    .theme-apply-btn { padding: 4px 8px; font-size: 10px; }
  `;
  document.head.appendChild(style);
}

/**
 * Mount the host theme-switcher UI on the theme service topology card.
 *
 * Replicates full parity with the deleted theme-switcher napplet: Light/Dark/Custom
 * presets, color picker, Discover/Refresh button, WoT/Global filter checkboxes,
 * and the dynamic theme catalog with swatches and per-entry Apply buttons.
 *
 * @param options - Must include applyTheme (routes to host path), getHostPubkey,
 *   and subscribe (relay adapter injected by the caller from getRelayServiceHandler()).
 * @example
 * initThemeSwitcherHost({ applyTheme: (t) => preferences.applyTheme(t), getHostPubkey, subscribe });
 */
export function initThemeSwitcherHost(options: ThemeSwitcherHostOptions): void {
  injectStyle();

  // Locate mount target: .topology-node-content inside topology-node-service-theme.
  const themeNodeId = 'topology-node-service-theme';
  const themeServiceCard = document.getElementById(themeNodeId);
  if (!themeServiceCard) return;
  const nodeContent = themeServiceCard.querySelector('.topology-node-content');
  if (!nodeContent) return;

  // State
  let discoveredThemes: DiscoveredTheme[] = [];
  let activeThemeId: string | null = null;
  let discovering = false;

  // ── Build DOM ─────────────────────────────────────────────────────────────

  const toolbar = document.createElement('div');
  toolbar.className = 'theme-toolbar';

  // Discovery row: Refresh, WoT toggle, Global toggle, status
  const discoveryRow = document.createElement('div');
  discoveryRow.className = 'theme-row theme-row-wrap theme-discovery-row';

  const discoverBtn = document.createElement('button');
  discoverBtn.id = 'theme-discover-btn';
  discoverBtn.className = 'theme-btn';
  discoverBtn.type = 'button';
  discoverBtn.textContent = 'Refresh';

  const showWotLabel = document.createElement('label');
  showWotLabel.className = 'theme-toggle';
  const showWotEl = document.createElement('input');
  showWotEl.id = 'theme-show-wot';
  showWotEl.type = 'checkbox';
  showWotEl.checked = true;
  showWotLabel.appendChild(showWotEl);
  showWotLabel.appendChild(document.createTextNode(' WoT'));

  const showGlobalLabel = document.createElement('label');
  showGlobalLabel.className = 'theme-toggle';
  const showGlobalEl = document.createElement('input');
  showGlobalEl.id = 'theme-show-global';
  showGlobalEl.type = 'checkbox';
  showGlobalEl.checked = true;
  showGlobalLabel.appendChild(showGlobalEl);
  showGlobalLabel.appendChild(document.createTextNode(' Global'));

  const statusEl = document.createElement('span');
  statusEl.id = 'playground-host-theme-status';
  statusEl.textContent = 'connecting...';

  discoveryRow.append(discoverBtn, showWotLabel, showGlobalLabel, statusEl);

  // Preset buttons row
  const presetRow = document.createElement('div');
  presetRow.className = 'theme-row';

  const lightBtn = document.createElement('button');
  lightBtn.id = 'theme-light-btn';
  lightBtn.className = 'theme-btn';
  lightBtn.type = 'button';
  lightBtn.dataset['theme'] = 'light';
  lightBtn.textContent = 'Light';

  const darkBtn = document.createElement('button');
  darkBtn.id = 'theme-dark-btn';
  darkBtn.className = 'theme-btn';
  darkBtn.type = 'button';
  darkBtn.dataset['theme'] = 'dark';
  darkBtn.textContent = 'Dark';

  const customBtn = document.createElement('button');
  customBtn.id = 'theme-custom-btn';
  customBtn.className = 'theme-btn';
  customBtn.type = 'button';
  customBtn.dataset['theme'] = 'custom';
  customBtn.textContent = 'Custom';

  const customColorEl = document.createElement('input');
  customColorEl.id = 'playground-host-theme-custom-color';
  customColorEl.type = 'color';
  customColorEl.value = '#1a1a2e';

  presetRow.append(lightBtn, darkBtn, customBtn, customColorEl);

  toolbar.append(discoveryRow, presetRow);

  // Catalog list
  const catalogEl = document.createElement('ul');
  catalogEl.id = 'playground-host-theme-catalog';
  catalogEl.setAttribute('aria-label', 'Discovered themes');

  nodeContent.appendChild(toolbar);
  nodeContent.appendChild(catalogEl);

  const allPresetBtns = [lightBtn, darkBtn, customBtn];

  // ── Helpers ───────────────────────────────────────────────────────────────

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
      item.textContent = discoveredThemes.length > 0
        ? 'No themes visible with current filters.'
        : 'No discovered themes yet.';
      catalogEl.appendChild(item);
      return;
    }

    for (const entry of themes) {
      const item = document.createElement('li');
      item.className = 'theme-catalog-item';
      item.dataset['source'] = entry.source;
      item.dataset['active'] = entry.id === activeThemeId ? 'true' : 'false';

      const body = document.createElement('div');
      body.className = 'theme-catalog-body';

      const titleEl = document.createElement('span');
      titleEl.className = 'theme-catalog-title';
      titleEl.textContent = entry.title;

      const meta = document.createElement('span');
      meta.className = 'theme-catalog-meta';
      meta.textContent = `${sourceLabel(entry.source)} · ${entry.eventKind}`;

      body.append(titleEl, meta);

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'theme-btn theme-apply-btn';
      applyBtn.textContent = entry.id === activeThemeId ? 'Active' : 'Apply';
      applyBtn.disabled = entry.id === activeThemeId;
      applyBtn.addEventListener('click', () => {
        activeThemeId = entry.id;
        clearPresetActive();
        applyPayload(entry.theme);
        renderCatalog();
      });

      item.append(renderSwatch(entry.theme), body, applyBtn);
      catalogEl.appendChild(item);
    }
  }

  // ── Active-state helpers ─────────────────────────────────────────────────

  function setActive(target: HTMLButtonElement): void {
    activeThemeId = null;
    for (const btn of allPresetBtns) {
      btn.dataset['active'] = btn === target ? 'true' : 'false';
    }
    renderCatalog();
  }

  function clearPresetActive(): void {
    for (const btn of allPresetBtns) btn.dataset['active'] = 'false';
  }

  function syncThemeSelection(theme: PlaygroundTheme): void {
    const normalizedTitle = theme.title?.trim().toLowerCase();
    if (normalizedTitle === 'light') { setActive(lightBtn); return; }
    if (normalizedTitle === 'dark') { setActive(darkBtn); return; }

    activeThemeId = null;
    clearPresetActive();
    customBtn.dataset['active'] = 'true';
    customColorEl.value = theme.colors.background;
    renderCatalog();
  }

  // ── Theme application ────────────────────────────────────────────────────

  function applyPayload(theme: ThemePayload): void {
    options.applyTheme({
      title: theme.title ?? 'Custom',
      colors: {
        background: theme.colors.background,
        text: theme.colors.text,
        primary: theme.colors.primary,
      },
    });
  }

  // ── Discovery ────────────────────────────────────────────────────────────

  async function refreshDiscoveredThemes(): Promise<void> {
    if (discovering) return;
    discovering = true;
    discoverBtn.disabled = true;
    setStatus('discovering', 'gray');
    renderCatalog();

    try {
      const result = await discoverThemeCatalog({
        readPublicKey: async () => options.getHostPubkey(),
        subscribe: options.subscribe,
      });
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

  // ── Button handlers ──────────────────────────────────────────────────────

  lightBtn.addEventListener('click', () => {
    setActive(lightBtn);
    options.applyTheme(LIGHT_THEME);
  });

  darkBtn.addEventListener('click', () => {
    setActive(darkBtn);
    options.applyTheme(DARK_THEME);
  });

  customBtn.addEventListener('click', () => {
    setActive(customBtn);
    const bg = customColorEl.value || '#1a1a2e';
    options.applyTheme({ title: 'Custom', colors: { background: bg, text: '#e0e0e0', primary: '#7aa2f7' } });
  });

  discoverBtn.addEventListener('click', () => { void refreshDiscoveredThemes(); });

  showWotEl.addEventListener('change', () => {
    renderCatalog();
    setStatus(`ready (${visibleThemes().length} visible)`, 'green');
  });

  showGlobalEl.addEventListener('change', () => {
    renderCatalog();
    setStatus(`ready (${visibleThemes().length} visible)`, 'green');
  });

  // ── Init ─────────────────────────────────────────────────────────────────

  syncThemeSelection(DARK_THEME);
  setStatus('ready', 'green');
  renderCatalog();
  void refreshDiscoveredThemes();
}

/**
 * Build a ThemeRelaySubscribe adapter that wraps a relay ServiceHandler.
 *
 * Routes relay.subscribe / relay.event / relay.eose / relay.close through the
 * host relay service's handleMessage interface, giving the discovery module a
 * standard ThemeRelaySubscribe signature without touching the napplet SDK.
 *
 * @param getHandler - Lazy getter returning the relay ServiceHandler (null before boot).
 * @returns A ThemeRelaySubscribe function suitable for discoverThemeCatalog.
 * @example
 * const subscribe = buildHostRelaySubscribe(() => getRelayServiceHandler());
 */
export function buildHostRelaySubscribe(
  getHandler: () => ServiceHandler | null,
): ThemeRelaySubscribe {
  return (filters: NostrFilter | NostrFilter[], onEvent: (event: NostrEvent) => void, onEose: () => void) => {
    const handler = getHandler();
    const subId = `host-theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const HOST_WINDOW_ID = '__host_theme_discovery__';

    function noop(): void { /* no-op */ }

    if (!handler) {
      queueMicrotask(onEose);
      return { close() { /* noop */ } };
    }

    function send(msg: NappletMessage): void {
      const m = msg as { type?: string; event?: unknown };
      if (m.type === 'relay.event') {
        onEvent(m.event as NostrEvent);
      } else if (m.type === 'relay.eose') {
        onEose();
      }
    }

    handler.handleMessage(
      HOST_WINDOW_ID,
      { type: 'relay.subscribe', subId, filters } as unknown as NappletMessage,
      send,
    );

    return {
      close() {
        handler.handleMessage(
          HOST_WINDOW_ID,
          { type: 'relay.close', subId } as unknown as NappletMessage,
          noop as (msg: NappletMessage) => void,
        );
      },
    };
  };
}
