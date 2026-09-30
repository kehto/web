import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';

import { createNostrCvmTransport, type CvmRelayPool } from './cvm-nostr-transport.js';
import type { McpMessage } from './cvm-types.js';

const RELAYS = ['wss://relay.test'];

/** Minimal Node process surface for the unhandled-rejection probe (no @types/node in this package). */
declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
};

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

/** Lowercase hex sha256 of a string, matching the CEP-22 digest format. */
async function sha256Digest(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The progress token the transport injected on the first published request. */
function injectedToken(published: McpMessage[]): string | number {
  const params = published[0].params as { _meta?: { progressToken?: string | number } } | undefined;
  const token = params?._meta?.progressToken;
  if (token === undefined) throw new Error('request carried no injected progress token');
  return token;
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
      { jsonrpc: '2.0', id: 77, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
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
    // CEP-22 frames must address the token the transport issued on the request.
    const token = injectedToken(publishedPlain);
    const progress = (value: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { progressToken: token, progress: value, cvm },
    });

    deliverEncrypted(progress(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render', digest: `sha256:${digest}`,
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
    const token = injectedToken(publishedPlain);
    const start: McpMessage = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { progressToken: token, progress: 1, cvm: { type: 'open-stream', frameType: 'start' } },
    };
    const frame: McpMessage = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: token,
        progress: 2,
        cvm: { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: '{"choices":[]}' },
      },
    };
    deliverEncrypted(start);
    deliverEncrypted(frame);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toHaveLength(2); // start + chunk
    expect((events[1].params as { cvm: { type: string } }).cvm.type).toBe('open-stream');

    // Keepalive pings are fanned out and answered with a pong carrying the
    // same progressToken + nonce.
    deliverEncrypted({
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: token, progress: 3,
        cvm: { type: 'open-stream', frameType: 'ping', nonce: 'nonce-1' },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const pong = publishedPlain.find((message) => {
      const params = message.params as { progressToken?: string; cvm?: { frameType?: string; nonce?: string } } | undefined;
      return params?.progressToken === String(token) && params.cvm?.frameType === 'pong';
    });
    expect(pong).toBeDefined();
    expect((pong!.params as { cvm: { nonce: string } }).cvm.nonce).toBe('nonce-1');

    // A separate normal response settles the request; the progress frame does not.
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 88, result: { ok: true } });
  });

  it('drops CEP-22 frames signed by a server the token was not issued to', async () => {
    const serverSk = generateSecretKey();
    const attackerSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
      { timeoutMs: 100 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);

    // A foreign signer buffers a self-consistent, correctly digest'd payload
    // under the real token; only the terminal frame is signed by the requested
    // server. None of the foreign bytes may be attributed to it.
    const forged = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { forged: true } });
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(forged)}`,
      totalBytes: new TextEncoder().encode(forged).byteLength, totalChunks: 1,
    }), attackerSk);
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: forged }), attackerSk);
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('ignores CEP-22 frames for a token no request carried', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
      { timeoutMs: 100 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    // A well-formed transfer for a token the client never issued must not
    // create buffers or resolve anything.
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 'cvm-unknown', result: { unsolicited: true } });
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: 'never-issued', progress, cvm },
    });
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(payload)}`,
      totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 1,
    }));
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('fails CEP-22 starts that lack required metadata or use an unsupported completion mode', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 120 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const payload = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { smuggled: true } });
    const digest = await sha256Digest(payload);
    const totalBytes = new TextEncoder().encode(payload).byteLength;
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    // Unsupported completion mode with otherwise complete metadata.
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'inline',
      digest: `sha256:${digest}`, totalBytes, totalChunks: 1,
    }));
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'end' }));

    // Missing digest and both totals with the right mode.
    deliverEncrypted(frame(4, { type: 'oversized-transfer', frameType: 'start', completionMode: 'render' }));
    deliverEncrypted(frame(5, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(6, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('fails CEP-22 transfers that exceed their declared chunk or byte bounds', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
      { timeoutMs: 120 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const payload = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { padded: 'y'.repeat(64) } });
    const digest = await sha256Digest(payload);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    // Declares one chunk, then streams two: the second fails the transfer.
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${digest}`, totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 1,
    }));
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: payload.slice(0, 8) }));
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'chunk', data: payload.slice(8) }));
    deliverEncrypted(frame(4, { type: 'oversized-transfer', frameType: 'end' }));

    // Declares fewer bytes than the single chunk carries.
    deliverEncrypted(frame(5, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${digest}`, totalBytes: 4, totalChunks: 1,
    }));
    deliverEncrypted(frame(6, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(7, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('refreshes the request deadline when an admitted frame arrives on an explicit token', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      {
        jsonrpc: '2.0', id: 9, method: 'tools/call',
        params: { name: 'chat.complete', arguments: {}, _meta: { progressToken: 'explicit-9' } },
      },
      { timeoutMs: 250 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    expect(injectedToken(publishedPlain)).toBe('explicit-9');
    const bogusDigest = await sha256Digest('unused');

    // A valid start at ~120 ms extends the deadline past the original 250 ms.
    await new Promise((resolve) => setTimeout(resolve, 120));
    deliverEncrypted({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: {
        progressToken: 'explicit-9', progress: 1,
        cvm: {
          type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
          digest: `sha256:${bogusDigest}`, totalBytes: 1, totalChunks: 1,
        },
      },
    });

    // The original deadline has passed; the request must still resolve.
    await new Promise((resolve) => setTimeout(resolve, 180));
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });

    await expect(responsePromise).resolves.toMatchObject({ id: 9, result: { ok: true } });
  });

  it('drops CEP-41 frames for unissued tokens or foreign signers, and after close', async () => {
    const serverSk = generateSecretKey();
    const attackerSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 500 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const streamFrame = (progressToken: string | number, progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken, progress, cvm },
    });

    // A foreign signer quoting the real token: no fan-out, no pong.
    deliverEncrypted(streamFrame(token, 1, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'x' }), attackerSk);
    deliverEncrypted(streamFrame(token, 2, { type: 'open-stream', frameType: 'ping', nonce: 'n1' }), attackerSk);
    // The expected signer on a token the client never issued: dropped too.
    deliverEncrypted(streamFrame('never-issued', 3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'x' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(0);
    expect(publishedPlain.filter((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'pong';
    })).toHaveLength(0);

    // Admitted start/chunk/close are fanned out; the close ends the stream.
    deliverEncrypted(streamFrame(token, 4, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(streamFrame(token, 5, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'x' }));
    deliverEncrypted(streamFrame(token, 6, { type: 'open-stream', frameType: 'close' }));
    deliverEncrypted(streamFrame(token, 7, { type: 'open-stream', frameType: 'chunk', chunkIndex: 1, data: 'x' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(3); // start + chunk + close; the post-close chunk is dropped

    // The correlated response still settles the request after the close.
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 10, result: { ok: true } });
  });

  it('admits CEP-22 replies for an explicit progress token on a non-tools/call method', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 21, method: 'tools/list', params: { _meta: { progressToken: 'list-token' } } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    // The explicit token passed through untouched; nothing was injected.
    expect((publishedPlain[0].params as { _meta: { progressToken: string } })._meta.progressToken).toBe('list-token');

    const payload = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { tools: [{ name: 'big-tool' }] } });
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: 'list-token', progress, cvm },
    });
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(payload)}`,
      totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 1,
    }));
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).resolves.toMatchObject({ id: 21, result: { tools: [{ name: 'big-tool' }] } });
  });

  it('admits an oversized final response that arrives after the stream closed', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 22, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    // The CEP-41 stream runs and closes; close ends the stream, not the request.
    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'partial' }));
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'close' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(3);

    // The final JSON-RPC response then arrives as a CEP-22 oversized
    // transfer on the same token; stream termination must not have ended
    // request admission.
    const payload = JSON.stringify({
      jsonrpc: '2.0', id: correlationId,
      result: { content: [{ type: 'text', text: 'done' }], isError: false },
    });
    deliverEncrypted(frame(4, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(payload)}`,
      totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 1,
    }));
    deliverEncrypted(frame(5, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    deliverEncrypted(frame(6, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).resolves.toMatchObject({ id: 22, result: { isError: false } });
  });

  it('reassembles a CEP-22 payload whose surrogate pair is split across chunks', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 23, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);

    const payload = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { text: 'emoji: 😀!' } });
    // Split the emoji's UTF-16 surrogate pair across the chunk boundary:
    // each half encodes as 3 UTF-8 bytes (U+FFFD) in isolation, but the
    // joined payload carries the correct 4-byte sequence and digest.
    const emojiIndex = payload.indexOf('😀');
    const chunks = [payload.slice(0, emojiIndex + 1), payload.slice(emojiIndex + 1)];
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });
    deliverEncrypted(frame(1, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(payload)}`,
      totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 2,
    }));
    deliverEncrypted(frame(2, { type: 'oversized-transfer', frameType: 'chunk', data: chunks[0] }));
    deliverEncrypted(frame(3, { type: 'oversized-transfer', frameType: 'chunk', data: chunks[1] }));
    deliverEncrypted(frame(4, { type: 'oversized-transfer', frameType: 'end' }));

    const response = await responsePromise;
    expect((response.result as { text: string }).text).toBe('emoji: 😀!');
  });

  it('rejects CEP-22 starts whose progress range overflows safe integers', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 24, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
      { timeoutMs: 100 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    // 2**53 - 1 is a safe integer, but chunks/end beyond it are not: past
    // 2**53 the double `p + 1 === p`, so range arithmetic cannot terminate.
    // The start must be rejected outright instead of hanging the event loop.
    deliverEncrypted(frame(Number.MAX_SAFE_INTEGER, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest('x')}`, totalBytes: 1, totalChunks: 2,
    }));
    deliverEncrypted(frame(2 ** 53, { type: 'oversized-transfer', frameType: 'chunk', data: 'x' }));
    deliverEncrypted(frame(2 ** 53 + 2, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('rejects a CEP-22 end whose progress is not after the chunk sequence', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 241, method: 'tools/call', params: { name: 'models.list', arguments: {} } },
      { timeoutMs: 100 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const payload = JSON.stringify({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });
    deliverEncrypted(frame(10, {
      type: 'oversized-transfer', frameType: 'start', completionMode: 'render',
      digest: `sha256:${await sha256Digest(payload)}`,
      totalBytes: new TextEncoder().encode(payload).byteLength, totalChunks: 1,
    }));
    deliverEncrypted(frame(11, { type: 'oversized-transfer', frameType: 'chunk', data: payload }));
    // A valid one-chunk transfer starting at 10 must end at 12. Matching
    // bytes and digest cannot make this non-monotonic end valid.
    deliverEncrypted(frame(9, { type: 'oversized-transfer', frameType: 'end' }));

    await expect(responsePromise).rejects.toThrow('relay timeout');
  });

  it('close(server) rejects in-flight requests and releases their token bindings', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, (mcp) =>
      // Only the reopened call is answered; the first stays in flight.
      mcp.method === 'tools/call' && (mcp.params as { name?: string })?.name === 'b' ? { ok: true } : null,
    );
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const server = { pubkey: serverPubkey, relays: RELAYS };
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const first = transport.request(
      server,
      { jsonrpc: '2.0', id: 25, method: 'tools/call', params: { name: 'a', arguments: {}, _meta: { progressToken: 'reuse' } } },
      { timeoutMs: 1_000 },
    );
    const firstSettled = expect(first).rejects.toThrow('server closed');
    // A second server on the same relay keeps the shared inbound
    // subscription open after the first server is closed.
    const other = transport.request(
      { pubkey: getPublicKey(generateSecretKey()), relays: RELAYS },
      { jsonrpc: '2.0', id: 90, method: 'tools/list' },
      { timeoutMs: 60_000 },
    );
    const otherSettled = expect(other).rejects.toThrow('transport disposed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await transport.close(server);
    await firstSettled;

    // Frames from the closed server still arrive on the shared relay, but
    // are no longer admitted: close released the token binding.
    deliverEncrypted({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: 'reuse', progress: 1, cvm: { type: 'open-stream', frameType: 'start' } },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(0);

    // Reopening with the same explicit token must not collide with the
    // released binding.
    const second = await transport.request(
      server,
      { jsonrpc: '2.0', id: 26, method: 'tools/call', params: { name: 'b', arguments: {}, _meta: { progressToken: 'reuse' } } },
      { timeoutMs: 1_000 },
    );
    expect(second.result).toEqual({ ok: true });
    expect(publishedPlain).toHaveLength(2);
    transport.dispose();
    await otherSettled;
  });

  it('gates CEP-41 chunks on start and delivers them in contiguous chunkIndex order', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 27, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    // A chunk before any start is dropped: the stream has not begun.
    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'early' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(0);

    // Simulate relay reordering: the sender's logical sequence is index 0 at
    // progress 3 then index 1 at progress 4, but index 1 arrives first. It is
    // buffered until the earlier logical frame arrives, then both fan out.
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(frame(4, { type: 'open-stream', frameType: 'chunk', chunkIndex: 1, data: 'world' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(1); // start only
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'hello ' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(3);
    const chunkData = events.slice(1).map((m) => (m.params as { cvm: { data: string } }).cvm.data);
    expect(chunkData).toEqual(['hello ', 'world']);

    // close declares the completeness bound; it is satisfied here.
    deliverEncrypted(frame(5, { type: 'open-stream', frameType: 'close', lastChunkIndex: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(4);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 27, result: { ok: true } });
  });

  it('fails CEP-41 chunks whose logical progress reverses chunkIndex order', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));
    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 271, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });
    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    // This is sender-order reversal, not relay reordering: progress says index
    // 1 logically precedes index 0. Neither chunk may reach the application.
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'chunk', chunkIndex: 1, data: 'second' }));
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'first' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(1); // start only
    expect(publishedPlain.some((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'abort';
    })).toBe(true);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 271, result: { ok: true } });
  });

  it('fails a CEP-41 stream on non-monotonic progress and ignores later frames', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 28, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'x' }));
    // progress 2 after 3 is non-monotonic: the stream MUST fail.
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'chunk', chunkIndex: 1, data: 'y' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(2); // start + first chunk only
    // The failure is reported with a best-effort abort on the same token.
    const abort = publishedPlain.find((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'abort';
    });
    expect(abort).toBeDefined();
    // Later frames for the terminated stream are ignored.
    deliverEncrypted(frame(4, { type: 'open-stream', frameType: 'chunk', chunkIndex: 1, data: 'y' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(2);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 28, result: { ok: true } });
  });

  it('fails a CEP-41 stream on a duplicate start', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 29, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    // A second start on an already active stream MUST fail it (CEP-41).
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'x' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(1); // the first start only
    expect(publishedPlain.some((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'abort';
    })).toBe(true);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 29, result: { ok: true } });
  });

  it('probes an idle CEP-41 stream with ping and fails it when no pong arrives', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({
      pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey(),
      streamIdleTimeoutMs: 60, streamProbeTimeoutMs: 60,
    });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 30, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(1);

    // No further frames: after the idle timeout the transport pings the peer.
    await new Promise((resolve) => setTimeout(resolve, 110));
    const ping = publishedPlain.find((message) => {
      const params = message.params as { cvm?: { frameType?: string; nonce?: string } } | undefined;
      return params?.cvm?.frameType === 'ping';
    });
    expect(ping).toBeDefined();
    const pingParams = ping!.params as { progressToken: string | number; cvm: { nonce: string } };
    expect(pingParams.progressToken).toBe(token);
    expect(new TextEncoder().encode(pingParams.cvm.nonce).byteLength).toBeLessThanOrEqual(64);

    // No pong arrives: after the probe timeout the stream fails with abort.
    await new Promise((resolve) => setTimeout(resolve, 110));
    const abort = publishedPlain.find((message) => {
      const params = message.params as { cvm?: { frameType?: string; reason?: string } } | undefined;
      return params?.cvm?.frameType === 'abort';
    });
    expect(abort).toBeDefined();
    expect((abort!.params as { cvm: { reason: string } }).cvm.reason).toBe('probe timeout');

    // The failed stream ignores later frames; the request itself stays
    // alive until its own response arrives.
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'late' }));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toHaveLength(1);
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 30, result: { ok: true } });
  });

  it('does not treat malformed or unknown CEP-41 frames as liveness activity', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({
      pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey(),
      streamIdleTimeoutMs: 50, streamProbeTimeoutMs: 500,
    });
    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 301, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'future-frame' }));
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'ping' })); // missing nonce
    // The original 50 ms idle deadline must still fire. If either malformed
    // frame refreshed it, no ping would exist at this point.
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(publishedPlain.some((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'ping';
    })).toBe(true);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 301, result: { ok: true } });
  });

  it('keeps an idle CEP-41 stream alive only when the pong matches the probe nonce', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({
      pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey(),
      streamIdleTimeoutMs: 60, streamProbeTimeoutMs: 200,
    });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
      { timeoutMs: 2_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const token = injectedToken(publishedPlain);
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: token, progress, cvm },
    });

    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    // Wait for the idle ping and learn its nonce.
    await new Promise((resolve) => setTimeout(resolve, 120));
    const ping = publishedPlain.find((message) => {
      const params = message.params as { cvm?: { frameType?: string; nonce?: string } } | undefined;
      return params?.cvm?.frameType === 'ping';
    });
    expect(ping).toBeDefined();
    const nonce = (ping!.params as { cvm: { nonce: string } }).cvm.nonce;

    // A pong with an unknown nonce is not liveness evidence (CEP-41).
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'pong', nonce: 'bogus' }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    // The matching pong satisfies the probe; the stream survives.
    deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'pong', nonce }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    deliverEncrypted(frame(4, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'alive' }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(events).toHaveLength(2); // start + chunk

    // Past the original probe deadline, no abort was ever published.
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(publishedPlain.some((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'abort';
    })).toBe(false);

    deliverEncrypted(frame(5, { type: 'open-stream', frameType: 'close', lastChunkIndex: 0 }));
    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 31, result: { ok: true } });
  });

  it('preserves a numeric progressToken type in CEP-41 pongs', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey, publishedPlain, deliverEncrypted } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });

    const responsePromise = transport.request(
      { pubkey: serverPubkey },
      { jsonrpc: '2.0', id: 32, method: 'tools/call', params: { name: 'chat.complete', arguments: {}, _meta: { progressToken: 7 } } },
      { timeoutMs: 1_000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const correlationId = publishedPlain[0].id;
    const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
      jsonrpc: '2.0', method: 'notifications/progress',
      params: { progressToken: 7, progress, cvm },
    });
    deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
    deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'ping', nonce: 'n-7' }));
    await new Promise((resolve) => setTimeout(resolve, 25));

    const pong = publishedPlain.find((message) => {
      const params = message.params as { cvm?: { frameType?: string } } | undefined;
      return params?.cvm?.frameType === 'pong';
    });
    expect(pong).toBeDefined();
    // A peer matching on its original numeric token discards a stringified pong.
    const pongParams = pong!.params as { progressToken: unknown; progress: number };
    expect(pongParams.progressToken).toBe(7);
    expect(typeof pongParams.progressToken).toBe('number');
    // Progress is monotonic per direction (CEP-41): the peer's start=1 and
    // ping=2 advance only the inbound watermark, so our first outbound
    // control frame numbers its own counter from 1.
    expect(pongParams.progress).toBe(1);

    deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
    await expect(responsePromise).resolves.toMatchObject({ id: 32, result: { ok: true } });
  });

  it('catches a pong publication failure and fails the stream without an unhandled rejection', async () => {
    const serverSk = generateSecretKey();
    const inner = createServerPool(serverSk, () => null);
    const { serverPubkey, publishedPlain, deliverEncrypted } = inner;
    // The relay accepts everything except pongs, which it rejects offline.
    const pool: CvmRelayPool = {
      subscribe: (relays, filter, params) => inner.pool.subscribe(relays, filter, params),
      publish(relays, event) {
        try {
          const ck = nip44.getConversationKey(serverSk, event.pubkey);
          const innerEvent = JSON.parse(nip44.decrypt(event.content, ck)) as NostrEvt;
          const mcp = JSON.parse(innerEvent.content) as McpMessage;
          const cvm = (mcp.params as { cvm?: { frameType?: string } } | undefined)?.cvm;
          if (cvm?.frameType === 'pong') return Promise.reject(new Error('relay offline'));
        } catch { /* not a frame we inspect */ }
        return inner.pool.publish(relays, event);
      },
    };
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const events: McpMessage[] = [];
    transport.onEvent((_server, message) => events.push(message));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);

    try {
      const responsePromise = transport.request(
        { pubkey: serverPubkey },
        { jsonrpc: '2.0', id: 33, method: 'tools/call', params: { name: 'chat.complete', arguments: {} } },
        { timeoutMs: 1_000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      const correlationId = publishedPlain[0].id;
      const token = injectedToken(publishedPlain);
      const frame = (progress: number, cvm: Record<string, unknown>): McpMessage => ({
        jsonrpc: '2.0', method: 'notifications/progress',
        params: { progressToken: token, progress, cvm },
      });

      deliverEncrypted(frame(1, { type: 'open-stream', frameType: 'start' }));
      deliverEncrypted(frame(2, { type: 'open-stream', frameType: 'ping', nonce: 'n-1' }));
      await new Promise((resolve) => setTimeout(resolve, 40));

      // The rejection was caught and the stream failed with a best-effort abort.
      expect(unhandled).toEqual([]);
      const abort = publishedPlain.find((message) => {
        const params = message.params as { cvm?: { frameType?: string; reason?: string } } | undefined;
        return params?.cvm?.frameType === 'abort';
      });
      expect(abort).toBeDefined();
      expect((abort!.params as { cvm: { reason: string } }).cvm.reason).toBe('pong publication failed');

      // Later stream frames are ignored; the request still settles normally.
      deliverEncrypted(frame(3, { type: 'open-stream', frameType: 'chunk', chunkIndex: 0, data: 'late' }));
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(events).toHaveLength(1); // start only
      deliverEncrypted({ jsonrpc: '2.0', id: correlationId, result: { ok: true } });
      await expect(responsePromise).resolves.toMatchObject({ id: 33, result: { ok: true } });
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('rejects a duplicate explicit progress token to the same server while in flight', async () => {
    const serverSk = generateSecretKey();
    const { pool, serverPubkey } = createServerPool(serverSk, () => null);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, clientSecretKey: generateSecretKey() });
    const server = { pubkey: serverPubkey };

    const first = transport.request(
      server,
      { jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'a', arguments: {}, _meta: { progressToken: 'shared' } } },
      { timeoutMs: 80 },
    );
    await expect(transport.request(
      server,
      { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'b', arguments: {}, _meta: { progressToken: 'shared' } } },
      { timeoutMs: 80 },
    )).rejects.toThrow('duplicate progress token');

    await expect(first).rejects.toThrow('relay timeout');
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
