import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { neventEncode } from 'nostr-tools/nip19';
import { discoverCvmFamilies, parseCvmDiscoveryInput, type CvmDiscoveryDependencies } from './cvm-discovery.js';
import { mergeCvmFamilies, readCvmFamilies, saveCvmFamilies } from './cvm-family-store.js';

// CEP-15 published worked example, independently pinned by the services suite.
const HASH = 'c042f92e9ab085590656cea78e2628d44ffed49ea8da90aa32e208155fedd84e';
const tool = { name: 'get_weather', inputSchema: { properties: { location: { type: 'string' } }, required: ['location'] }, outputSchema: { properties: { temperature: { type: 'number' } }, required: ['temperature'] }, _meta: { 'io.contextvm/common-schema': { schemaHash: HASH } } };
const RELAY = 'wss://relay.example';
const key = generateSecretKey();
const event = (overrides = {}, secret = key) => finalizeEvent({ kind: 11317, content: JSON.stringify({ tools: [tool] }), tags: [['i', HASH, tool.name], ['k', 'io.contextvm/common-schema']], created_at: 10, ...overrides }, secret);
const signal = () => new AbortController().signal;
function dependencies(events = [event()]): CvmDiscoveryDependencies {
  return { relays: [RELAY], query: vi.fn(async () => events), fetch: vi.fn() };
}
afterEach(() => vi.unstubAllGlobals());

