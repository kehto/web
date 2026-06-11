export type Theme = {
  colors: {
    background: string;
    text: string;
    primary: string;
  };
};

export type ThemeChangedMessage = {
  type: 'theme.changed';
  theme: Theme;
};

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
let currentTheme: Theme = DEFAULT_NAP_THEME;

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

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16);
    const g = Number.parseInt(normalized[1] + normalized[1], 16);
    const b = Number.parseInt(normalized[2] + normalized[2], 16);
    return [r, g, b];
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampByte(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  if (!leftRgb || !rightRgb) return left;

  const weight = Math.min(1, Math.max(0, ratio));
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

function setThemeVariable(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value);
}

function applySemanticThemeVariables(theme: Theme): void {
  const background = theme.colors.background;
  const text = theme.colors.text;
  const primary = theme.colors.primary;
  const isLight = relativeLuminance(background) > 0.35;

  setThemeVariable('--nap-theme-background', background);
  setThemeVariable('--nap-theme-text', text);
  setThemeVariable('--nap-theme-primary', primary);
  setThemeVariable('--nap-theme-surface-1', mixHexColors(background, text, isLight ? 0.08 : 0.12));
  setThemeVariable('--nap-theme-surface-2', mixHexColors(background, text, isLight ? 0.12 : 0.18));
  setThemeVariable('--nap-theme-surface-3', mixHexColors(background, text, isLight ? 0.18 : 0.24));
  setThemeVariable('--nap-theme-border', mixHexColors(background, text, isLight ? 0.22 : 0.30));
  setThemeVariable('--nap-theme-muted', mixHexColors(text, background, isLight ? 0.38 : 0.55));
  setThemeVariable('--nap-theme-primary-soft', mixHexColors(background, primary, isLight ? 0.18 : 0.14));
  setThemeVariable('--nap-theme-primary-border', mixHexColors(background, primary, isLight ? 0.40 : 0.32));
  setThemeVariable('--nap-theme-primary-text', mixHexColors(primary, background, isLight ? 0.18 : 0.12));
  setThemeVariable('--nap-theme-success', '#39ff14');
  setThemeVariable('--nap-theme-warning', '#ffbf00');
  setThemeVariable('--nap-theme-danger', '#ff3b3b');
  setThemeVariable('--nap-theme-info', '#62d0ff');
  setThemeVariable('--nap-theme-accent-secondary', '#b388ff');
  setThemeVariable('--nap-theme-color-scheme', isLight ? 'light' : 'dark');
  document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
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
    currentTheme = data.theme;
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

function readHostThemeSnapshot(): Theme | null {
  try {
    const parentWindow = window.parent as Window & { __kehtoCurrentTheme?: unknown };
    if (!parentWindow || parentWindow === window) return null;
    const hostTheme = parentWindow.__kehtoCurrentTheme;
    return isTheme(hostTheme) ? hostTheme : null;
  } catch {
    return null;
  }
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
  currentTheme = theme;
  applySemanticThemeVariables(theme);
  document.body.style.setProperty('background', theme.colors.background, 'important');
  document.body.style.setProperty('background-color', theme.colors.background, 'important');
  document.body.style.setProperty('color', theme.colors.text, 'important');
}

export function onNapThemeChanged(listener: (theme: Theme) => void): () => void {
  ensureThemeMessageListener();
  const hostTheme = readHostThemeSnapshot();
  if (hostTheme) currentTheme = hostTheme;
  themeListeners.add(listener);
  listener(currentTheme);
  return () => {
    themeListeners.delete(listener);
  };
}

export function installNapTheme(): void {
  installNapSupportsAlias();
  ensureThemeStyle();
  const hostTheme = readHostThemeSnapshot();
  applyNapTheme(hostTheme ?? DEFAULT_NAP_THEME);
  ensureThemeMessageListener();
}
