import { describe, expect, it } from 'vitest';
import {
  injectNappletNamespacePrelude,
  renderNappletNamespacePrelude,
} from './napplet-namespace.js';

type PostedMessage = { type: string; id?: string; [key: string]: unknown };
type PreludeListener = (event: PreludeTestEvent) => void;

interface PreludeTestEvent {
  source?: unknown;
  data?: unknown;
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  target?: unknown;
  defaultPrevented: boolean;
  preventDefault: () => void;
}

interface PreludeKeydownInit {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  target?: unknown;
}

interface PreludeTestWindow {
  napplet?: Record<string, unknown>;
  parent: { postMessage: (message: PostedMessage, targetOrigin: string) => void };
  crypto: { randomUUID: () => string };
  document: {
    activeElement: unknown;
    addEventListener: (type: string, listener: PreludeListener) => void;
    removeEventListener: (type: string, listener: PreludeListener) => void;
  };
  addEventListener: (type: string, listener: PreludeListener) => void;
  removeEventListener: (type: string, listener: PreludeListener) => void;
  dispatchMessage: (source: unknown, message: PostedMessage) => void;
  dispatchParentMessage: (message: PostedMessage) => void;
  dispatchKeydown: (event: PreludeKeydownInit) => PreludeTestEvent;
  postedMessages: PostedMessage[];
  postedMessageListenerCounts: number[];
}

