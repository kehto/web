import { describe, expect, it } from 'vitest';

import {
  createPajaConsolePanel,
  PAJA_CONSOLE_COLLAPSE_LABEL,
  PAJA_CONSOLE_EXPAND_LABEL,
  PAJA_CONSOLE_PANEL_DATASET_KEY,
  PAJA_CONSOLE_PANEL_STORAGE_KEY,
  PAJA_CONSOLE_TOGGLE_ID,
  parsePajaConsolePanelState,
  type PajaConsolePanelDocument,
  type PajaConsolePanelElement,
} from './browser-console-panel.js';

class FakeElement implements PajaConsolePanelElement {
  readonly dataset: Record<string, string | undefined> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Set<() => void>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(_type: 'click', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'click', listener: () => void): void {
    this.listeners.delete(listener);
  }

  click(): void {
    for (const listener of [...this.listeners]) listener();
  }

  attribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeDocument implements PajaConsolePanelDocument {
  readonly documentElement = new FakeElement();
  readonly roots = new Map<string, FakeElement>([[PAJA_CONSOLE_TOGGLE_ID, new FakeElement()]]);

  getElementById(id: string): FakeElement | null {
    return this.roots.get(id) ?? null;
  }
}

class FakeStorage implements Storage {
  readonly records = new Map<string, string>();
  writes = 0;
  throwOnWrite = false;

  get length(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
  getItem(key: string): string | null { return this.records.get(key) ?? null; }
  key(index: number): string | null { return [...this.records.keys()][index] ?? null; }
  removeItem(key: string): void { this.records.delete(key); }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('storage denied');
    this.writes += 1;
    this.records.set(key, value);
  }
}

function createHarness(storage = new FakeStorage()): {
  readonly document: FakeDocument;
  readonly root: FakeElement;
  readonly button: FakeElement;
  readonly storage: FakeStorage;
} {
  const document = new FakeDocument();
  const button = document.roots.get(PAJA_CONSOLE_TOGGLE_ID)!;
  return { document, root: document.documentElement, button, storage };
}

describe('@kehto/paja console panel', () => {
  it('treats every unrecognized stored preference as expanded', () => {
    expect(parsePajaConsolePanelState(null)).toBe('expanded');
    expect(parsePajaConsolePanelState(undefined)).toBe('expanded');
    expect(parsePajaConsolePanelState('')).toBe('expanded');
    expect(parsePajaConsolePanelState('Expanded')).toBe('expanded');
    expect(parsePajaConsolePanelState('collapsed ')).toBe('expanded');
    expect(parsePajaConsolePanelState('collapsed')).toBe('collapsed');
  });

  it('expands by default and collapses to the left through the toggle button', () => {
    const harness = createHarness();
    const panel = createPajaConsolePanel({
      document: harness.document,
      storage: harness.storage,
    });

    expect(panel.getState()).toBe('expanded');
    expect(harness.root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('expanded');
    expect(harness.button.attribute('aria-expanded')).toBe('true');
    expect(harness.button.attribute('aria-label')).toBe(PAJA_CONSOLE_COLLAPSE_LABEL);
    expect(harness.storage.records.get(PAJA_CONSOLE_PANEL_STORAGE_KEY)).toBeUndefined();
    expect(harness.storage.writes).toBe(0);

    harness.button.click();

    expect(panel.getState()).toBe('collapsed');
    expect(harness.root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('collapsed');
    expect(harness.button.attribute('aria-expanded')).toBe('false');
    expect(harness.button.attribute('aria-label')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
    expect(harness.button.attribute('title')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
    expect(harness.storage.records.get(PAJA_CONSOLE_PANEL_STORAGE_KEY)).toBe('collapsed');

    harness.button.click();

    expect(panel.getState()).toBe('expanded');
    expect(harness.root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('expanded');
    expect(harness.button.attribute('aria-expanded')).toBe('true');
    expect(harness.button.attribute('aria-label')).toBe(PAJA_CONSOLE_COLLAPSE_LABEL);
    expect(harness.storage.records.get(PAJA_CONSOLE_PANEL_STORAGE_KEY)).toBe('expanded');
  });

  it('restores a collapsed console from browser storage on the next host load', () => {
    const storage = new FakeStorage();
    storage.setItem(PAJA_CONSOLE_PANEL_STORAGE_KEY, 'collapsed');

    const harness = createHarness(storage);
    const panel = createPajaConsolePanel({ document: harness.document, storage });

    expect(panel.getState()).toBe('collapsed');
    expect(harness.root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('collapsed');
    expect(harness.button.attribute('aria-expanded')).toBe('false');
    expect(harness.button.attribute('aria-label')).toBe(PAJA_CONSOLE_EXPAND_LABEL);
  });

  it('keeps collapsing in-session when preference storage refuses the write', () => {
    const harness = createHarness();
    harness.storage.throwOnWrite = true;
    const panel = createPajaConsolePanel({ document: harness.document, storage: harness.storage });

    harness.button.click();

    expect(panel.getState()).toBe('collapsed');
    expect(harness.root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('collapsed');
  });

  it('stops toggling after disposal and stays safe without a host button', () => {
    const harness = createHarness();
    const panel = createPajaConsolePanel({ document: harness.document, storage: harness.storage });

    expect(harness.button.listeners.size).toBe(1);
    harness.button.click();
    expect(panel.getState()).toBe('collapsed');

    panel.dispose();

    expect(harness.button.listeners.size).toBe(0);
    harness.button.click();
    expect(panel.getState()).toBe('collapsed');

    const documentWithoutButton = new FakeDocument();
    documentWithoutButton.roots.delete(PAJA_CONSOLE_TOGGLE_ID);
    const orphan = createPajaConsolePanel({ document: documentWithoutButton, storage: null });

    expect(orphan.getState()).toBe('expanded');
    expect(orphan.toggle()).toBe('collapsed');
    expect(documentWithoutButton.documentElement.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY]).toBe('collapsed');
  });
});
