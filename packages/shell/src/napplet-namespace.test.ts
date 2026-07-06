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
});
