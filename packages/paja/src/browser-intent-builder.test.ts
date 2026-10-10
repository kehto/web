import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaIntentLinkBuilder } from './browser-intent-builder.js';
import { createPajaIntentLinkReviewController } from './browser-intent-links.js';
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
  it('launches a reviewed link from its Launch click and keeps progress visible', async () => {
    const document = installDocument();
    const add = (id: string, tagName: string) => {
      const element = document.createElement(tagName);
      element.id = id;
      document.body.append(element);
      return element;
    };
    add('paja-intent-link-dialog', 'dialog');
    add('paja-intent-link-uri', 'input');
    add('paja-intent-link-payload', 'textarea');
    add('paja-intent-link-target', 'div');
    const status = add('paja-intent-link-status', 'div');
    add('paja-intent-link-cancel', 'button');
    const launch = add('paja-intent-link-launch', 'button');
    add('paja-intent-link-retry', 'button');
    add('paja-intent-link-choose', 'button');
    add('paja-intent-link-handler', 'select');
    add('paja-intent-link-use-handler', 'button');
    add('paja-intent-link-save-default', 'input');
    const review = createPajaIntentLinkReviewController(document as unknown as Document)!;
    const onLaunch = vi.fn(async (_intent, progress) => { progress.accepted(); });
    void review.review(parsePajaIntentLink('https://paja.example/?intent=napplet%3Anote%2Fopen')!, onLaunch);

    launch.dispatch('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(onLaunch).toHaveBeenCalledOnce();
    expect(status.textContent).toContain('Accepted');
    review.dispose();
  });

  it('preserves advertised parameter order, omitted fields, explicit empty fields, and custom fields without invoking on edit', () => {
    const document = installDocument();
    const onTest = vi.fn();
    const builder = createPajaIntentLinkBuilder({ onTest, href: () => 'https://paja.example/' });
    builder.open(target([{ slug: 'note', convention: 'napplet:note/open', params: ['first', 'second'] }]));

    expect(onTest).not.toHaveBeenCalled();
    const first = findAttribute(document, 'aria-label', 'first value');
    const second = findAttribute(document, 'aria-label', 'second value');
    expect(walk(document.body).filter((element) => element.attributes.get('aria-label')?.endsWith('value')).map((element) => element.attributes.get('aria-label')))
      .toEqual(['first value', 'second value']);
    const secondIncluded = walk(second.parent!).find((element) => element.type === 'checkbox')!;
    secondIncluded.checked = false;
    findSuffix(document, '-add-parameter').dispatch('click');
    const name = findAttribute(document, 'aria-label', 'Parameter name');
    name.value = 'custom';
    const custom = findAttribute(document, 'aria-label', 'Custom value');
    custom.value = 'value';
    first.value = '';
    findSuffix(document, '-parameters').dispatch('input');
    expect(onTest).not.toHaveBeenCalled();

    findSuffix(document, '-test').dispatch('click');
    expect(onTest).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ payload: { first: '', custom: 'value' } }),
    }));
  });

  it('uses JSON payload mode for an empty contract and keeps routing explicit', () => {
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

    expect(onTest).toHaveBeenCalledWith(expect.objectContaining({
      payload: null,
      request: expect.objectContaining({ payload: null, handlerHint: expect.objectContaining({ address: `35129:${'a'.repeat(64)}:viewer` }) }),
    }));
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
