/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f, Message
 * handling): the shell "MAY map IDs to unique transport IDs if it restores the
 * caller's ID in the returned MCP response and consistently maps request
 * references such as cancellation". `createNostrCvmTransport` sends requests
 * under correlation ids, so `cancel()` rewrites `params.requestId` to the id
 * it actually sent, and publishes nothing once that request has settled.
 */
import { describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import { createNostrCvmTransport, type CvmRelayPool } from './cvm-nostr-transport.js';
import type { McpMessage } from './cvm-types.js';

const RELAYS = ['wss://relay.test'];
const CANCEL: McpMessage = { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2, reason: 'user' } };

function setup() {
  const published: McpMessage[] = [];
  const pool: CvmRelayPool = {
    subscribe: () => ({ close() {} }),
    publish(_relays, event) { published.push(JSON.parse(event.content) as McpMessage); },
  };
  const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, encrypt: false });
  const server = { pubkey: getPublicKey(generateSecretKey()) };
  const controller = new AbortController();
  const handle = {};
  const pending = transport.request(server, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, undefined, { signal: controller.signal, handle });
  pending.catch(() => undefined);
  return { transport, server, published, handle, controller, pending };
}

describe('createNostrCvmTransport cancel (NAP-CVM #31 @ 28cf1bdb)', () => {
  it('maps requestId to the correlation id the request was sent under, keeping the rest', async () => {
    const h = setup();
    await vi.waitFor(() => expect(h.published).toHaveLength(1));
    const sentId = h.published[0]!.id;
    expect(sentId).not.toBe(2);
    await expect(h.transport.cancel!(h.server, h.handle, CANCEL)).resolves.toBe(true);
    expect(h.published[1]).toEqual({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: sentId, reason: 'user' } });
    h.transport.dispose();
  });

  it('publishes nothing once the request has settled', async () => {
    const h = setup();
    await vi.waitFor(() => expect(h.published).toHaveLength(1));
    h.controller.abort();
    await expect(h.pending).rejects.toThrow('policy denied');
    await expect(h.transport.cancel!(h.server, h.handle, CANCEL)).resolves.toBe(false);
    expect(h.published).toHaveLength(1);
    h.transport.dispose();
  });

  it('publishes nothing for an unknown handle or another server', async () => {
    const h = setup();
    await vi.waitFor(() => expect(h.published).toHaveLength(1));
    await expect(h.transport.cancel!(h.server, {}, CANCEL)).resolves.toBe(false);
    await expect(h.transport.cancel!({ pubkey: getPublicKey(generateSecretKey()) }, h.handle, CANCEL)).resolves.toBe(false);
    expect(h.published).toHaveLength(1);
    h.transport.dispose();
  });
});
