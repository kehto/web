/**
 * NAP-CVM (napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f, Message
 * handling): a notification or response completes "After transport
 * publication", with "No MCP response ... awaited", and the shell "MUST NOT add
 * an ID to a notification or rewrite the ID of a napplet's response to a
 * server request". `createNostrCvmTransport().publish` carries that contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import { createNostrCvmTransport, type CvmRelayPool } from './cvm-nostr-transport.js';
import type { McpMessage } from './cvm-types.js';

const RELAYS = ['wss://relay.test'];

function plainPool(hold = false) {
  const published: McpMessage[] = [];
  let release: () => void = () => {};
  const pool: CvmRelayPool = {
    subscribe: () => ({ close() {} }),
    publish(_relays, event) {
      published.push(JSON.parse(event.content) as McpMessage);
      return hold ? new Promise<void>((resolve) => { release = resolve; }) : undefined;
    },
  };
  return { pool, published, release: () => release() };
}

describe('createNostrCvmTransport publish (NAP-CVM #31 @ 28cf1bdb)', () => {
  const server = { pubkey: getPublicKey(generateSecretKey()) };

  it.each([
    ['a notification, without adding an id', { jsonrpc: '2.0', method: 'notifications/initialized' }],
    ['a result response, keeping the napplet id', { jsonrpc: '2.0', id: 'srv-1', result: { roots: [] } }],
    ['an error response, keeping a numeric id', { jsonrpc: '2.0', id: 5, error: { code: -32601, message: 'no' } }],
  ])('publishes %s exactly as given', async (_label, message) => {
    const { pool, published } = plainPool();
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, encrypt: false });
    await expect(transport.publish!(server, message as McpMessage)).resolves.toBeUndefined();
    expect(published).toEqual([message]);
    transport.dispose();
  });

  it('resolves on publication, not on any reply', async () => {
    const { pool, published, release } = plainPool(true);
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, encrypt: false });
    let settled = false;
    const done = transport.publish!(server, { jsonrpc: '2.0', method: 'notifications/initialized' }).then(() => { settled = true; });
    await vi.waitFor(() => expect(published).toHaveLength(1));
    expect(settled).toBe(false);
    release();
    await done;
    expect(settled).toBe(true);
    transport.dispose();
  });

  it('keeps the accepted deadline through publication', async () => {
    vi.useFakeTimers();
    try {
      const { pool } = plainPool(true);
      const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, encrypt: false });
      const done = transport.publish!(server, { jsonrpc: '2.0', method: 'notifications/initialized' }, { timeoutMs: 50 });
      const rejection = expect(done).rejects.toThrow('relay timeout');
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      transport.dispose();
    } finally { vi.useRealTimers(); }
  });

  it('rejects an invalid timeout before publishing', async () => {
    const { pool, published } = plainPool();
    const transport = createNostrCvmTransport({ pool, defaultRelays: RELAYS, encrypt: false });
    await expect(transport.publish!(server, { jsonrpc: '2.0', method: 'n' }, { timeoutMs: 0 })).rejects.toThrow('invalid timeout');
    expect(published).toEqual([]);
    transport.dispose();
  });
});
