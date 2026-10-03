import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  installPajaConsolePanel,
  PAJA_CONSOLE_COLLAPSE_LABEL,
  PAJA_CONSOLE_EXPAND_LABEL,
  PAJA_CONSOLE_PANEL_STORAGE_KEY,
  PAJA_CONSOLE_TOGGLE_ID,
} from './browser-console-panel.js';

function createHarness(preference: string | null = null): {
  root: { dataset: Record<string, string> };
  button: EventTarget;
  attributes: Map<string, string>;
  storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
} {
  const root = { dataset: {} as Record<string, string> };
  const attributes = new Map<string, string>();
  const button = Object.assign(new EventTarget(), {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  });
  const storage = { getItem: vi.fn(() => preference), setItem: vi.fn() };
  vi.stubGlobal('document', {
    documentElement: root,
    getElementById: (id: string) => id === PAJA_CONSOLE_TOGGLE_ID ? button : null,
  });
  vi.stubGlobal('localStorage', storage);
  return { root, button, attributes, storage };
}

const click = (button: EventTarget): boolean => button.dispatchEvent(new Event('click'));

afterEach(() => vi.unstubAllGlobals());

describe('@kehto/paja console panel', () => {
  it.each([null, '', 'Expanded', 'collapsed ', 'expanded'])('starts expanded for preference %s', (value) => {
    const { root, attributes, storage } = createHarness(value);
    installPajaConsolePanel();
    expect(root.dataset.pajaConsole).toBe('expanded');
    expect(attributes.get('aria-expanded')).toBe('true');
    expect(attributes.get('aria-label')).toBe(PAJA_CONSOLE_COLLAPSE_LABEL);
    expect(storage.getItem).toHaveBeenCalledWith(PAJA_CONSOLE_PANEL_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('collapses, persists, restores, and detaches the listener', () => {
    const { root, button, attributes, storage } = createHarness();
    const dispose = installPajaConsolePanel();
    click(button);
    expect(root.dataset.pajaConsole).toBe('collapsed');
    expect(attributes.get('aria-expanded')).toBe('false');
    expect(attributes.get('aria-label')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
    expect(attributes.get('title')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
    expect(storage.setItem).toHaveBeenLastCalledWith(PAJA_CONSOLE_PANEL_STORAGE_KEY, 'collapsed');

    click(button);
    expect(root.dataset.pajaConsole).toBe('expanded');
    expect(attributes.get('aria-expanded')).toBe('true');
    expect(attributes.get('aria-label')).toBe(PAJA_CONSOLE_COLLAPSE_LABEL);
    expect(attributes.get('title')).toBe(PAJA_CONSOLE_COLLAPSE_LABEL);
    expect(storage.setItem).toHaveBeenLastCalledWith(PAJA_CONSOLE_PANEL_STORAGE_KEY, 'expanded');

    dispose();
    click(button);
    expect(root.dataset.pajaConsole).toBe('expanded');
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it('restores a collapsed preference without rewriting storage', () => {
    const { root, attributes, storage } = createHarness('collapsed');
    installPajaConsolePanel();
    expect(root.dataset.pajaConsole).toBe('collapsed');
    expect(attributes.get('aria-expanded')).toBe('false');
    expect(attributes.get('aria-label')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps toggling when storage reads and writes throw', () => {
    const { root, button, storage } = createHarness();
    const denied = (): never => { throw new Error('storage denied'); };
    storage.getItem.mockImplementation(denied);
    storage.setItem.mockImplementation(denied);
    installPajaConsolePanel();
    expect(root.dataset.pajaConsole).toBe('expanded');
    click(button);
    expect(root.dataset.pajaConsole).toBe('collapsed');
    click(button);
    expect(root.dataset.pajaConsole).toBe('expanded');
  });

  it('tolerates an inaccessible storage global', () => {
    const { root, button } = createHarness();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage denied'); },
    });
    installPajaConsolePanel();
    click(button);
    expect(root.dataset.pajaConsole).toBe('collapsed');
  });

  it('is safe to install and dispose without a toggle button', () => {
    const { root } = createHarness();
    vi.stubGlobal('document', { documentElement: root, getElementById: () => null });
    const dispose = installPajaConsolePanel();
    expect(root.dataset.pajaConsole).toBe('expanded');
    expect(dispose).not.toThrow();
  });
});
