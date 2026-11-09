import { describe, expect, it } from 'vitest';
import { NAPPLET_PRELUDE_BUILT_IN_DOMAINS, serializeDomainBindings, type NappletDomainBinding } from './napplet-domain-binding.js';
import { renderNappletNamespacePrelude } from './napplet-namespace.js';

type Message = { type: string; id?: string; [key: string]: unknown };
type Listener = (event: { data: unknown; currentTarget: unknown }) => void;

/** Minimal NIP-5D realm: the prelude's private port1 and a parent that only sees `napplet.hello`. */
function createRealm() {
  const listeners = new Set<Listener>();
  const posted: Message[] = [];
  const port = {
    postMessage: (message: Message) => posted.push(message),
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    start() {},
  };
  let nextId = 0;
  const realm = {
    napplet: undefined as Record<string, any> | undefined,
    parent: { postMessage() {} },
    MessageChannel: class { port1 = port; port2 = {}; },
    crypto: { randomUUID: () => `id-${++nextId}` },
    addEventListener() {},
    removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {} },
  };
  return {
    realm,
    posted,
    deliver(message: Message) {
      for (const listener of [...listeners]) listener({ data: message, currentTarget: port });
    },
    deliverForeign(message: Message) {
      for (const listener of [...listeners]) listener({ data: message, currentTarget: {} });
    },
  };
}

function run(domains: string[], bindings: Record<string, NappletDomainBinding>) {
  const realm = createRealm();
  const source = renderNappletNamespacePrelude({ domains, bindings }).match(/<script[^>]*>([\s\S]*)<\/script>/)![1]!;
  new Function('window', source)(realm.realm);
  return realm;
}

const TORRENT: NappletDomainBinding = {
  methods: {
    add: { type: 'torrent.add', params: ['request'], reply: true, result: 'ack' },
    remove: { type: 'torrent.remove', params: ['jobId', 'options'], reply: true },
  },
  events: ['torrent.progress', 'torrent.state'],
};
const LOCATION: NappletDomainBinding = {
  methods: { subscribe: { type: 'location.subscribe', params: ['highAccuracy'], reply: false, id: false } },
  events: ['location.state', 'location.position'],
  handlers: { onState: ['location.state'] },
};

describe('table-driven napplet domain bindings', () => {
  it('sends positional wire fields and resolves the named result field', async () => {
    const { realm, posted, deliver } = run(['torrent'], { torrent: TORRENT });
    const ack = realm.napplet!.torrent.add({ source: 'magnet:?xt=urn:btih:abc' });
    expect(posted.at(-1)).toEqual({ type: 'torrent.add', id: 'id-1', request: { source: 'magnet:?xt=urn:btih:abc' } });
    deliver({ type: 'torrent.add.result', id: 'id-1', ack: { jobId: 'j1' } });
    await expect(ack).resolves.toEqual({ jobId: 'j1' });
  });

  it('omits undefined arguments and resolves the whole payload when no single field is named', async () => {
    const { realm, posted, deliver } = run(['torrent'], { torrent: TORRENT });
    const removed = realm.napplet!.torrent.remove('j1');
    expect(posted.at(-1)).toEqual({ type: 'torrent.remove', id: 'id-1', jobId: 'j1' });
    deliver({ type: 'torrent.remove.result', id: 'id-1', removed: true, jobId: 'j1' });
    await expect(removed).resolves.toEqual({ removed: true, jobId: 'j1' });
  });

  it('rejects with the wire error, keeping a structured code', async () => {
    const { realm, deliver } = run(['torrent'], { torrent: TORRENT });
    const failed = realm.napplet!.torrent.add({});
    deliver({ type: 'torrent.add.result', id: 'id-1', error: { code: 'invalid-source', message: 'no source' } });
    await expect(failed).rejects.toMatchObject({ message: 'no source', code: 'invalid-source' });
    const plain = realm.napplet!.torrent.add({});
    deliver({ type: 'torrent.add.result', id: 'id-2', error: 'denied' });
    await expect(plain).rejects.toThrow('denied');
  });

  it('fires result-less requests without an id when the wire has none', async () => {
    const { realm, posted } = run(['location'], { location: LOCATION });
    await expect(realm.napplet!.location.subscribe(true)).resolves.toBeUndefined();
    expect(posted.at(-1)).toEqual({ type: 'location.subscribe', highAccuracy: true });
  });

  it('delivers listed pushes from the private port only, and closes subscriptions', () => {
    const { realm, deliver, deliverForeign } = run(['location'], { location: LOCATION });
    const seen: unknown[] = [];
    const handle = realm.napplet!.location.onState((payload: unknown, type: string) => seen.push([type, payload]));
    const position = realm.napplet!.location.on('position', (payload: unknown) => seen.push(payload));
    deliver({ type: 'location.state', available: true });
    deliver({ type: 'location.position', latitude: 1 });
    deliverForeign({ type: 'location.state', available: false });
    handle.close();
    position.close();
    deliver({ type: 'location.state', available: false });
    expect(seen).toEqual([['location.state', { available: true }], { latitude: 1 }]);
    expect(() => realm.napplet!.location.on('unknown', () => {})).toThrow(TypeError);
  });

  it('keeps the bound namespace frozen and protected from napplet reassignment', () => {
    const { realm } = run(['torrent'], { torrent: TORRENT });
    const api = realm.napplet!.torrent;
    expect(Object.isFrozen(api)).toBe(true);
    realm.napplet!.torrent = { add: () => 'spoofed' };
    expect(realm.napplet!.torrent).toBe(api);
    realm.napplet = { torrent: { add: () => 'spoofed' } };
    expect(realm.napplet!.torrent).toBe(api);
  });
});

describe('serializeDomainBindings', () => {
  it('keeps only exposed, non-built-in domains', () => {
    const relay: NappletDomainBinding = { methods: { query: { type: 'relay.query', params: ['filters'], reply: true } } };
    const out = serializeDomainBindings({ torrent: TORRENT, relay, value: TORRENT }, ['relay', 'torrent']);
    expect(Object.keys(out)).toEqual(['torrent']);
    expect(out.torrent!.methods.add).toEqual({ type: 'torrent.add', params: ['request'], reply: true, id: true, result: 'ack' });
    expect(NAPPLET_PRELUDE_BUILT_IN_DOMAINS).toContain('llm');
  });

  it.each([
    ['foreign wire type', { methods: { add: { type: 'relay.add', params: [], reply: true } } }],
    ['reserved method name', { methods: { on: { type: 'torrent.on', params: [], reply: true } } }],
    ['envelope param', { methods: { add: { type: 'torrent.add', params: ['id'], reply: true } } }],
    ['handler over a non-event', { methods: {}, events: [], handlers: { onState: ['torrent.state'] } }],
    ['badly named handler', { methods: {}, events: ['torrent.state'], handlers: { state: ['torrent.state'] } }],
  ] as const)('rejects a %s', (_label, binding) => {
    expect(() => serializeDomainBindings({ torrent: binding as NappletDomainBinding }, ['torrent'])).toThrow(TypeError);
  });

  it('renders unbound unknown domains as empty presence objects', () => {
    const { realm } = run(['torrent'], {});
    expect(realm.napplet!.torrent).toEqual({});
  });
});
