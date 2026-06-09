import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';

const DEFAULT_NAP_THEME: Theme = {
  colors: {
    background: '#0a0a0f',
    text: '#e0e0e0',
    primary: '#39ff14',
  },
};

const themeListeners = new Set<(theme: Theme) => void>();
const SUPPORTS_ALIAS_MARK = '__kehtoNapSupportsAlias';
let themeStyleInstalled = false;
let themeMessageListenerInstalled = false;
let supportsAliasListenerInstalled = false;

type SupportsFn = ((capability: string) => boolean) & {
  __kehtoNapSupportsAlias?: true;
};

interface NappletWindow extends Window {
  napplet?: {
    shell?: {
      supports?: SupportsFn;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isTheme(value: unknown): value is Theme {
  if (!isRecord(value)) return false;
  const colors = value.colors;
  return isRecord(colors) &&
    typeof colors.background === 'string' &&
    typeof colors.text === 'string' &&
    typeof colors.primary === 'string';
}

function isThemeChangedMessage(value: unknown): value is ThemeChangedMessage {
  if (!isRecord(value)) return false;
  if (value.type !== 'theme.changed') return false;
  return isTheme(value.theme);
}

function ensureThemeStyle(): void {
  if (themeStyleInstalled) return;
  themeStyleInstalled = true;

  const style = document.createElement('style');
  style.id = 'kehto-nap-theme-style';
  style.textContent = `
a {
  color: var(--nap-theme-primary, #39ff14);
}

input,
textarea,
select,
button {
  color: inherit;
}
`;
  document.head.appendChild(style);
}

function ensureThemeMessageListener(): void {
  if (themeMessageListenerInstalled) return;
  themeMessageListenerInstalled = true;

  // Phase 58 raw-envelope allowlist: theme.changed is a shell push and the
  // published helper surface does not expose a subscribe API yet.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!isRecord(data)) return;
    if (data.type !== 'theme.changed') return;
    if (!isThemeChangedMessage(data)) return;

    ensureThemeStyle();
    applyNapTheme(data.theme);
    for (const listener of themeListeners) {
      listener(data.theme);
    }
  });
}

function patchNapSupportsAlias(): void {
  const supports = (window as NappletWindow).napplet?.shell?.supports;
  if (typeof supports !== 'function' || supports[SUPPORTS_ALIAS_MARK]) return;

  const next: SupportsFn = (capability: string) => {
    if (typeof capability === 'string' && capability.startsWith('nap:')) {
      const domain = capability.slice(4);
      return supports(domain) || supports(`nub:${domain}`);
    }
    return supports(capability);
  };
  next[SUPPORTS_ALIAS_MARK] = true;
  (window as NappletWindow).napplet!.shell!.supports = next;
}

function ensureSupportsAliasListener(): void {
  if (supportsAliasListenerInstalled) return;
  supportsAliasListenerInstalled = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!isRecord(data)) return;
    if (data.type !== 'shell.init') return;
    window.setTimeout(patchNapSupportsAlias, 0);
  });
}

function installNapSupportsAlias(): void {
  ensureSupportsAliasListener();

  patchNapSupportsAlias();
  queueMicrotask(patchNapSupportsAlias);
  window.setTimeout(patchNapSupportsAlias, 0);
  window.setTimeout(patchNapSupportsAlias, 50);
  window.setTimeout(patchNapSupportsAlias, 250);
}

export function applyNapTheme(theme: Theme): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--nap-theme-background', theme.colors.background);
  rootStyle.setProperty('--nap-theme-text', theme.colors.text);
  rootStyle.setProperty('--nap-theme-primary', theme.colors.primary);

  document.body.style.setProperty('background', theme.colors.background, 'important');
  document.body.style.setProperty('background-color', theme.colors.background, 'important');
  document.body.style.setProperty('color', theme.colors.text, 'important');
}

export function onNapThemeChanged(listener: (theme: Theme) => void): () => void {
  ensureThemeMessageListener();
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function installNapTheme(): void {
  installNapSupportsAlias();
  ensureThemeStyle();
  applyNapTheme(DEFAULT_NAP_THEME);
  ensureThemeMessageListener();
}
