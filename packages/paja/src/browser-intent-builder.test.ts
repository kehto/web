import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaIntentLinkBuilder } from './browser-intent-builder.js';
import { createPajaIntentLinkController } from './browser-intent-links.js';
import { parsePajaIntentLink } from './intent-link.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  id = '';
  className = '';
  textContent = '';
  htmlFor = '';
  type = '';
  value = '';
  placeholder = '';
  readOnly = false;
  rows = 0;
  spellcheck = false;
  checked = false;
  disabled = false;
  open = false;
  hidden = false;
  selected = false;

  constructor(readonly tagName: string, private readonly owner: FakeDocument) {}

  append(...items: FakeElement[]): void {
    for (const item of items) {
      item.parent = this;
      this.children.push(item);
      if (this.tagName === 'select' && item.tagName === 'option' && !this.value) this.value = item.value;
    }
  }

  replaceChildren(...items: FakeElement[]): void {
    this.children.length = 0;
    this.append(...items);
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ preventDefault() {} } as Event);
  }

  querySelector(selector: string): FakeElement | null {
    return walk(this).find((child) => child.tagName === selector) ?? null;
  }

  focus(): void { this.owner.activeElement = this; }
  select(): void { this.selected = true; }
  showModal(): void { this.open = true; }
  close(): void { this.open = false; }
}

class FakeDocument {
  readonly body = new FakeElement('body', this);
  readonly documentElement = this.body;
  activeElement: FakeElement | null = null;
  createElement(name: string): FakeElement { return new FakeElement(name, this); }
  getElementById(id: string): FakeElement | null {
    return walk(this.body).find((element) => element.id === id) ?? null;
  }
}

function walk(root: FakeElement): FakeElement[] {
  return root.children.flatMap((child) => [child, ...walk(child)]);
}

function findSuffix(document: FakeDocument, suffix: string): FakeElement {
  const found = walk(document.body).find((element) => element.id.endsWith(suffix));
  if (!found) throw new Error(`missing ${suffix}`);
  return found;
}

function findAttribute(document: FakeDocument, name: string, value: string): FakeElement {
  const found = walk(document.body).find((element) => element.attributes.get(name) === value);
  if (!found) throw new Error(`missing ${name}=${value}`);
  return found;
}

function target(archetypes: Array<{ slug: string; convention: string; params: string[] }>): PajaResolvedPointer {
  return {
    pointer: { type: 'naddr', value: 'naddr1verified', identifier: 'viewer', pubkey: 'a'.repeat(64), kind: 35129, relays: ['wss://relay.example'] },
    event: { id: 'f'.repeat(64), pubkey: 'a'.repeat(64), kind: 35129 } as PajaResolvedPointer['event'],
    relays: ['wss://relay.example'],
    blossomServers: [],
    dTag: 'viewer',
    aggregateHash: 'b'.repeat(64),
    indexHtml: '<html></html>',
    manifest: { archetypes, dTag: 'viewer', kind: 35129, pubkey: 'a'.repeat(64) } as PajaResolvedPointer['manifest'],
  };
}

function installDocument(): FakeDocument {
  const document = new FakeDocument();
  vi.stubGlobal('document', document);
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('HTMLDialogElement', FakeElement);
  vi.stubGlobal('HTMLInputElement', FakeElement);
  vi.stubGlobal('HTMLTextAreaElement', FakeElement);
  vi.stubGlobal('HTMLButtonElement', FakeElement);
  vi.stubGlobal('HTMLSelectElement', FakeElement);
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  return document;
}

afterEach(() => vi.unstubAllGlobals());

