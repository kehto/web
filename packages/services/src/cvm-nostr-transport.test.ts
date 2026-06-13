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
        const result = serverBehavior(mcp);
        if (result === null || result === undefined) return;
        const responseMcp: McpMessage = { jsonrpc: '2.0', id: mcp.id, result };
        deliverEncrypted(responseMcp);
      } catch {
        // ignore (e.g. notifications/initialized has no useful response)
      }
    },
  };

  function deliverEncrypted(mcp: McpMessage): void {
    const clientPubkey = (subs.find((s) => !s.closed && Array.isArray((s.filter as { ['#p']?: string[] })['#p']))!
      .filter as { ['#p']: string[] })['#p'][0];
    const innerServer = finalizeEvent(
      { kind: 25910, created_at: Math.floor(Date.now() / 1000), tags: [['p', clientPubkey]], content: JSON.stringify(mcp) },
      serverSecretKey,
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

  return { pool, serverPubkey, subs, publishedPlain };
}

describe('createNostrCvmTransport', () => {
  it('round-trips an MCP request through CEP-4 gift wrap and restores the caller id', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain } = createServerPool(serverSk, (mcp) =>
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

  it('rejects with "relay timeout" when no response arrives', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey } = createServerPool(serverSk, () => null); // server never replies
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    await expect(
      transport.request({ pubkey: serverPubkey }, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { timeoutMs: 40 }),
    ).rejects.toThrow('relay timeout');
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
