import type { NappletMessage } from '@napplet/core';
import { createConfigService } from '@kehto/services';
import { describe, expect, it } from 'vitest';
import { createPajaConfigController } from './browser-config.js';
import { createPajaAdapter } from './browser-adapter.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly listeners = new Map<string, Set<() => void>>();
  className = '';
  textContent = '';
  type = '';
  value = '';
  step = '';
  min = '';
  max = '';
  minLength = 0;
  maxLength = 0;
  rows = 0;
  required = false;
  checked = false;
  selected = false;
  open = false;
  closeCalls = 0;

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  close(): void {
    this.closeCalls += 1;
    this.open = false;
  }

  showModal(): void {
    this.open = true;
  }

  find(predicate: (element: FakeElement) => boolean): FakeElement | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const match = child.find(predicate);
      if (match) return match;
    }
    return null;
  }
}

class FakeDocument {
  readonly roots = new Map<string, FakeElement>([
    ['paja-config-dialog', new FakeElement()],
    ['paja-config-title', new FakeElement()],
    ['paja-config-description', new FakeElement()],
    ['paja-config-fields', new FakeElement()],
    ['paja-config-error', new FakeElement()],
    ['paja-config-cancel', new FakeElement()],
    ['paja-config-save', new FakeElement()],
  ]);

  getElementById(id: string): FakeElement | null {
    return this.roots.get(id) ?? null;
  }

  createElement(): FakeElement {
    return new FakeElement();
  }
}

class FakeStorage implements Storage {
  readonly records = new Map<string, string>();