describe('Paja intent-link builder', () => {
  function linkControls() {
    const document = installDocument();
    for (const [suffix, tag] of [
      ['dialog', 'dialog'], ['title', 'div'], ['copy', 'div'], ['apps', 'div'],
      ['save-default', 'input'], ['cancel', 'button'], ['notice', 'div'],
      ['status', 'div'], ['retry', 'button'], ['dismiss', 'button'],
    ]) {
      const element = document.createElement(tag);
      element.id = `paja-intent-link-${suffix}`;
      document.body.append(element);
    }
    return document;
  }

  it('opens shared content directly and hides progress after delivery', async () => {
    const document = linkControls();
    const consumed = vi.fn();
    const links = createPajaIntentLinkController(document as unknown as Document, { onAccepted: consumed })!;
    const onLaunch = vi.fn(async (_intent, progress) => { progress.accepted(); });
    const link = parsePajaIntentLink('https://paja.example/?intent=napplet%3Anote%2Fopen&payload=null')!;
    links.open(link, onLaunch);
    await Promise.resolve();
    expect(onLaunch).toHaveBeenCalledOnce();
    expect(onLaunch.mock.calls[0][0]).toBe(link);
    expect(findSuffix(document, '-dialog').open).toBe(false);
    const progress = onLaunch.mock.calls[0][1];
    progress.delivered();
    progress.accepted();
    expect(findSuffix(document, '-notice').hidden).toBe(true);
    expect(consumed).toHaveBeenCalledOnce();
    links.dispose();
  });

  it('offers named apps for a conflict and changes preferences only when checked', async () => {
    const document = linkControls();
    const setDefault = vi.fn();
    const links = createPajaIntentLinkController(document as unknown as Document, { setDefault })!;
    const onLaunch = vi.fn(async (_intent, _progress) => {});
    links.open(parsePajaIntentLink('https://paja.example/?intent=napplet%3Anote%2Fopen')!, onLaunch);
    await Promise.resolve();
    const progress = onLaunch.mock.calls[0][1];
    const choose = progress.chooseConflict({ id: 'saved', title: 'My Reader' }, { id: 'shared', title: 'Shared Reader' });
    expect(findSuffix(document, '-dialog').open).toBe(true);
    expect(findSuffix(document, '-copy').textContent).toBe('This link uses Shared Reader. Your saved preference is My Reader.');
    const apps = findSuffix(document, '-apps');
    expect(apps.children.map((app) => app.textContent)).toEqual(['Open with My Reader', 'Open with Shared Reader']);
    apps.children[1].dispatch('click');
    await expect(choose).resolves.toBe('shared');
    expect(setDefault).not.toHaveBeenCalled();
    expect(findSuffix(document, '-dialog').open).toBe(false);

    const again = progress.chooseConflict({ id: 'saved', title: 'My Reader' }, { id: 'shared', title: 'Shared Reader' });
    findSuffix(document, '-save-default').checked = true;
    apps.children[1].dispatch('click');
    await expect(again).resolves.toBe('shared');
    expect(setDefault).toHaveBeenCalledWith('note', 'shared');
    links.dispose();
  });

  it('cancels pending conflict choices and ignores late delivery progress', async () => {
    const document = linkControls();
    const consumed = vi.fn();
    const links = createPajaIntentLinkController(document as unknown as Document, { onAccepted: consumed })!;
    const onLaunch = vi.fn(async (_intent, _progress) => {});
    links.open(parsePajaIntentLink('https://paja.example/?intent=napplet%3Anote%2Fopen')!, onLaunch);
    await Promise.resolve();
    const progress = onLaunch.mock.calls[0][1];
    const choice = progress.chooseConflict({ id: 'saved', title: 'My Reader' }, { id: 'shared', title: 'Shared Reader' });
    findSuffix(document, '-dialog').dispatch('cancel');
    await expect(choice).resolves.toBeUndefined();
    expect(progress.isActive()).toBe(false);
    progress.delivered();
    expect(consumed).not.toHaveBeenCalled();
    expect(findSuffix(document, '-notice').hidden).toBe(true);
    links.dispose();
  });

  it('omits untouched parameters, includes typed or explicitly empty fields, and preserves advertised order', async () => {
    const document = installDocument();
    const onTest = vi.fn();
    const builder = createPajaIntentLinkBuilder({ onTest, href: () => 'https://paja.example/' });
    builder.open(target([{ slug: 'note', convention: 'napplet:note/open', params: ['first', 'second', 'third'] }]));

    expect(onTest).not.toHaveBeenCalled();
    expect(findSuffix(document, '-url').value).toContain('intent=napplet%3Anote%2Fopen');
    const first = findAttribute(document, 'aria-label', 'first value');
    const second = findAttribute(document, 'aria-label', 'second value');
    expect(findAttribute(document, 'aria-label', 'Include first').checked).toBe(false);
    const firstIncluded = walk(first.parent!).find((element) => element.type === 'checkbox')!;
    firstIncluded.checked = true;
    second.value = 'typed';
    second.dispatch('input');
    findSuffix(document, '-add-parameter').dispatch('click');
    const name = findAttribute(document, 'aria-label', 'Parameter name');
    name.value = 'custom';
    name.dispatch('input');
    const custom = findAttribute(document, 'aria-label', 'custom value');
    custom.value = 'value';
    custom.dispatch('input');
    expect(onTest).not.toHaveBeenCalled();

    findSuffix(document, '-test').dispatch('click');
    await Promise.resolve();
    expect(onTest).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ payload: { first: '', second: 'typed', custom: 'value' } }),
    }));
  });

  it('uses JSON payload mode for an empty contract and keeps routing explicit', async () => {
    const document = installDocument();
    const onTest = vi.fn();
    const builder = createPajaIntentLinkBuilder({ onTest, href: () => 'https://paja.example/' });
    builder.open(target([{ slug: 'note', convention: 'napplet:note/open', params: [] }]));

    const mode = findSuffix(document, '-payload-mode');
    mode.value = 'json';
    mode.dispatch('change');
    const json = findSuffix(document, '-json-payload');
    json.value = 'null';
    json.dispatch('input');
    const routing = findSuffix(document, '-routing');
    routing.value = 'recommend';
    routing.dispatch('change');
    findSuffix(document, '-test').dispatch('click');
    await Promise.resolve();

    expect(onTest).toHaveBeenCalledWith(expect.objectContaining({
      payload: null,
      request: expect.objectContaining({ payload: null, handlerHint: expect.objectContaining({ address: `35129:${'a'.repeat(64)}:viewer` }) }),
    }));
  });

  it('reopens with a visible error when the explicit Test callback throws', async () => {
    const document = installDocument();
    const builder = createPajaIntentLinkBuilder({
      onTest: () => { throw new Error('Launch denied'); },
      href: () => 'https://paja.example/',
    });
    builder.open(target([{ slug: 'note', convention: 'napplet:note/open', params: [] }]));

    findSuffix(document, '-test').dispatch('click');
    await Promise.resolve();
    await Promise.resolve();

    expect(findSuffix(document, '-dialog').open).toBe(true);
    expect(findSuffix(document, '-status').textContent).toBe('Launch denied');
  });

  it('keeps copy as a local selection fallback and no-ops safely without advertisements', async () => {
    const document = installDocument();
    const builder = createPajaIntentLinkBuilder({ onTest: vi.fn(), href: () => 'https://paja.example/' });
    const noIntents = target([]);
    builder.open(noIntents);
    expect(walk(document.body).some((element) => element.tagName === 'dialog' && element.open)).toBe(false);

    builder.open(target([{ slug: 'note', convention: 'napplet:note/open', params: [] }]));
    findSuffix(document, '-copy').dispatch('click');
    await Promise.resolve();
    expect(findSuffix(document, '-url').selected).toBe(true);
    expect(findSuffix(document, '-status').textContent).toBe('Copy the selected link.');
  });
});
