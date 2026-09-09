import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';

import { createNostrCvmTransport, type CvmRelayPool } from './cvm-nostr-transport.js';
import type { McpMessage } from './cvm-types.js';

const RELAYS = ['wss://relay.test'];

interface SubRecord {
  relays: string[];
  filter: Record<string, unknown>;
  onevent?: (e: NostrEvt) => void;
  oneose?: () => void;
  closed: boolean;
}

interface NostrEvt {
  id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string;
}

/**
 * A mock relay pool wired to a simulated ContextVM server. Published request
 * wraps are decrypted with the server key, handed to `serverBehavior`, and the
 * result is gift-wrapped back to the client and delivered to the live inbound
 * subscription — exercising the real NIP-44 encrypt/decrypt path.
 */
function createServerPool(serverSecretKey: Uint8Array, serverBehavior: (mcp: McpMessage) => unknown | null) {
  const serverPubkey = getPublicKey(serverSecretKey);
  const subs: SubRecord[] = [];
  const publishedPlain: McpMessage[] = [];
  const publishedInnerTags: string[][][] = [];

  const pool: CvmRelayPool = {
    subscribe(relays, filter, params) {
      const rec: SubRecord = { relays, filter, onevent: params.onevent, oneose: params.oneose, closed: false };
      subs.push(rec);
      return { close() { rec.closed = true; } };
    },
    publish(_relays, event) {
      // Decrypt the inbound wrap as the server would.
      try {
        const ck = nip44.getConversationKey(serverSecretKey, event.pubkey);
        const inner = JSON.parse(nip44.decrypt(event.content, ck)) as NostrEvt;
        const mcp = JSON.parse(inner.content) as McpMessage;
        publishedPlain.push(mcp);
        publishedInnerTags.push(inner.tags);
        const result = serverBehavior(mcp);
        if (result === null || result === undefined) return;
        const responseMcp: McpMessage = { jsonrpc: '2.0', id: mcp.id, result };
        deliverEncrypted(responseMcp);
      } catch {
        // ignore (e.g. notifications/initialized has no useful response)
      }
    },
  };

  function deliverEncrypted(mcp: McpMessage, signingKey = serverSecretKey): void {
    const clientPubkey = (subs.find((s) => !s.closed && Array.isArray((s.filter as { ['#p']?: string[] })['#p']))!
      .filter as { ['#p']: string[] })['#p'][0];
    const innerServer = finalizeEvent(
      { kind: 25910, created_at: Math.floor(Date.now() / 1000), tags: [['p', clientPubkey]], content: JSON.stringify(mcp) },
      signingKey,
    );
    const wrapSk = generateSecretKey();
    const wck = nip44.getConversationKey(wrapSk, clientPubkey);
    const wrap = finalizeEvent(
      { kind: 21059, created_at: Math.floor(Date.now() / 1000), tags: [['p', clientPubkey]], content: nip44.encrypt(JSON.stringify(innerServer), wck) },
      wrapSk,
    );
    // Deliver to the active inbound subscription.
    setTimeout(() => {
      const active = subs.find((s) => !s.closed && s.onevent && Array.isArray((s.filter as { ['#p']?: string[] })['#p']));
      active?.onevent?.(wrap as NostrEvt);
    }, 0);
  }

  return { pool, serverPubkey, subs, publishedPlain, publishedInnerTags, deliverEncrypted };
}

