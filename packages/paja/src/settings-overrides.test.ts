/**
 * Proves call sites read registered settings at call time, one or more per
 * settings group. Defaults are covered by each module's own tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { neventEncode } from 'nostr-tools/nip19';
import { setActivePajaSettings } from './settings.js';
import { createPajaContactListLoader, type PajaRelayBackend } from './browser-relay-runtime.js';
import { normalizePajaSimulation } from './simulation.js';
import { parsePajaBlossomUri } from './browser-blossom-uri.js';
import { createPajaResourceFetch, pajaResourceInfo } from './browser-resource.js';
import { createPajaBrowserFsBackend } from './browser-fs.js';
import { base64Bytes, encodeBase64, validateRange } from './browser-fs-support.js';
import { createPajaWebrtcProfile } from './browser-webrtc-profile.js';
import { createPajaIntentLink } from './intent-link.js';
import { PAJA_LLM_VAULT_STORAGE_KEY, createPajaLlmVault, validatePajaLlmVaultPassword } from './browser-llm-vault.js';
import { normalizePajaCvmRelays } from './multiplayer-config.js';
import { parseCvmDiscoveryInput } from './cvm-discovery.js';
import { findRelativeAssetReferences } from './local-target.js';
import { appendPajaMessageLog } from './browser-devtools.js';
import { waitForTargetUrl } from './readiness.js';
import { describePointerNotFound, tallyPointerRelayReasons } from './runtime-pointer-outcome.js';
import { findPajaPointerReplacements } from './runtime-pointer-replacements.js';
import { findPajaIntentHandlers } from './intent-handler-discovery.js';
import type { PajaPointerRelayPool } from './runtime-resolver.js';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

const HASH = 'a'.repeat(64);

afterEach(() => {
  setActivePajaSettings({});
  vi.unstubAllGlobals();
});

describe('settings overrides reach their call sites', () => {
  it('relays: bounds contact candidates by relay.contactListCandidateLimit', async () => {
    setActivePajaSettings({ 'relay.contactListCandidateLimit': 3 });
    const pubkey = 'b'.repeat(64);
    const events = Array.from({ length: 6 }, (_, index): NostrEvent => ({
      id: index.toString(16).padStart(64, '0'), pubkey, kind: 3, created_at: index, tags: [], content: '', sig: 'e'.repeat(128),
    }));
    const query = vi.fn(async () => events);
    const loader = createPajaContactListLoader({ query } as unknown as PajaRelayBackend, () => normalizePajaSimulation({ relay: { mode: 'memory' } }));
    expect(await loader(pubkey)).toHaveLength(3);
    expect(query).toHaveBeenCalledWith(expect.any(Array), [expect.objectContaining({ limit: 3 })], 4000);
  });

  it('resources: rejects blossom: URIs longer than blossom.maxUriChars', () => {
    const uri = `blossom:${HASH}.bin?xs=${'s'.repeat(400)}.example`;
    expect(parsePajaBlossomUri(uri)).not.toBeNull();
    setActivePajaSettings({ 'blossom.maxUriChars': 256 });
    expect(parsePajaBlossomUri(uri)).toBeNull();
  });

  it('NAP-RESOURCE: advertises and enforces the same overridden caps', async () => {
    setActivePajaSettings({ 'resource.maxBytes': 1024, 'resource.maxUrls': 3 });
    expect(pajaResourceInfo()).toMatchObject({ maxBytes: 1024, maxUrls: 3 });
    const signal = new AbortController().signal;
    const init = { signal, authorizeNetwork: async <T>(_url: string, run: (s: AbortSignal) => Promise<T>) => run(signal) };
    const fetchResource = createPajaResourceFetch({ fetch: vi.fn() });
    const data = (size: number) => `data:application/octet-stream;base64,${btoa('x'.repeat(size))}`;
    await expect(fetchResource(data(1024), init)).resolves.toBeInstanceOf(Response);
    await expect(fetchResource(data(1025), init)).rejects.toMatchObject({ code: 'too-large', message: 'resource exceeds 1024 bytes' });
  });

  it('NAP-FS: advertises the overridden limits it enforces', async () => {
    setActivePajaSettings({ 'fs.maxReadBytes': 10, 'fs.maxWriteBytes': 4, 'fs.maxWatchCount': 2 });
    const root = { kind: 'directory', name: '', getDirectoryHandle: vi.fn(), getFileHandle: vi.fn(), removeEntry: vi.fn(), entries: vi.fn() };
    const fs = await createPajaBrowserFsBackend({
      getIdentity: () => ({ dTag: 'notes', aggregateHash: 'hash-a' }),
      storage: { getDirectory: async () => root as never },
    });
    expect((await fs!.info('window-a')).limits).toEqual({ maxReadBytes: 10, maxWriteBytes: 4, maxWatchCount: 2 });
    expect(() => validateRange({ length: 11 })).toThrow(expect.objectContaining({ code: 'too-large' }));
  });

  it('filesystem: enforces fs.maxReadBytes and fs.maxWriteBytes', () => {
    setActivePajaSettings({ 'fs.maxReadBytes': 10, 'fs.maxWriteBytes': 4 });
    expect(validateRange({ length: 10 })).toEqual({ offset: 0, length: 10 });
    expect(() => validateRange({ length: 11 })).toThrow(expect.objectContaining({ code: 'too-large' }));
    expect(validateRange(undefined).length).toBe(10);
    expect(() => base64Bytes(encodeBase64(new Uint8Array(5)))).toThrow(expect.objectContaining({ code: 'too-large' }));
  });

  it('multiplayer WebRTC: validates rooms against mp.roomMaxChars', () => {
    const profile = createPajaWebrtcProfile({
      secretKey: generateSecretKey(), namespace: 'test', relays: ['wss://relay.example'],
      relay: { subscribe: () => ({ close() {} }), publish: async () => {} }, isCurrent: () => true,
    });
    const request = { scope: { type: 'room' as const, room: 'r'.repeat(40) } };
    expect(() => profile.planOpen!(request as never, {} as never)).not.toThrow();
    setActivePajaSettings({ 'mp.roomMaxChars': 32 });
    expect(() => profile.planOpen!(request as never, {} as never)).toThrow('Invalid room');
  });

  it('intents: caps shareable links at intent.linkMaxBytes', () => {
    const descriptor = { uri: 'napplet:note/open', payload: 'x'.repeat(2000) };
    expect(() => createPajaIntentLink(descriptor, 'https://paja.example/')).not.toThrow();
    setActivePajaSettings({ 'intent.linkMaxBytes': 1024 });
    expect(() => createPajaIntentLink(descriptor, 'https://paja.example/')).toThrow('must not exceed 1024 UTF-8 bytes');
  });

  it('language models: raises the vault password floor', () => {
    setActivePajaSettings({ 'vault.minPasswordLength': 32 });
    expect(validatePajaLlmVaultPassword('correct horse battery staple')).toBe('Use at least 32 characters.');
  });

  it('language models: keeps the iterations an existing vault was derived with', async () => {
    const storage = new MemoryStorage();
    await createPajaLlmVault({ storage, iterations: 1000 }).create('correct horse battery staple');
    const reopened = createPajaLlmVault({ storage, iterations: 2000 });
    await expect(reopened.unlock('correct horse battery staple')).resolves.toBe(true);
    await reopened.setCredential('conn-1', 'sk-secret', 'vault');
    expect(JSON.parse(storage.getItem(PAJA_LLM_VAULT_STORAGE_KEY)!)).toMatchObject({ iterations: 1000 });
    await expect(createPajaLlmVault({ storage }).unlock('correct horse battery staple')).resolves.toBe(true);
  });

  it('multiplayer providers: bounds relay lists and discovery input', () => {
    const relays = ['wss://a.example', 'wss://b.example'];
    expect(normalizePajaCvmRelays(relays)).toEqual(relays);
    setActivePajaSettings({ 'multiplayer.maxRelays': 1, 'cvm.referenceMaxChars': 64 });
    expect(() => normalizePajaCvmRelays(relays)).toThrow('Configure 1–1 relay URLs.');
    expect(() => parseCvmDiscoveryInput(`https://${'x'.repeat(80)}.example`)).toThrow(/Enter a nevent/);
    expect(parseCvmDiscoveryInput(HASH)).toEqual({ type: 'hash', hash: HASH });
  });

  it('development target: limits reported relative assets', () => {
    const html = ['a', 'b', 'c'].map((name) => `<script src="./${name}.js"></script>`).join('');
    expect(findRelativeAssetReferences(html)).toHaveLength(3);
    setActivePajaSettings({ 'target.maxReportedAssets': 2 });
    expect(findRelativeAssetReferences(html)).toEqual(['./a.js', './b.js']);
  });

  it('development target: bounds pointer-miss relay reasons by target.failureReason*', () => {
    setActivePajaSettings({ 'target.failureReasonChars': 16, 'target.failureReasonCount': 1 });
    const relays = ['wss://a.example', 'wss://b.example'];
    const tally = tallyPointerRelayReasons(relays, ['connection failed: '.repeat(4), 'blocked: rate limited']);
    expect(tally.failed.map((entry) => entry.reason)).toEqual(['connection faile', 'blocked: rate li']);
    expect(describePointerNotFound('nevent', tally)).toContain('(wss://a.example: connection faile; +1 more)');
  });

  it('intent discovery: caps the relay filter and the offers by intent.discoveryLimit', async () => {
    setActivePajaSettings({ 'intent.discoveryLimit': 3 });
    const key = generateSecretKey();
    const events = Array.from({ length: 5 }, (_, index) => finalizeEvent({
      kind: 35129, created_at: 100 + index, content: 'handler',
      tags: [['d', `h${index}`], ['x', 'a'.repeat(64)], ['z', 'note'], ['i', 'napplet:note/open']],
    }, key) as NostrEvent);
    const filters: unknown[] = [];
    const offers = await findPajaIntentHandlers({ archetype: 'note', convention: 'napplet:note/open' }, {
      relays: ['wss://relay.example'],
      pool: { async querySync(_relays, filter) { filters.push(filter); return events; } },
    });
    expect(filters).toEqual([expect.objectContaining({ limit: 3 })]);
    expect(offers).toHaveLength(3);
  });

  it('development target: caps nevent replacement lookups by target.pointerReplacementLimit and target.runtimeWaitMs', async () => {
    setActivePajaSettings({ 'target.pointerReplacementLimit': 7, 'target.runtimeWaitMs': 1234 });
    const filters: unknown[] = [];
    const waits: number[] = [];
    const pool: PajaPointerRelayPool = {
      async querySync() { return []; },
      subscribeManyEose(_relays, filter, params) {
        filters.push(filter);
        waits.push(params.maxWait ?? -1);
        setTimeout(() => params.onclose(['closed automatically on eose']), 0);
        return { close: () => undefined };
      },
    };
    const nevent = neventEncode({ id: 'c'.repeat(64), author: 'd'.repeat(64), kind: 35129, relays: [] });
    await findPajaPointerReplacements(nevent, { relays: ['wss://relay.example'], pool });
    expect(filters).toEqual([expect.objectContaining({ limit: 7 })]);
    expect(waits).toEqual([1234]);
  });

  it('console: trims the message log to console.messageLogLimit', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    setActivePajaSettings({ 'console.messageLogLimit': 10 });
    const state = { messageLog: [] as unknown[] } as Parameters<typeof appendPajaMessageLog>[0];
    for (let index = 0; index < 15; index += 1) appendPajaMessageLog(state, 'napplet->shell', { type: `m${String(index)}` });
    expect(state!.messageLog).toHaveLength(10);
  });

  it('server: polls readiness at server.readinessPollIntervalMs', async () => {
    setActivePajaSettings({ 'server.readinessPollIntervalMs': 1234 });
    const sleeps: number[] = [];
    let attempt = 0;
    await waitForTargetUrl('http://127.0.0.1:5173', {
      timeoutMs: 10_000,
      fetch: async () => { attempt += 1; if (attempt < 2) throw new Error('down'); return new Response('ok'); },
      sleep: async (ms) => { sleeps.push(ms); },
      now: () => 0,
    });
    expect(sleeps).toEqual([1234]);
  });
});