function createPreludeTestWindow(napplet?: Record<string, unknown>): PreludeTestWindow {
  const windowListeners = new Map<string, Set<PreludeListener>>();
  const documentListeners = new Map<string, Set<PreludeListener>>();
  const postedMessages: PostedMessage[] = [];
  const postedMessageListenerCounts: number[] = [];
  let nextId = 0;
  const parent = {
    postMessage(message: PostedMessage) {
      postedMessages.push(message);
      postedMessageListenerCounts.push(windowListeners.get('message')?.size ?? 0);
    },
  };
  const add = (listeners: Map<string, Set<PreludeListener>>, type: string, listener: PreludeListener): void => {
    let byType = listeners.get(type);
    if (!byType) {
      byType = new Set();
      listeners.set(type, byType);
    }
    byType.add(listener);
  };
  const remove = (listeners: Map<string, Set<PreludeListener>>, type: string, listener: PreludeListener): void => {
    listeners.get(type)?.delete(listener);
  };
  const dispatch = (listeners: Map<string, Set<PreludeListener>>, type: string, event: PreludeTestEvent): void => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  const document = {
    activeElement: null as unknown,
    addEventListener(type: string, listener: PreludeListener) {
      add(documentListeners, type, listener);
    },
    removeEventListener(type: string, listener: PreludeListener) {
      remove(documentListeners, type, listener);
    },
  };
  return {
    napplet,
    parent,
    postedMessages,
    postedMessageListenerCounts,
    document,
    crypto: {
      randomUUID: () => `id-${++nextId}`,
    },
    addEventListener(type, listener) {
      add(windowListeners, type, listener);
    },
    removeEventListener(type, listener) {
      remove(windowListeners, type, listener);
    },
    dispatchMessage(source, message) {
      dispatch(windowListeners, 'message', {
        source,
        data: message,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      });
    },
    dispatchParentMessage(message) {
      this.dispatchMessage(parent, message);
    },
    dispatchKeydown(init) {
      const event: PreludeTestEvent = {
        key: init.key ?? '',
        code: init.code ?? '',
        ctrlKey: init.ctrlKey ?? false,
        altKey: init.altKey ?? false,
        shiftKey: init.shiftKey ?? false,
        metaKey: init.metaKey ?? false,
        isComposing: init.isComposing ?? false,
        repeat: init.repeat ?? false,
        target: init.target ?? document.activeElement,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      dispatch(documentListeners, 'keydown', event);
      dispatch(windowListeners, 'keydown', event);
      return event;
    },
  };
}

function withoutShellReady(target: PreludeTestWindow): PostedMessage[] {
  return target.postedMessages.filter((message) => message.type !== 'shell.ready');
}

function elementTarget(
  tagName: string,
  options: { type?: string; isContentEditable?: boolean; closestContentEditable?: boolean } = {},
): { tagName: string; type?: string; isContentEditable?: boolean; closest: (selector: string) => unknown } {
  return {
    tagName,
    type: options.type,
    isContentEditable: options.isContentEditable,
    closest: (selector: string) => (
      options.closestContentEditable && selector.includes('contenteditable') ? {} : null
    ),
  };
}

function runPrelude(script: string, target: PreludeTestWindow): void {
  const source = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  if (!source) {
    throw new Error('missing namespace prelude source');
  }
  new Function('window', source)(target);
}

async function withGlobalWindow<T>(target: PreludeTestWindow, run: () => T | Promise<T>): Promise<T> {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const originalWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    value: target,
    configurable: true,
  });
  try {
    return await run();
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

function requireDomain(domain: string): Record<string, (...args: unknown[]) => unknown> {
  const win = (globalThis as { window?: { napplet?: Record<string, unknown> } }).window;
  const value = win?.napplet?.[domain];
  if (!value || typeof value !== 'object') {
    throw new Error(`window.napplet.${domain} is unavailable`);
  }
  return value as Record<string, (...args: unknown[]) => unknown>;
}

const sdkLike = {
  intent: {
    open: (archetype: string, payload?: unknown, opts?: Record<string, unknown>) => (
      requireDomain('intent').open(archetype, payload, opts) as Promise<unknown>
    ),
  },
  common: {
    follow: (...pubkeys: string[]) => requireDomain('common').follow(...pubkeys) as Promise<unknown>,
  },
  ble: {
    write: (sessionId: string, target: unknown, data: number[], options?: Record<string, unknown>) => (
      requireDomain('ble').write(sessionId, target, data, options) as Promise<void>
    ),
  },
  serial: {
    write: (sessionId: string, data: Uint8Array) => requireDomain('serial').write(sessionId, data) as Promise<void>,
  },
  webrtc: {
    send: (sessionId: string, payload: unknown) => requireDomain('webrtc').send(sessionId, payload) as Promise<void>,
  },
  dm: {
    messages: (query: Record<string, unknown>) => requireDomain('dm').messages(query) as Promise<unknown>,
  },
  notify: {
    onAction: (callback: (notificationId: unknown, actionId: unknown) => void) => (
      requireDomain('notify').onAction(callback) as { close: () => void }
    ),
  },
  media: {
    onCommand: (sessionId: string, callback: (action: unknown, value?: unknown) => void) => (
      requireDomain('media').onCommand(sessionId, callback) as { close: () => void }
    ),
  },
  cvm: {
    close: (server: string) => requireDomain('cvm').close(server) as Promise<void>,
    listTools: (server: string) => requireDomain('cvm').listTools(server) as Promise<unknown[]>,
  },
  upload: {
    onStatus: (callback: (status: unknown) => void) => (
      requireDomain('upload').onStatus(callback) as { close: () => void }
    ),
  },
};

describe('NIP-5D napplet namespace prelude', () => {
  it('always renders mandatory NAP-SHELL before optional bare NAP domains', () => {
    const script = renderNappletNamespacePrelude({
      domains: ['relay', 'identity', 'relay', 'inc:NAP-01', 'perm:browser-relaxation', 'theme'],
    });

    expect(script).toContain('data-kehto-nip5d-injection');
    expect(script).toContain('["shell","relay","identity","theme"]');
    expect(script).toContain('makeShell');
    expect(script).not.toContain('perm:browser-relaxation');
    expect(script).not.toContain('inc:NAP-01');
    expect(script).toContain("set(value)");
    expect(script).toContain("buildNappletNamespace(value)");
  });

  it('installs the NAP-SHELL receiver before signaling ready and caches one immutable unary environment', async () => {
    const target = createPreludeTestWindow();
    const readyEnvironments: unknown[] = [];

    runPrelude(renderNappletNamespacePrelude({ domains: ['relay', 'inc'] }), target);

    const shell = target.napplet?.shell as {
      ready: () => Promise<{ capabilities: { domains: readonly string[] }; services: readonly string[] }>;
      supports: (domain: string) => boolean;
      readonly services: readonly string[];
      onReady: (handler: (environment: unknown) => void) => { close(): void };
    };
    expect(typeof shell.ready).toBe('function');
    expect(typeof shell.supports).toBe('function');
    expect(shell.supports.length).toBe(1);
    expect(typeof shell.onReady).toBe('function');
    expect(shell.services).toEqual([]);
    expect(shell.supports('relay')).toBe(false);
    expect(target.postedMessages).toEqual([{ type: 'shell.ready' }]);
    expect(target.postedMessageListenerCounts[0]).toBeGreaterThan(0);

    const subscription = shell.onReady((environment) => readyEnvironments.push(environment));
    const cancelledEnvironments: unknown[] = [];
    const cancelled = shell.onReady((environment) => cancelledEnvironments.push(environment));
    cancelled.close();
    const ready = shell.ready();
    target.dispatchMessage({}, {
      type: 'shell.init',
      capabilities: { domains: ['forged'] },
      services: ['forged'],
    });
    target.dispatchMessage(target, {
      type: 'shell.init',
      capabilities: { domains: ['child'] },
      services: ['child'],
    });
    target.dispatchParentMessage({
      type: 'shell.init',
      capabilities: { domains: ['relay', 'inc', 'relay', 'Relay', '', 1] },
      services: ['relay-pool', 'storage', 'relay-pool', 1],
    });
    const environment = await ready;

    expect(environment).toEqual({
      capabilities: { domains: ['relay', 'inc', 'Relay'] },
      services: ['relay-pool', 'storage'],
    });
    expect(readyEnvironments).toEqual([environment]);
    expect(cancelledEnvironments).toEqual([]);
    expect(shell.supports('relay')).toBe(true);
    expect(shell.supports('inc')).toBe(true);
    expect(shell.supports('Relay')).toBe(true);
    for (const unsupported of ['RELay', ' relay', ' relay ', 'relay ', 'rel', 'relay-pool', '', 'unknown', null, 1, {}]) {
      expect(() => (shell.supports as (domain: unknown) => boolean)(unsupported)).not.toThrow();
      expect((shell.supports as (domain: unknown) => boolean)(unsupported)).toBe(false);
    }
    expect(shell.services).toEqual(['relay-pool', 'storage']);
    expect(Object.isFrozen(environment)).toBe(true);
    expect(Object.isFrozen(environment.capabilities)).toBe(true);
    expect(Object.isFrozen(environment.capabilities.domains)).toBe(true);
    expect(Object.isFrozen(shell.services)).toBe(true);
    expect(() => (environment.capabilities.domains as string[]).push('forged')).toThrow();
    expect(() => (shell.services as string[]).push('forged')).toThrow();
    (shell as { services: readonly string[] }).services = ['forged'];
    expect(shell.services).toEqual(['relay-pool', 'storage']);

    target.dispatchParentMessage({
      type: 'shell.init',
      capabilities: { domains: ['forged'] },
      services: ['forged'],
    });
    expect(shell.services).toEqual(['relay-pool', 'storage']);
    expect(readyEnvironments).toHaveLength(1);
    const lateEnvironments: unknown[] = [];
    shell.onReady((lateEnvironment) => lateEnvironments.push(lateEnvironment));
    expect(lateEnvironments).toEqual([environment]);
    subscription.close();
  });

  it('isolates immutable shell.init snapshots between prelude windows', async () => {
    const first = createPreludeTestWindow();
    const second = createPreludeTestWindow();
    runPrelude(renderNappletNamespacePrelude({ domains: ['relay'] }), first);
    runPrelude(renderNappletNamespacePrelude({ domains: ['inc'] }), second);

    const firstShell = first.napplet?.shell as { ready: () => Promise<{ capabilities: { domains: readonly string[] }; services: readonly string[] }> };
    const secondShell = second.napplet?.shell as { ready: () => Promise<{ capabilities: { domains: readonly string[] }; services: readonly string[] }> };
    const firstReady = firstShell.ready();
    const secondReady = secondShell.ready();

    first.dispatchParentMessage({ type: 'shell.init', capabilities: { domains: ['relay'] }, services: ['relay-service'] });
    second.dispatchParentMessage({ type: 'shell.init', capabilities: { domains: ['inc'] }, services: ['inc-service'] });
    const [firstEnvironment, secondEnvironment] = await Promise.all([firstReady, secondReady]);

    expect(firstEnvironment).not.toBe(secondEnvironment);
    expect(firstEnvironment.capabilities.domains).not.toBe(secondEnvironment.capabilities.domains);
    expect(firstEnvironment.services).not.toBe(secondEnvironment.services);
    expect(firstEnvironment).toEqual({ capabilities: { domains: ['relay'] }, services: ['relay-service'] });
    expect(secondEnvironment).toEqual({ capabilities: { domains: ['inc'] }, services: ['inc-service'] });
  });

  it('injects only mandatory NAP-SHELL when no optional domains are requested', () => {
    const target = createPreludeTestWindow();

    runPrelude(renderNappletNamespacePrelude({ domains: [] }), target);

    expect(Object.keys(target.napplet ?? {})).toEqual(['shell']);
    expect(target.postedMessages).toEqual([{ type: 'shell.ready' }]);
  });

  it('escapes script-breaking domain text', () => {
    const script = renderNappletNamespacePrelude({ domains: ['x</script><script>bad</script>'] });

    expect(script).toContain('\\u003c/script>');
    expect(script).not.toContain('x</script><script>bad</script>');
  });

  it('places the prelude after CSP and before authored scripts', () => {
    const html = [
      '<html><head>',
      '<meta http-equiv="Content-Security-Policy" content="connect-src none">',
      '<script src="/assets/app.js"></script>',
      '</head><body></body></html>',
    ].join('');

    const out = injectNappletNamespacePrelude(html, { domains: ['relay'] });

    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(
      out.indexOf('data-kehto-nip5d-injection'),
    );
    expect(out.indexOf('data-kehto-nip5d-injection')).toBeLessThan(
      out.indexOf('src="/assets/app.js"'),
    );
  });

  it('does not corrupt minified prelude tokens when inserting after CSP', () => {
    const html = [
      '<html><head>',
      '<meta http-equiv="Content-Security-Policy" content="connect-src none">',
      '<script src="/assets/app.js"></script>',
      '</head><body></body></html>',
    ].join('');

    const out = injectNappletNamespacePrelude(html, { domains: ['inc', 'storage', 'theme'] });
    const source = out.match(/<script[^>]*data-kehto-nip5d-injection[^>]*>([\s\S]*?)<\/script>/)?.[1];

    expect(source).toBeTruthy();
    expect(source).not.toContain('<meta http-equiv="Content-Security-Policy"');
    expect(out.match(/Content-Security-Policy/g)).toHaveLength(1);
    expect(() => new Function('window', source ?? '')).not.toThrow();
  });

  it('creates a head prelude when an artifact has no head element', () => {
    const out = injectNappletNamespacePrelude('<html><body>x</body></html>', { domains: ['notify'] });

    expect(out).toContain('<head><script data-kehto-nip5d-injection>');
    expect(out.indexOf('data-kehto-nip5d-injection')).toBeLessThan(out.indexOf('<body>'));
  });

  it('filters napplet-owned namespace assignments through the injected domain allowlist', () => {
    const relay = { subscribe: () => undefined };
    const existingRelay = { query: () => undefined };
    const upload = { put: () => undefined };
    const shell = { supports: () => true };
    const target = createPreludeTestWindow({
        relay: existingRelay,
        upload,
    });

    runPrelude(renderNappletNamespacePrelude({ domains: ['relay', 'identity'] }), target);

    const injectedShell = target.napplet?.shell;
    expect(typeof (injectedShell as Record<string, unknown>).ready).toBe('function');
    expect(target.napplet?.relay).toBe(existingRelay);
    expect(typeof (target.napplet?.identity as Record<string, unknown>).getPublicKey).toBe('function');
    expect(target.napplet?.upload).toBeUndefined();
    expect('__kehtoInjectedDomains' in (target.napplet ?? {})).toBe(false);
    expect(Object.keys(target.napplet ?? {})).toEqual(['shell', 'relay', 'identity']);

    target.napplet = {
      relay,
      upload,
      shell,
    };

    expect(target.napplet?.relay).toBe(relay);
    expect(typeof (target.napplet?.identity as Record<string, unknown>).getPublicKey).toBe('function');
    expect(target.napplet?.shell).toBe(injectedShell);
    expect(target.napplet?.upload).toBeUndefined();
    expect('__kehtoInjectedDomains' in (target.napplet ?? {})).toBe(false);
    expect(Object.keys(target.napplet ?? {})).toEqual(['shell', 'relay', 'identity']);

    const namespace = target.napplet as Record<string, unknown>;
    namespace.upload = { put: () => undefined };
    Object.defineProperty(namespace, 'shell', {
      value: { supports: () => true },
      configurable: true,
      enumerable: true,
    });

    expect(target.napplet?.upload).toBeUndefined();
    expect(target.napplet?.shell).toBe(injectedShell);
    expect(Object.keys(target.napplet ?? {})).toEqual(['shell', 'relay', 'identity']);
    expect(target.postedMessages.filter((message) => message.type === 'shell.ready')).toHaveLength(1);
  });

  it('installs callable domain interfaces that route requests through parent postMessage', async () => {
    const target = createPreludeTestWindow();

    runPrelude(
      renderNappletNamespacePrelude({
        domains: ['identity', 'relay', 'storage', 'inc', 'count', 'outbox'],
      }),
      target,
    );

    const napplet = target.napplet as Record<string, Record<string, (...args: unknown[]) => unknown>>;

    expect(typeof napplet.identity.getPublicKey).toBe('function');
    expect(typeof napplet.relay.query).toBe('function');
    expect(typeof napplet.storage.getItem).toBe('function');
    expect(typeof napplet.inc.emit).toBe('function');
    expect(typeof napplet.count.query).toBe('function');
    expect(typeof napplet.outbox.subscribe).toBe('function');

    const pubkey = napplet.identity.getPublicKey() as Promise<string>;
    const identityRequest = target.postedMessages.at(-1);
    expect(identityRequest).toMatchObject({ type: 'identity.getPublicKey', id: 'id-1' });
    target.dispatchParentMessage({
      type: 'identity.getPublicKey.result',
      id: identityRequest?.id,
      pubkey: 'pubkey-1',
    });
    await expect(pubkey).resolves.toBe('pubkey-1');

    const relayEvents = napplet.relay.query({ kinds: [1] }) as Promise<unknown[]>;
    const relayRequest = target.postedMessages.at(-1);
    expect(relayRequest).toMatchObject({
      type: 'relay.query',
      id: 'id-2',
      filters: [{ kinds: [1] }],
    });
    target.dispatchParentMessage({
      type: 'relay.query.result',
      id: relayRequest?.id,
      events: [{ id: 'event-1' }],
    });
    await expect(relayEvents).resolves.toEqual([{ id: 'event-1' }]);

    const stored = napplet.storage.getItem('theme') as Promise<string | null>;
    const storageRequest = target.postedMessages.at(-1);
    expect(storageRequest).toMatchObject({ type: 'storage.get', id: 'id-3', key: 'theme' });
    target.dispatchParentMessage({
      type: 'storage.get.result',
      id: storageRequest?.id,
      value: 'dark',
    });
    await expect(stored).resolves.toBe('dark');

    napplet.inc.emit('profile:open', { pubkey: 'pubkey-1' });
    expect(target.postedMessages.at(-1)).toMatchObject({
      type: 'inc.emit',
      topic: 'profile:open',
      payload: { pubkey: 'pubkey-1' },
    });
  });

  it('normalizes canonical INC conventions, protects INC assignment, and shares topic subscriptions', () => {
    const target = createPreludeTestWindow();
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    runPrelude(renderNappletNamespacePrelude({ domains: ['inc'] }), target);

    type Inc = {
      emit: (topic: string, payload?: unknown) => void;
      on: (topic: string, handler: (event: unknown) => void) => { close(): void };
    };
    const inc = target.napplet?.inc as Inc;
    inc.emit('napplet:profile/open?truth=false&count=42&nothing=null&plus=a+b&encoded=%E2%9C%93');
    expect(withoutShellReady(target).at(-1)).toEqual({
      type: 'inc.emit',
      topic: 'napplet:profile/open',
      payload: { truth: 'false', count: '42', nothing: 'null', plus: 'a+b', encoded: '✓' },
    });

    const postsBeforeInvalid = target.postedMessages.length;
    for (const invalid of [
      'napplet:profile/open#fragment',
      'napplet:profile/open?bad=%E0%A4%A',
      'napplet:profile/open?name=one&na%6De=two',
    ]) {
      expect(() => inc.emit(invalid)).toThrow();
    }
    expect(() => inc.emit('napplet:profile/open?name=value', { explicit: true })).toThrow();
    expect(target.postedMessages).toHaveLength(postsBeforeInvalid);

    expect(() => inc.on('napplet:profile/open?name=value', () => undefined)).toThrow();
    expect(() => inc.on('napplet:profile/open#fragment', () => undefined)).toThrow();
    expect(target.postedMessages).toHaveLength(postsBeforeInvalid);

    const first = inc.on('napplet:profile/open', (event) => receivedA.push(event));
    const second = inc.on('napplet:profile/open', (event) => receivedB.push(event));
    const subscribe = withoutShellReady(target).at(-1);
    expect(withoutShellReady(target).filter((message) => message.type === 'inc.subscribe')).toHaveLength(1);
    expect(subscribe).toMatchObject({ type: 'inc.subscribe', topic: 'napplet:profile/open', id: 'id-1' });
    target.dispatchParentMessage({ type: 'inc.subscribe.result', id: subscribe?.id });
    target.dispatchParentMessage({ type: 'inc.event', topic: 'napplet:profile/open', sender: 'profile-owner', payload: { id: 'one' } });
    expect(receivedA).toEqual([{ topic: 'napplet:profile/open', sender: 'profile-owner', payload: { id: 'one' } }]);
    expect(receivedB).toEqual(receivedA);
    first.close();
    target.dispatchParentMessage({ type: 'inc.event', topic: 'napplet:profile/open', sender: 'profile-owner', payload: { id: 'two' } });
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(2);
    second.close();
    expect(withoutShellReady(target).at(-1)).toEqual({ type: 'inc.unsubscribe', topic: 'napplet:profile/open' });

    (target.napplet as Record<string, unknown>).inc = { emit: () => { throw new Error('bypassed'); }, extension: true };
    (target.napplet?.inc as Inc).emit('napplet:profile/open?retained=yes');
    target.napplet = { inc: { emit: () => { throw new Error('bypassed'); }, extension: true } };
    (target.napplet?.inc as Inc).emit('napplet:profile/open?retained=twice');
    expect(withoutShellReady(target).slice(-2)).toEqual([
      { type: 'inc.emit', topic: 'napplet:profile/open', payload: { retained: 'yes' } },
      { type: 'inc.emit', topic: 'napplet:profile/open', payload: { retained: 'twice' } },
    ]);
  });

  it('provides symmetric correlated INC channel handles with retained lifecycle state', async () => {
    const target = createPreludeTestWindow();
    runPrelude(renderNappletNamespacePrelude({ domains: ['inc'] }), target);

    type ChannelClosed = { channelId: string; reason?: string };
    type ChannelEvent = { channelId: string; sender: string; payload?: unknown };
    type Handle = {
      id: string;
      peer: string;
      emit: (payload?: unknown) => void;
      on: (handler: (event: ChannelEvent) => void) => { close(): void };
      onClosed: (handler: (closed: ChannelClosed) => void) => { close(): void };
      close: () => void;
    };
    type Inc = {
      channel: {
        open: (targetDTag: string) => Promise<Handle>;
        onOpened: (handler: (handle: Handle) => void) => { close(): void };
        list: () => Promise<Array<{ id: string; peer: string }>>;
        broadcast: (payload?: unknown) => void;
      };
    };
    const inc = target.napplet?.inc as Inc;
    const inbound: Handle[] = [];
    const opened = inc.channel.open('media-player');
    const openRequest = withoutShellReady(target).at(-1);
    expect(openRequest).toEqual({ type: 'inc.channel.open', id: 'id-1', target: 'media-player' });
    target.dispatchMessage({}, { type: 'inc.channel.open.result', id: openRequest?.id, channelId: 'forged', peer: 'forged' });
    target.dispatchParentMessage({ type: 'inc.channel.open.result', id: 'wrong', channelId: 'forged', peer: 'forged' });
    target.dispatchParentMessage({ type: 'inc.channel.open.result', id: openRequest?.id, channelId: 'c-open', peer: 'media-player' });
    const opener = await opened;
    expect(opener).toMatchObject({ id: 'c-open', peer: 'media-player' });

    const rejected = inc.channel.open('missing');
    const rejectedRequest = withoutShellReady(target).at(-1);
    target.dispatchParentMessage({ type: 'inc.channel.open.result', id: rejectedRequest?.id, error: 'target not found' });
    await expect(rejected).rejects.toThrow('target not found');

    target.dispatchParentMessage({ type: 'inc.channel.opened', channelId: 'c-target', peer: 'music-controller' });
    target.dispatchParentMessage({ type: 'inc.channel.event', channelId: 'c-target', sender: 'music-controller', payload: { order: 1 } });
    target.dispatchParentMessage({ type: 'inc.channel.event', channelId: 'c-target', sender: 'music-controller', payload: { order: 2 } });
    inc.channel.onOpened((handle) => inbound.push(handle));
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ id: 'c-target', peer: 'music-controller' });
    const earlyEvents: ChannelEvent[] = [];
    const laterEvents: ChannelEvent[] = [];
    const firstListener = inbound[0].on((event) => earlyEvents.push(event));
    const secondListener = inbound[0].on((event) => laterEvents.push(event));
    expect(earlyEvents).toEqual([
      { channelId: 'c-target', sender: 'music-controller', payload: { order: 1 } },
      { channelId: 'c-target', sender: 'music-controller', payload: { order: 2 } },
    ]);
    expect(laterEvents).toEqual([]);
    target.dispatchParentMessage({ type: 'inc.channel.event', channelId: 'c-target', sender: 'music-controller', payload: { order: 3 } });
    firstListener.close();
    target.dispatchParentMessage({ type: 'inc.channel.event', channelId: 'c-target', sender: 'music-controller', payload: { order: 4 } });
    expect(earlyEvents).toHaveLength(3);
    expect(laterEvents).toEqual([
      { channelId: 'c-target', sender: 'music-controller', payload: { order: 3 } },
      { channelId: 'c-target', sender: 'music-controller', payload: { order: 4 } },
    ]);
    secondListener.close();

    const list = inc.channel.list();
    const listRequest = withoutShellReady(target).at(-1);
    expect(listRequest).toEqual({ type: 'inc.channel.list', id: 'id-3' });
    target.dispatchParentMessage({
      type: 'inc.channel.list.result',
      id: listRequest?.id,
      channels: [{ id: 'c-open', peer: 'media-player', emit: 'forged' }, { id: 7, peer: 'invalid' }],
    });
    await expect(list).resolves.toEqual([{ id: 'c-open', peer: 'media-player' }]);

    inc.channel.broadcast({ all: true });
    opener.emit({ command: 'play' });
    opener.close();
    expect(withoutShellReady(target).slice(-3)).toEqual([
      { type: 'inc.channel.broadcast', payload: { all: true } },
      { type: 'inc.channel.emit', channelId: 'c-open', payload: { command: 'play' } },
      { type: 'inc.channel.close', channelId: 'c-open' },
    ]);
    const closed: ChannelClosed[] = [];
    opener.onClosed((record) => closed.push(record));
    expect(closed).toEqual([{ channelId: 'c-open' }]);

    target.dispatchParentMessage({ type: 'inc.channel.closed', channelId: 'c-target', reason: 'peer destroyed' });
    const targetClosed: ChannelClosed[] = [];
    inbound[0].onClosed((record) => targetClosed.push(record));
    expect(targetClosed).toEqual([{ channelId: 'c-target', reason: 'peer destroyed' }]);

    target.dispatchParentMessage({ type: 'inc.channel.opened', channelId: 'c-overflow', peer: 'noisy-peer' });
    const overflowing = inbound.at(-1) as Handle;
    for (let order = 0; order <= 32; order += 1) {
      target.dispatchParentMessage({ type: 'inc.channel.event', channelId: 'c-overflow', sender: 'noisy-peer', payload: { order } });
    }
    expect(withoutShellReady(target).at(-1)).toEqual({ type: 'inc.channel.close', channelId: 'c-overflow' });
    const overflowClosed: ChannelClosed[] = [];
    overflowing.onClosed((record) => overflowClosed.push(record));
    expect(overflowClosed).toEqual([{ channelId: 'c-overflow', reason: 'buffer overflow' }]);
  });

  it('keeps outbox subscriptions callable and dispatches parent events to handlers', () => {
    const target = createPreludeTestWindow();
    const received: unknown[] = [];
    const closed: unknown[] = [];

    runPrelude(renderNappletNamespacePrelude({ domains: ['outbox'] }), target);

    const outbox = target.napplet?.outbox as {
      subscribe: (filters: unknown) => {
        on: (event: 'event' | 'closed', handler: (value?: unknown) => void) => { close: () => void };
        close: () => void;
      };
    };
    const subscription = outbox.subscribe({ kinds: [1] });
    const subscribeRequest = target.postedMessages.at(-1);

    expect(subscribeRequest).toMatchObject({
      type: 'outbox.subscribe',
      id: 'id-2',
      subId: 'id-1',
      filters: [{ kinds: [1] }],
    });

    subscription.on('event', (event) => received.push(event));
    subscription.on('closed', (reason) => closed.push(reason));
    target.dispatchParentMessage({
      type: 'outbox.event',
      subId: subscribeRequest?.subId,
      result: { id: 'event-2' },
    });
    target.dispatchParentMessage({
      type: 'outbox.closed',
      subId: subscribeRequest?.subId,
      reason: 'done',
    });

    expect(received).toEqual([{ id: 'event-2' }]);
    expect(closed).toEqual(['done']);

    subscription.close();
    expect(target.postedMessages.at(-1)).toMatchObject({
      type: 'outbox.close',
      subId: 'id-1',
    });
  });

  it('injects keys.forward so focused napplets can forward key events to the shell', () => {
    const target = createPreludeTestWindow();

    runPrelude(renderNappletNamespacePrelude({ domains: ['keys'] }), target);

    const keys = target.napplet?.keys as {
      forward: (event: {
        key?: string;
        code?: string;
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        metaKey?: boolean;
      }) => void;
      registerAction: (action: unknown) => Promise<unknown>;
      unregisterAction: (actionId: string) => void;
      onAction: (actionId: string, callback: () => void) => { close(): void };
    };

    expect(typeof keys.forward).toBe('function');
    expect(typeof keys.registerAction).toBe('function');
    expect(typeof keys.unregisterAction).toBe('function');
    expect(typeof keys.onAction).toBe('function');

    keys.forward({
      key: 'j',
      code: 'KeyJ',
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    });

    expect(target.postedMessages.at(-1)).toEqual({
      type: 'keys.forward',
      key: 'j',
      code: 'KeyJ',
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
  });

  it('smart-forwards ordinary keydown events from the injected keys prelude', () => {
    const target = createPreludeTestWindow();

    runPrelude(renderNappletNamespacePrelude({ domains: ['keys'] }), target);

    const event = target.dispatchKeydown({
      key: '2',
      code: 'Digit2',
    });

    expect(event.defaultPrevented).toBe(false);
    expect(withoutShellReady(target)).toEqual([{
      type: 'keys.forward',
      key: '2',
      code: 'Digit2',
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    }]);
  });

  it('does not smart-forward text-entry, modifier-only, or IME keydown events', () => {
    const target = createPreludeTestWindow();

    runPrelude(renderNappletNamespacePrelude({ domains: ['keys'] }), target);

    target.dispatchKeydown({
      key: 'a',
      code: 'KeyA',
      target: elementTarget('input', { type: 'text' }),
    });
    target.dispatchKeydown({
      key: 'ArrowDown',
      code: 'ArrowDown',
      target: elementTarget('textarea'),
    });
    target.dispatchKeydown({
      key: 'Control',
      code: 'ControlLeft',
      ctrlKey: true,
    });
    target.dispatchKeydown({
      key: 'k',
      code: 'KeyK',
      isComposing: true,
    });

    expect(withoutShellReady(target)).toEqual([]);
  });

  it('uses keys.bindings as a local suppress list for injected onAction handlers', () => {
    const target = createPreludeTestWindow();
    const fired: string[] = [];

    runPrelude(renderNappletNamespacePrelude({ domains: ['keys'] }), target);

    const keys = target.napplet?.keys as {
      onAction: (actionId: string, callback: () => void) => { close(): void };
    };
    const subscription = keys.onAction('editor.save', () => fired.push('editor.save'));

    target.dispatchParentMessage({
      type: 'keys.bindings',
      bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }],
    });

    const event = target.dispatchKeydown({
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
    });

    expect(event.defaultPrevented).toBe(true);
    expect(fired).toEqual(['editor.save']);
    expect(withoutShellReady(target)).toEqual([]);

    subscription.close();
  });

  it('does not suppress reserved keys even if a binding names one', () => {
    const target = createPreludeTestWindow();
    const fired: string[] = [];

    runPrelude(renderNappletNamespacePrelude({ domains: ['keys'] }), target);

    const keys = target.napplet?.keys as {
      onAction: (actionId: string, callback: () => void) => { close(): void };
    };
    keys.onAction('editor.cancel', () => fired.push('editor.cancel'));
    target.dispatchParentMessage({
      type: 'keys.bindings',
      bindings: [{ actionId: 'editor.cancel', key: 'Escape' }],
    });

    const event = target.dispatchKeydown({
      key: 'Escape',
      code: 'Escape',
    });

    expect(event.defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
    expect(withoutShellReady(target)).toEqual([{
      type: 'keys.forward',
      key: 'Escape',
      code: 'Escape',
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    }]);
  });

  it('forwards public SDK wrapper arguments through injected service domains', async () => {
    const target = createPreludeTestWindow();

    runPrelude(
      renderNappletNamespacePrelude({
        domains: ['intent', 'common', 'ble', 'webrtc', 'serial', 'dm', 'notify', 'media', 'cvm', 'upload'],
      }),
      target,
    );

    await withGlobalWindow(target, async () => {
      const opened = sdkLike.intent.open('note', { id: 'event-1' }, { protocol: 'profile' });
      const intentRequest = target.postedMessages.at(-1);
      expect(intentRequest).toMatchObject({
        type: 'intent.invoke',
        id: 'id-1',
        request: {
          archetype: 'note',
          action: 'open',
          payload: { id: 'event-1' },
          protocol: 'profile',
        },
      });
      target.dispatchParentMessage({
        type: 'intent.invoke.result',
        id: intentRequest?.id,
        result: { ok: true },
      });
      await expect(opened).resolves.toEqual({ ok: true });

      const followed = sdkLike.common.follow('pubkey-1', 'pubkey-2');
      const followRequest = target.postedMessages.at(-1);
      expect(followRequest).toMatchObject({
        type: 'common.follow',
        id: 'id-2',
        pubkeys: ['pubkey-1', 'pubkey-2'],
      });
      target.dispatchParentMessage({
        type: 'common.follow.result',
        id: followRequest?.id,
        ok: true,
      });
      await expect(followed).resolves.toMatchObject({ ok: true });

      const bleWrite = sdkLike.ble.write('ble-session', { service: 'svc', characteristic: 'chr' }, [1, 2], {
        withoutResponse: true,
      });
      const bleWriteRequest = target.postedMessages.at(-1);
      expect(bleWriteRequest).toMatchObject({
        type: 'ble.write',
        id: 'id-3',
        sessionId: 'ble-session',
        target: { service: 'svc', characteristic: 'chr' },
        data: [1, 2],
        options: { withoutResponse: true },
      });
      target.dispatchParentMessage({
        type: 'ble.write.result',
        id: bleWriteRequest?.id,
      });
      await expect(bleWrite).resolves.toBeUndefined();

      const serialWrite = sdkLike.serial.write('serial-session', new Uint8Array([3, 4]));
      const serialWriteRequest = target.postedMessages.at(-1);
      expect(serialWriteRequest).toMatchObject({
        type: 'serial.write',
        id: 'id-4',
        sessionId: 'serial-session',
        data: [3, 4],
      });
      target.dispatchParentMessage({
        type: 'serial.write.result',
        id: serialWriteRequest?.id,
      });
      await expect(serialWrite).resolves.toBeUndefined();

      const webrtcSend = sdkLike.webrtc.send('webrtc-session', { body: 'hello' });
      expect(typeof (webrtcSend as Promise<void>).then).toBe('function');
      const webrtcSendRequest = target.postedMessages.at(-1);
      expect(webrtcSendRequest).toMatchObject({
        type: 'webrtc.send',
        id: 'id-5',
        sessionId: 'webrtc-session',
        payload: { body: 'hello' },
      });
      target.dispatchParentMessage({
        type: 'webrtc.send.result',
        id: webrtcSendRequest?.id,
      });
      await expect(webrtcSend).resolves.toBeUndefined();

      const messages = sdkLike.dm.messages({ conversationId: 'conversation-1', limit: 1 });
      const messagesRequest = target.postedMessages.at(-1);
      expect(messagesRequest).toMatchObject({
        type: 'dm.messages',
        id: 'id-6',
        conversationId: 'conversation-1',
        limit: 1,
      });
      target.dispatchParentMessage({
        type: 'dm.messages.result',
        id: messagesRequest?.id,
        messages: [],
      });
      await expect(messages).resolves.toMatchObject({ messages: [] });

      const notifyActions: unknown[] = [];
      const notifySubscription = sdkLike.notify.onAction((notificationId, actionId) => {
        notifyActions.push({ notificationId, actionId });
      });
      target.dispatchParentMessage({
        type: 'notify.action',
        notificationId: 'notification-1',
        actionId: 'open',
      });
      expect(notifyActions).toEqual([{ notificationId: 'notification-1', actionId: 'open' }]);
      notifySubscription.close();

      const mediaCommands: unknown[] = [];
      const mediaSubscription = sdkLike.media.onCommand('media-session', (action, value) => {
        mediaCommands.push({ action, value });
      });
      target.dispatchParentMessage({
        type: 'media.command',
        sessionId: 'media-session',
        action: 'seek',
        value: 42,
      });
      expect(mediaCommands).toEqual([{ action: 'seek', value: 42 }]);
      mediaSubscription.close();

      const cvmClosed = sdkLike.cvm.close('server-1');
      const cvmCloseRequest = target.postedMessages.at(-1);
      expect(cvmCloseRequest).toMatchObject({
        type: 'cvm.close',
        id: 'id-7',
        server: 'server-1',
      });
      target.dispatchParentMessage({
        type: 'cvm.close.result',
        id: cvmCloseRequest?.id,
      });
      await expect(cvmClosed).resolves.toBeUndefined();

      const cvmTools = sdkLike.cvm.listTools('server-1');
      const cvmListToolsRequest = target.postedMessages.at(-1);
      expect(cvmListToolsRequest).toMatchObject({
        type: 'cvm.request',
        id: 'id-9',
        server: 'server-1',
        message: {
          jsonrpc: '2.0',
          id: 'id-8',
          method: 'tools/list',
        },
      });
      target.dispatchParentMessage({
        type: 'cvm.request.result',
        id: cvmListToolsRequest?.id,
        message: {
          jsonrpc: '2.0',
          id: 'id-8',
          result: {
            tools: [{ name: 'calculate_trust_score' }],
          },
        },
      });
      await expect(cvmTools).resolves.toEqual([{ name: 'calculate_trust_score' }]);

      const uploadStatuses: unknown[] = [];
      const uploadSubscription = sdkLike.upload.onStatus((status) => uploadStatuses.push(status));
      target.dispatchParentMessage({
        type: 'upload.status.changed',
        status: {
          uploadId: 'upload-1',
          ok: true,
          status: 'complete',
          rail: 'blossom',
          updatedAt: 1,
        },
      });
      expect(uploadStatuses).toEqual([{
        uploadId: 'upload-1',
        ok: true,
        status: 'complete',
        rail: 'blossom',
        updatedAt: 1,
      }]);
      uploadSubscription.close();
    });
  });
});