describe('createNostrCvmTransport', () => {
  it('round-trips an MCP request through CEP-4 gift wrap and restores the caller id', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, publishedInnerTags } = createServerPool(serverSk, (mcp) =>
      mcp.method === 'tools/list' ? { tools: [{ name: 'calculate_trust_score' }] } : null,
    );
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const response = await transport.request(
      { pubkey: serverPubkey, relays: RELAYS },
      { jsonrpc: '2.0', id: 42, method: 'tools/list' },
    );

    expect(response.id).toBe(42); // original caller id restored
    expect((response.result as { tools: unknown[] }).tools).toHaveLength(1);
    // The wire id sent to the server was a unique correlation id, not 42.
    expect(publishedPlain[0].id).not.toBe(42);
    expect(publishedPlain[0].method).toBe('tools/list');
    expect(publishedInnerTags[0]).toEqual(expect.arrayContaining([
      ['support_encryption'],
      ['support_encryption_ephemeral'],
      ['support_oversized_transfer'],
      ['support_open_stream'],
    ]));
  });

  it('performs the initialize handshake before the request when options.initialize is set', async () => {
    const serverSk = generateSecretKey();
    const seen: string[] = [];
    const { pool, serverPubkey } = createServerPool(serverSk, (mcp) => {
      if (mcp.method) seen.push(mcp.method);
      if (mcp.method === 'initialize') return { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'relatr' } };
      if (mcp.method === 'tools/call') return { content: [{ type: 'text', text: 'ok' }], isError: false };
      return null;
    });
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const result = await transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calculate_trust_score' } },
      { initialize: true },
    );

    expect(seen[0]).toBe('initialize');
    expect(seen).toContain('notifications/initialized');
    expect(seen).toContain('tools/call');
    expect((result.result as { isError: boolean }).isError).toBe(false);
  });

  it('injects a progressToken into tools/call and preserves an explicit token', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain } = createServerPool(serverSk, (mcp) =>
      mcp.method === 'tools/call' ? { ok: true } : null,
    );
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    await transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
    );
    const firstMeta = (publishedPlain[0].params as { _meta: { progressToken: string } })._meta;
    expect(firstMeta.progressToken).toMatch(/^cvm-/);

    await transport.request(
      { pubkey: serverPubkey },
      {
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'chat.complete', arguments: {}, _meta: { progressToken: 'stream-explicit' } },
      },
    );
    const secondMeta = (publishedPlain[1].params as { _meta: { progressToken: string } })._meta;
    expect(secondMeta.progressToken).toBe('stream-explicit');
  });

  it('reassembles an out-of-order CEP-22 oversized response and restores the caller id', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 77, method: 'tools/list' },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: correlationId,
      result: { tools: [{ name: 'über-tool' }], padding: 'x'.repeat(128) },
    });
    const bytes = new TextEncoder().encode(payload);
    const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const digest = [...digestBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const split = Math.floor(payload.length / 2);
    const chunks = [payload.slice(0, split), payload.slice(split)];
    const token = 'oversized-77';
    const progress = (value: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { progressToken: token, progress: value, cvm },
    });

    deliverEncrypted(progress(1, {
      type: 'oversized-transfer', frameType: 'start', digest: `sha256:${digest}`,
      totalBytes: bytes.byteLength, totalChunks: chunks.length,
    }));
    // Response chunks start at progress=2; deliver out of order to prove the
    // reassembler sorts by progress rather than arrival order.
    deliverEncrypted(progress(3, { type: 'oversized-transfer', frameType: 'chunk', data: chunks[1] }));
    deliverEncrypted(progress(2, { type: 'oversized-transfer', frameType: 'chunk', data: chunks[0] }));
    deliverEncrypted(progress(4, { type: 'oversized-transfer', frameType: 'end' }));

    const response = await responsePromise;
    expect(response.id).toBe(77);
    expect((response.result as { tools: Array<{ name: string }> }).tools[0].name).toBe('über-tool');
  });

  it('fans CEP-41 open-stream frames out through onEvent without resolving the request', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 88, method: 'tools/call' },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const frame: McpMessage = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: 'stream-88',
        progress: 2,
        cvm: { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: '{"choices":[]}' },
      },
    };
    deliverEncrypted(frame);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toHaveLength(1);
    expect((events[0].params as { cvm: { type: string } }).cvm.type).toBe('open-stream');

    // Keepalive pings are fanned out and answered with a pong carrying the
    // same progressToken + nonce.
    deliverEncrypted({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: 'stream-88', progress: 3,
        cvm: { type: 'open-stream', frameType: 'ping', nonce: 'nonce-1' },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const pong = publishedPlain.find((message) => {
      const params = message.params as { progressToken?: string; cvm?: { frameType?: string; nonce?: string } } | undefined;
      return params?.progressToken === 'stream-88' && params.cvm?.frameType === 'pong';
    });
    expect(pong).toBeDefined();
    expect((pong!.params as { cvm: { nonce: string } }).cvm.nonce).toBe('nonce-1');

    // A separate normal response settles the request; the progress frame does not.
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 88, result: { ok: true } });
  });

  it('rejects with "relay timeout" when no response arrives', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey } = createServerPool(serverSk, () => null); // server never replies
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    await expect(
      transport.request({ pubkey: serverPubkey }, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { timeoutMs: 40 }),
    ).rejects.toThrow('relay timeout');
  });

  it('ignores a correlated response signed by a different server', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const response = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 9, method: 'tools/list' },
      { timeoutMs: 40 },
    );
    const rejection = expect(response).rejects.toThrow('relay timeout');
    await new Promise((resolve) => setTimeout(resolve, 0));
    deliverEncrypted(
      { jsonrpc: '2.0', id: publishedPlain[0].id, result: { tools: [{ name: 'forged' }] } },
      generateSecretKey(),
    );

    await rejection;
  });

  it('propagates relay publication failure without waiting for timeout', async () => {
    const pool: CvmRelayPool = {
      subscribe() {
        return { close() {} };
      },
      publish() {
        return Promise.reject(new Error('relay rejected'));
      },
    };
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS });

    await expect(transport.request(
      { pubkey: 'a'.repeat(64) },
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { timeoutMs: 1_000 },
    )).rejects.toThrow('relay rejected');
  });

  it('throws "server not found" when no relays are available', async () => {
    const transport = createNostrCvmTransport({ pool: createServerPool(generateSecretKey(), () => null).pool });
    await expect(
      transport.request({ pubkey: 'a'.repeat(64) }, { jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    ).rejects.toThrow('server not found');
  });

  it('parses kind-11316/11317 announcements in discover()', async () => {
    const serverSk = generateSecretKey();
    const serverPubkey = getPublicKey(serverSk);
    const announce = finalizeEvent(
      { kind: 11316, created_at: 1, tags: [['name', 'Relatr'], ['about', 'Social graph trust scores']], content: '{}' },
      serverSk,
    );
    const tools = finalizeEvent(
      { kind: 11317, created_at: 1, tags: [['i', 'hash1', 'calculate_trust_score'], ['i', 'hash2', 'search_profiles']], content: '{}' },
      serverSk,
    );
    const pool: CvmRelayPool = {
      subscribe(_relays, _filter, params) {
        setTimeout(() => {
          params.onevent?.(announce as NostrEvt);
          params.onevent?.(tools as NostrEvt);
          params.oneose?.();
        }, 0);
        return { close() {} };
      },
      publish() {},
    };
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS });

    const servers = await transport.discover({ search: 'trust' });
    expect(servers).toHaveLength(1);
    expect(servers[0].pubkey).toBe(serverPubkey);
    expect(servers[0].name).toBe('Relatr');
    expect(servers[0].capabilities).toEqual(['calculate_trust_score', 'search_profiles']);
  });

  it('filters discover() results by search term', async () => {
    const skA = generateSecretKey();
    const skB = generateSecretKey();
    const a = finalizeEvent({ kind: 11316, created_at: 1, tags: [['name', 'Relatr']], content: '{}' }, skA);
    const b = finalizeEvent({ kind: 11316, created_at: 1, tags: [['name', 'WeatherVM']], content: '{}' }, skB);
    const pool: CvmRelayPool = {
      subscribe(_r, _f, params) {
        setTimeout(() => { params.onevent?.(a as NostrEvt); params.onevent?.(b as NostrEvt); params.oneose?.(); }, 0);
        return { close() {} };
      },
      publish() {},
    };
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS });
    const servers = await transport.discover({ search: 'weather' });
    expect(servers.map((s) => s.name)).toEqual(['WeatherVM']);
  });

  it('close() releases the server session', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, subs } = createServerPool(serverSk, (mcp) => (mcp.method === 'tools/list' ? { tools: [] } : null));
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const server = { pubkey: serverPubkey, relays: RELAYS };
    await transport.request(server, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const openBefore = subs.filter((s) => !s.closed).length;
    await transport.close(server);
    const openAfter = subs.filter((s) => !s.closed).length;
    expect(openAfter).toBeLessThan(openBefore);
  });
});