describe('CVM discovery', () => {
  it('detects hash, HTTPS origin, and nevent, rejecting naddr and unsafe URLs', () => {
    expect(parseCvmDiscoveryInput(HASH.toUpperCase())).toEqual({ type: 'hash', hash: HASH });
    expect(parseCvmDiscoveryInput('https://provider.example/path?a=b')).toEqual({ type: 'website', url: 'https://provider.example/.well-known/napplet.json' });
    expect(parseCvmDiscoveryInput('provider.example')).toEqual({ type: 'website', url: 'https://provider.example/.well-known/napplet.json' });
    const e = event();
    expect(parseCvmDiscoveryInput(`nostr:${neventEncode({ id: e.id, author: e.pubkey, relays: [RELAY], kind: 11317 })}`)).toMatchObject({ type: 'event', id: e.id, relays: [RELAY], author: e.pubkey });
    for (const input of ['naddr1invalid', 'http://provider.example', 'https://user:pass@provider.example', 'javascript:alert(1)', 'soy.rooms.v1 ' + 'x'.repeat(4096)]) expect(() => parseCvmDiscoveryInput(input)).toThrow();
    expect(() => parseCvmDiscoveryInput(neventEncode({ id: e.id, kind: 1 }))).toThrow('11316 or 11317');
  });

  it('returns multiple verified providers for a hash without selecting one', async () => {
    const a = event(), b = event({}, generateSecretKey());
    const deps = dependencies([a, b]);
    const found = await discoverCvmFamilies(HASH, deps, signal());
    expect(found).toHaveLength(2);
    expect(found[0].config.tools).toEqual([{ name: tool.name, schemaHash: HASH }]);
    expect(deps.query).toHaveBeenCalledWith([RELAY], [{ kinds: [11317], '#i': [HASH], limit: 64 }], expect.any(AbortSignal));
  });

  it('uses nevent relay hints and enforces exact id/author and signature', async () => {
    const target = event();
    const pointer = neventEncode({ id: target.id, author: target.pubkey, relays: ['wss://hint.example'] });
    const deps = dependencies([event({}, generateSecretKey()), { ...target, content: '{}' }, target]);
    expect((await discoverCvmFamilies(pointer, deps, signal()))[0].eventId).toBe(target.id);
    expect(deps.query).toHaveBeenCalledWith(['wss://hint.example'], expect.any(Array), expect.any(AbortSignal));
    await expect(discoverCvmFamilies(pointer, dependencies([{ ...target, sig: '00'.repeat(64) }]), signal())).rejects.toThrow('No verified');
    await expect(discoverCvmFamilies(neventEncode({ id: target.id, author: event({}, generateSecretKey()).pubkey }), dependencies([target]), signal())).rejects.toThrow('No verified');
  });

  it('resolves a server announcement to its authored tool list', async () => {
    const server = event({ kind: 11316, content: '{}' }), inventory = event();
    const deps = dependencies([server, inventory]);
    const found = await discoverCvmFamilies(neventEncode({ id: server.id }), deps, signal());
    expect(found[0].eventId).toBe(inventory.id);
    expect(deps.query).toHaveBeenCalledWith([RELAY], [{ kinds: [11317], authors: [server.pubkey], limit: 64 }], expect.any(AbortSignal));
  });

  it('uses a verified provider relay list after finding an inventory on a discovery relay', async () => {
    const tools = event(), relays = event({ kind: 10002, tags: [['r', 'wss://service.example']], content: '' });
    const found = await discoverCvmFamilies(HASH, dependencies([tools, relays]), signal());
    expect(found[0].config.server.relays).toEqual(['wss://service.example']);
  });

  it('resolves website hints with no credentials and verifies untagged inventories', async () => {
    const inventory = event({ tags: [] });
    const deps = dependencies([inventory, event({}, generateSecretKey())]);
    deps.fetch = vi.fn(async () => new Response(JSON.stringify({ version: 1, backend: { pubkey: inventory.pubkey, relays: ['wss://provider.example'] } })));
    const found = await discoverCvmFamilies('provider.example', deps, signal());
    expect(found).toHaveLength(1);
    expect(found[0].source).toContain('https://provider.example/.well-known/napplet.json');
    expect(found[0].config.server.relays).toEqual(['wss://provider.example']);
    expect(deps.fetch).toHaveBeenCalledWith('https://provider.example/.well-known/napplet.json', expect.objectContaining({ credentials: 'omit', redirect: 'error' }));
    await expect(discoverCvmFamilies(HASH, dependencies([inventory]), signal())).rejects.toThrow('No verified');
  });

  it('rejects malformed discovery documents and reports CORS/network failure', async () => {
    const deps = dependencies();
    for (const document of [{}, { version: 1, backend: { pubkey: event().pubkey, relays: ['https://example.com'] } }]) {
      deps.fetch = vi.fn(async () => new Response(JSON.stringify(document)));
      await expect(discoverCvmFamilies('provider.example', deps, signal())).rejects.toThrow();
    }
    deps.fetch = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(discoverCvmFamilies('provider.example', deps, signal())).rejects.toThrow('CORS');
  });

  it('rejects hash mismatches, duplicate names, partial inventories, and false hash claims', async () => {
    for (const tools of [[{ ...tool, inputSchema: { type: 'string' } }], [tool, tool]]) {
      await expect(discoverCvmFamilies(HASH, dependencies([event({ content: JSON.stringify({ tools }) })]), signal())).rejects.toThrow();
    }
    await expect(discoverCvmFamilies(HASH, dependencies([event({ content: JSON.stringify({ tools: [tool], nextCursor: 'next' }) })]), signal())).rejects.toThrow('complete inventory');
    const fake = '0'.repeat(64);
    await expect(discoverCvmFamilies(fake, dependencies([event({ tags: [['i', fake]] })]), signal())).rejects.toThrow('does not implement');
  });

  it('uses newest replacement and does not fall back to old valid schemas', async () => {
    const old = event(), newer = event({ created_at: 11, content: '{}' });
    await expect(discoverCvmFamilies(HASH, dependencies([old, newer]), signal())).rejects.toThrow('complete inventory');
    const next = event({ created_at: 12 });
    expect((await discoverCvmFamilies(HASH, dependencies([old, next]), signal()))[0].eventId).toBe(next.id);
  });

  it('does not apply results after cancellation', async () => {
    const controller = new AbortController();
    const deps = dependencies();
    deps.query = vi.fn(async () => { controller.abort(); return [event()]; });
    await expect(discoverCvmFamilies(HASH, deps, controller.signal)).rejects.toThrow();
  });
});

describe('persistent CVM families', () => {
  it('round-trips provenance and merges multiple labels/providers without replacing other settings', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const [candidate] = await discoverCvmFamilies(HASH, dependencies(), signal());
    const first = { config: { ...candidate.config, family: 'weather.v1' }, source: candidate.source, manual: false };
    const second = { config: { ...candidate.config, family: 'other.v1' }, source: 'Manual JSON', manual: true };
    saveCvmFamilies([first, second]);
    expect(readCvmFamilies()).toEqual([first, second]);
    expect(mergeCvmFamilies([first.config], readCvmFamilies())).toEqual([first.config, second.config]);
    saveCvmFamilies([second]);
    expect(readCvmFamilies()).toEqual([second]);
    expect(() => saveCvmFamilies(Array(17).fill(first))).toThrow('16');
    expect(readCvmFamilies()).toEqual([second]);
    storage.set('kehto:paja:cvm-families:v1', '{invalid');
    expect(readCvmFamilies()).toEqual([]);
  });
});