  get length(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
  getItem(key: string): string | null { return this.records.get(key) ?? null; }
  key(index: number): string | null { return [...this.records.keys()][index] ?? null; }
  removeItem(key: string): void { this.records.delete(key); }
  setItem(key: string, value: string): void { this.records.set(key, value); }
}

const SCHEMA = {
  type: 'object',
  title: 'Weather settings',
  properties: {
    theme: { type: 'string', enum: ['light', 'dark'], default: 'dark' },
    apiKey: { type: 'string', 'x-napplet-secret': true, 'x-napplet-section': 'credentials' },
  },
};

function send(
  service: ReturnType<typeof createConfigService>,
  windowId: string,
  type: string,
  fields: Record<string, unknown> = {},
): NappletMessage[] {
  const sent: NappletMessage[] = [];
  service.handler.handleMessage(windowId, { type, ...fields } as NappletMessage, (item) => sent.push(item));
  return sent;
}

describe('Paja NAP-CONFIG browser backend', () => {
  it('persists by trusted identity and commits through a masked host UI', () => {
    const document = new FakeDocument();
    const storage = new FakeStorage();
    const identities = new Map([
      ['window-a', { dTag: 'weather', aggregateHash: 'hash-a' }],
      ['window-b', { dTag: 'weather', aggregateHash: 'hash-b' }],
    ]);
    const controller = createPajaConfigController({
      document: document as unknown as Document,
      storage,
      getIdentity: (windowId) => identities.get(windowId ?? '') ?? { dTag: 'unknown', aggregateHash: 'unknown' },
    });
    expect(controller).not.toBeNull();
    const service = createConfigService(controller!.serviceOptions);

    send(service, 'window-a', 'config.registerSchema', { id: 'schema-a', schema: SCHEMA });
    send(service, 'window-a', 'config.openSettings');
    const fields = document.roots.get('paja-config-fields')!;
    const dialog = document.roots.get('paja-config-dialog')!;
    const secret = fields.find((element) => element.type === 'password');
    const theme = fields.find((element) => element.children.some((child) => child.value === '"light"'));
    expect(dialog.open).toBe(true);
    expect(secret).not.toBeNull();
    secret!.value = 'host-entered-secret';
    theme!.value = '"light"';
    document.roots.get('paja-config-save')!.click();

    expect(dialog.open).toBe(false);
    expect(service.getValues('window-a')).toEqual({ theme: 'light', apiKey: 'host-entered-secret' });

    send(service, 'window-b', 'config.registerSchema', { id: 'schema-b', schema: SCHEMA });
    expect(service.getValues('window-b')).toEqual({ theme: 'dark' });
    expect([...storage.records.keys()].filter((key) => key.includes('kehto:paja:config:'))).toHaveLength(2);
  });

  it('fails closed without a writable store or complete shell dialog', () => {
    const document = new FakeDocument();
    document.roots.delete('paja-config-fields');
    expect(createPajaConfigController({
      document: document as unknown as Document,
      storage: new FakeStorage(),
      getIdentity: () => ({ dTag: 'test', aggregateHash: 'hash' }),
    })).toBeNull();

    const readOnly = new FakeStorage();
    readOnly.setItem = () => { throw new Error('denied'); };
    expect(createPajaConfigController({
      document: new FakeDocument() as unknown as Document,
      storage: readOnly,
      getIdentity: () => ({ dTag: 'test', aggregateHash: 'hash' }),
    })).toBeNull();
  });

  it('settles native dialog cancel and close once, then disposes every listener', () => {
    const document = new FakeDocument();
    const controller = createPajaConfigController({
      document: document as unknown as Document,
      storage: new FakeStorage(),
      getIdentity: () => ({ dTag: 'weather', aggregateHash: 'hash-a' }),
    })!;
    const service = createConfigService(controller.serviceOptions);
    const dialog = document.roots.get('paja-config-dialog')!;
    const cancel = document.roots.get('paja-config-cancel')!;
    const save = document.roots.get('paja-config-save')!;
    const fields = document.roots.get('paja-config-fields')!;

    send(service, 'window-a', 'config.registerSchema', { id: 'schema-a', schema: SCHEMA });
    send(service, 'window-a', 'config.openSettings');
    const firstTheme = fields.find((element) => element.children.some((child) => child.value === '"light"'))!;
    firstTheme.value = '"light"';
    expect(dialog.listenerCount('cancel')).toBe(1);
    expect(dialog.listenerCount('close')).toBe(1);
    dialog.emit('cancel');
    dialog.close();
    dialog.emit('close');
    expect(fields.children).toHaveLength(0);
    save.click();

    expect(dialog.closeCalls).toBe(1);
    expect(service.getValues('window-a')).toEqual({ theme: 'dark' });

    send(service, 'window-a', 'config.openSettings');
    const secondTheme = fields.find((element) => element.children.some((child) => child.value === '"light"'))!;
    secondTheme.value = '"light"';
    dialog.close();
    dialog.emit('close');
    expect(fields.children).toHaveLength(0);
    save.click();
    expect(service.getValues('window-a')).toEqual({ theme: 'dark' });

    controller.dispose();
    expect(cancel.listenerCount('click')).toBe(0);
    expect(save.listenerCount('click')).toBe(0);
    expect(dialog.listenerCount('cancel')).toBe(0);
    expect(dialog.listenerCount('close')).toBe(0);
  });

  it('registers CONFIG only when the complete host controller exists', () => {
    const hostConfig = {
      window: { id: 'window-a', dTag: 'weather', aggregateHash: 'hash-a' },
    } as PajaHostConfig;
    const simulation = () => normalizePajaSimulation({ relay: { mode: 'disabled' } });
    const withoutHost = createPajaAdapter(hostConfig, simulation, () => {}, () => {}, () => true);
    expect(withoutHost.services?.config).toBeUndefined();

    const controller = createPajaConfigController({
      document: new FakeDocument() as unknown as Document,
      storage: new FakeStorage(),
      getIdentity: () => hostConfig.window,
    })!;
    const withHost = createPajaAdapter(
      hostConfig,
      simulation,
      () => {},
      () => {},
      () => true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      controller.serviceOptions,
    );
    expect(withHost.services?.config?.descriptor.name).toBe('config');
    (withoutHost.relayPool.getRelayPool() as unknown as { close(): void }).close();
    (withHost.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
