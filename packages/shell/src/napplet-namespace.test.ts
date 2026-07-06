import { describe, expect, it } from 'vitest';
import {
  injectNappletNamespacePrelude,
  renderNappletNamespacePrelude,
} from './napplet-namespace.js';

type PostedMessage = { type: string; id?: string; [key: string]: unknown };

interface PreludeTestWindow {
  napplet?: Record<string, unknown>;
  parent: { postMessage: (message: PostedMessage, targetOrigin: string) => void };
  crypto: { randomUUID: () => string };
  addEventListener: (type: string, listener: (event: { source: unknown; data: unknown }) => void) => void;
  removeEventListener: (type: string, listener: (event: { source: unknown; data: unknown }) => void) => void;
  dispatchParentMessage: (message: PostedMessage) => void;
  postedMessages: PostedMessage[];
}

function createPreludeTestWindow(napplet?: Record<string, unknown>): PreludeTestWindow {
  const listeners = new Set<(event: { source: unknown; data: unknown }) => void>();
  const postedMessages: PostedMessage[] = [];
  let nextId = 0;
  const parent = {
    postMessage(message: PostedMessage) {
      postedMessages.push(message);
    },
  };
  return {
    napplet,
    parent,
    postedMessages,
    crypto: {
      randomUUID: () => `id-${++nextId}`,
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener);
    },
    dispatchParentMessage(message) {
      for (const listener of listeners) {
        listener({ source: parent, data: message });
      }
    },
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
  it('renders available bare NAP domains without legacy supports helpers', () => {
    const script = renderNappletNamespacePrelude({
      domains: ['relay', 'identity', 'relay', 'inc:NAP-01', 'perm:browser-relaxation', 'theme'],
    });

    expect(script).toContain('data-kehto-nip5d-injection');
    expect(script).toContain('["relay","identity","theme"]');
    expect(script).not.toContain('shell.supports');
    expect(script).not.toContain('perm:browser-relaxation');
    expect(script).not.toContain('inc:NAP-01');
    expect(script).toContain("set(value)");
    expect(script).toContain("buildNappletNamespace(value)");
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

    expect(target.napplet?.shell).toBeUndefined();
    expect(target.napplet?.relay).toBe(existingRelay);
    expect(typeof (target.napplet?.identity as Record<string, unknown>).getPublicKey).toBe('function');
    expect(target.napplet?.upload).toBeUndefined();
    expect('__kehtoInjectedDomains' in (target.napplet ?? {})).toBe(false);
    expect(Object.keys(target.napplet ?? {})).toEqual(['relay', 'identity']);

    target.napplet = {
      relay,
      upload,
      shell,
    };

    expect(target.napplet?.relay).toBe(relay);
    expect(typeof (target.napplet?.identity as Record<string, unknown>).getPublicKey).toBe('function');
    expect(target.napplet?.shell).toBeUndefined();
    expect(target.napplet?.upload).toBeUndefined();
    expect('__kehtoInjectedDomains' in (target.napplet ?? {})).toBe(false);
    expect(Object.keys(target.napplet ?? {})).toEqual(['relay', 'identity']);

    const namespace = target.napplet as Record<string, unknown>;
    namespace.upload = { put: () => undefined };
    Object.defineProperty(namespace, 'shell', {
      value: { supports: () => true },
      configurable: true,
      enumerable: true,
    });

    expect(target.napplet?.upload).toBeUndefined();
    expect(target.napplet?.shell).toBeUndefined();
    expect(Object.keys(target.napplet ?? {})).toEqual(['relay', 'identity']);
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

    napplet.inc.emit('profile:open', [], JSON.stringify({ pubkey: 'pubkey-1' }));
    expect(target.postedMessages.at(-1)).toMatchObject({
      type: 'inc.emit',
      topic: 'profile:open',
      payload: { pubkey: 'pubkey-1' },
    });
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
