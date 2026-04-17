/**
 * runtime.test.ts — Integration tests for the ifc channel sub-protocol (NUB-04 / DRIFT-RT-09).
 *
 * Exercises the full 14-type @napplet/nub-ifc surface via createRuntime → handleMessage
 * round-trips between three mock napplet windows (A, B, C). The channel sub-protocol
 * tests (open / emit / event fanout / list / close / broadcast) are the RED baseline for
 * Plan 12-04 Task 2's handleIfcMessage extension.
 *
 * Test 6 additionally asserts that `ifc.subscribe` emits an `ifc.subscribe.result`
 * envelope — the canonical nub-ifc contract that the pre-12-04 handler silently dropped.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { MockRuntimeContext, SentMessage } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_A = 'win-A';
const WINDOW_B = 'win-B';
const WINDOW_C = 'win-C';
const DTAG_A = 'napp-A';
const DTAG_B = 'napp-B';
const DTAG_C = 'napp-C';
const HASH = 'a'.repeat(64);

/** Collect all NappletMessage envelopes sent to a given window, filtered by type prefix. */
function envelopesFor(sent: SentMessage[], windowId: string, typePrefix?: string): NappletMessage[] {
  return sent
    .filter((s) => s.windowId === windowId && typeof s.message === 'object' && !Array.isArray(s.message))
    .map((s) => s.message as NappletMessage)
    .filter((m) => typePrefix === undefined || m.type === typePrefix || m.type.startsWith(`${typePrefix}.`) || m.type.startsWith(typePrefix));
}

/** Find all envelopes with an exact type match for a given window. */
function envelopesOfType(sent: SentMessage[], windowId: string, type: string): NappletMessage[] {
  return sent
    .filter((s) => s.windowId === windowId && typeof s.message === 'object' && !Array.isArray(s.message))
    .map((s) => s.message as NappletMessage)
    .filter((m) => m.type === type);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('ifc channel sub-protocol (NUB-04 / DRIFT-RT-09)', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    // Register three NIP-5D sessions — A, B, C — so resolveWindowForTarget
    // can find B and C by windowId. Pubkey is empty string per NIP-5D convention.
    runtime.sessionRegistry.register(WINDOW_A, createNip5dSessionEntry(WINDOW_A, DTAG_A, HASH));
    runtime.sessionRegistry.register(WINDOW_B, createNip5dSessionEntry(WINDOW_B, DTAG_B, HASH));
    runtime.sessionRegistry.register(WINDOW_C, createNip5dSessionEntry(WINDOW_C, DTAG_C, HASH));
  });

  // ─── Test 1: channel.open ───────────────────────────────────────────────────

  it('channel.open resolves with channelId + peer', () => {
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open',
      id: 'q1',
      target: WINDOW_B,
    } as NappletMessage);

    const results = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result');
    expect(results).toHaveLength(1);
    const r = results[0] as NappletMessage & { id: string; channelId?: string; peer?: string; error?: string };
    expect(r.id).toBe('q1');
    expect(r.error).toBeUndefined();
    expect(typeof r.channelId).toBe('string');
    // Opaque 32-char id derived from hooks.crypto.randomUUID() with hyphens stripped.
    // Tolerates mock UUID shapes (alnum) as well as real UUIDv4 (lowercase hex).
    expect(r.channelId).toMatch(/^[a-z0-9]{32}$/);
    expect(r.peer).toBe(WINDOW_B);
    // Peer (B) is NOT notified at open time — only the opener (A) gets a result.
    expect(envelopesFor(ctx.sent, WINDOW_B)).toHaveLength(0);
  });

  // ─── Test 2: channel.emit (sender exclusion) ───────────────────────────────

  it('channel.emit delivers to peer, excludes sender', () => {
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open',
      id: 'q1',
      target: WINDOW_B,
    } as NappletMessage);
    const openResult = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result')[0] as
      NappletMessage & { channelId: string };
    const channelId = openResult.channelId;
    expect(channelId).toBeDefined();

    ctx.sent.length = 0; // drain
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.emit',
      channelId,
      payload: { msg: 'hi' },
    } as NappletMessage);

    // B receives exactly one channel.event with sender=A
    const bEvents = envelopesOfType(ctx.sent, WINDOW_B, 'ifc.channel.event');
    expect(bEvents).toHaveLength(1);
    const ev = bEvents[0] as NappletMessage & { channelId: string; sender: string; payload?: unknown };
    expect(ev.channelId).toBe(channelId);
    expect(ev.sender).toBe(WINDOW_A);
    expect(ev.payload).toEqual({ msg: 'hi' });

    // A receives nothing for its own emit (sender exclusion)
    const aEvents = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.event');
    expect(aEvents).toHaveLength(0);
  });

  // ─── Test 3: channel.list ──────────────────────────────────────────────────

  it('channel.list returns open channels', () => {
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open',
      id: 'open-1',
      target: WINDOW_B,
    } as NappletMessage);
    const openResult = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result')[0] as
      NappletMessage & { channelId: string };
    const channelId = openResult.channelId;

    ctx.sent.length = 0;
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.list',
      id: 'q2',
    } as NappletMessage);

    const listResults = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.list.result');
    expect(listResults).toHaveLength(1);
    const r = listResults[0] as NappletMessage & { id: string; channels: Array<{ id: string; peer: string }> };
    expect(r.id).toBe('q2');
    expect(r.channels).toEqual([{ id: channelId, peer: WINDOW_B }]);
  });

  // ─── Test 4: channel.close ─────────────────────────────────────────────────

  it('channel.close notifies both parties, removes entry', () => {
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open',
      id: 'open-1',
      target: WINDOW_B,
    } as NappletMessage);
    const openResult = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result')[0] as
      NappletMessage & { channelId: string };
    const channelId = openResult.channelId;

    ctx.sent.length = 0;
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.close',
      channelId,
    } as NappletMessage);

    // Both A and B receive ifc.channel.closed
    const aClosed = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.closed');
    const bClosed = envelopesOfType(ctx.sent, WINDOW_B, 'ifc.channel.closed');
    expect(aClosed).toHaveLength(1);
    expect(bClosed).toHaveLength(1);
    expect((aClosed[0] as NappletMessage & { channelId: string }).channelId).toBe(channelId);
    expect((bClosed[0] as NappletMessage & { channelId: string }).channelId).toBe(channelId);

    // Subsequent list from A returns empty
    ctx.sent.length = 0;
    runtime.handleMessage(WINDOW_A, { type: 'ifc.channel.list', id: 'q3' } as NappletMessage);
    const listResult = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.list.result')[0] as
      NappletMessage & { channels: Array<{ id: string; peer: string }> };
    expect(listResult.channels).toEqual([]);
  });

  // ─── Test 5: channel.broadcast ─────────────────────────────────────────────

  it('channel.broadcast emits to all peers across open channels', () => {
    // Open A↔B
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open', id: 'open-ab', target: WINDOW_B,
    } as NappletMessage);
    const rAB = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result')[0] as
      NappletMessage & { channelId: string };
    const channelAB = rAB.channelId;
    // Open A↔C
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.open', id: 'open-ac', target: WINDOW_C,
    } as NappletMessage);
    const rAC = (envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.open.result'))[1] as
      NappletMessage & { channelId: string };
    const channelAC = rAC.channelId;
    expect(channelAB).not.toBe(channelAC);

    ctx.sent.length = 0;
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.channel.broadcast',
      payload: { x: 1 },
    } as NappletMessage);

    // B and C each receive exactly one ifc.channel.event for their respective channelId
    const bEvents = envelopesOfType(ctx.sent, WINDOW_B, 'ifc.channel.event');
    const cEvents = envelopesOfType(ctx.sent, WINDOW_C, 'ifc.channel.event');
    expect(bEvents).toHaveLength(1);
    expect(cEvents).toHaveLength(1);
    expect((bEvents[0] as NappletMessage & { channelId: string; sender: string; payload?: unknown })).toMatchObject({
      channelId: channelAB, sender: WINDOW_A, payload: { x: 1 },
    });
    expect((cEvents[0] as NappletMessage & { channelId: string; sender: string; payload?: unknown })).toMatchObject({
      channelId: channelAC, sender: WINDOW_A, payload: { x: 1 },
    });
    // A receives nothing
    const aEvents = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.channel.event');
    expect(aEvents).toHaveLength(0);
  });

  // ─── Test 6: subscribe.result ──────────────────────────────────────────────

  it('ifc.subscribe emits ifc.subscribe.result', () => {
    runtime.handleMessage(WINDOW_A, {
      type: 'ifc.subscribe',
      id: 'q3',
      topic: 'foo',
    } as NappletMessage);

    const results = envelopesOfType(ctx.sent, WINDOW_A, 'ifc.subscribe.result');
    expect(results).toHaveLength(1);
    const r = results[0] as NappletMessage & { id: string; error?: string };
    expect(r.id).toBe('q3');
    expect(r.error).toBeUndefined();
  });
});

// ─── relay.publishEncrypted (NUB-08 / DRIFT-RT-08 / SH-C03) ──────────────────

/**
 * Exercises the shell-mediated encryption path: napplet sends a
 * `relay.publishEncrypted` envelope with plaintext content; the shell runtime
 * encrypts via the configured signer (NIP-44 / NIP-04, shell-internal), signs,
 * publishes, and returns `relay.publishEncrypted.result`. These tests are the
 * RED baseline for Plan 12-08 Task 2's `case 'publishEncrypted':` branch in
 * handleRelayMessage.
 */

describe('relay.publishEncrypted (NUB-08 / DRIFT-RT-08 / SH-C03)', () => {
  const PE_WINDOW = 'win-test-pe';
  const PE_DTAG = 'napp-pe';
  const PE_HASH = 'b'.repeat(64);
  const PE_RECIPIENT = 'a'.repeat(64);

  /** Collect all envelopes (any window) with an exact type match. */
  function allEnvelopesOfType(sent: SentMessage[], type: string): NappletMessage[] {
    return sent
      .filter((s) => typeof s.message === 'object' && !Array.isArray(s.message))
      .map((s) => s.message as NappletMessage)
      .filter((m) => m.type === type);
  }

  /**
   * Build a Signer stub with default nip44/nip04/signEvent that prefix
   * plaintext so tests can assert the encrypted payload shape. Pass overrides
   * to swap specific methods.
   */
  function createStubSigner(
    overrides: Partial<import('./types.js').Signer> = {},
  ): import('./types.js').Signer {
    return {
      getPublicKey: () => 'self-pubkey-hex',
      signEvent: async (ev: import('@napplet/core').NostrEvent) => ({
        ...ev, id: 'evt-id', sig: 'c'.repeat(128),
      }),
      nip44: {
        encrypt: async (_pk: string, plain: string) => `NIP44:${plain}`,
        decrypt: async (_pk: string, cipher: string) => cipher.replace(/^NIP44:/, ''),
      },
      nip04: {
        encrypt: async (_pk: string, plain: string) => `NIP04:${plain}`,
        decrypt: async (_pk: string, cipher: string) => cipher.replace(/^NIP04:/, ''),
      },
      ...overrides,
    };
  }

  let ctx: MockRuntimeContext;
  let runtime: Runtime;
  let signer: import('./types.js').Signer;

  beforeEach(() => {
    signer = createStubSigner();
    ctx = createMockRuntimeAdapter({
      auth: {
        getUserPubkey: () => 'user-pubkey',
        getSigner: () => signer,
      },
    });
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(
      PE_WINDOW,
      createNip5dSessionEntry(PE_WINDOW, PE_DTAG, PE_HASH),
    );
  });

  it('succeeds with nip44 — result has ok:true and signed event with encrypted content', async () => {
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe1',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
      encryption: 'nip44',
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & {
      id: string; ok: boolean;
      event?: import('@napplet/core').NostrEvent;
      eventId?: string; error?: string;
    };
    expect(result.id).toBe('pe1');
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe('evt-id');
    expect(result.event).toBeDefined();
    expect(result.event?.content).toBe('NIP44:hello');
    expect(result.event?.sig).toBeDefined();
  });

  it('defaults to nip44 when encryption field is omitted', async () => {
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe2',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & {
      ok: boolean; event?: import('@napplet/core').NostrEvent;
    };
    expect(result.ok).toBe(true);
    expect(result.event?.content).toBe('NIP44:hello');
  });

  it('uses nip04.encrypt when encryption: "nip04"', async () => {
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe3',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
      encryption: 'nip04',
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & {
      ok: boolean; event?: import('@napplet/core').NostrEvent;
    };
    expect(result.ok).toBe(true);
    expect(result.event?.content).toBe('NIP04:hello');
  });

  it('produces ok:false + "missing recipient" error when recipient is absent', async () => {
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe-no-recipient',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/missing recipient/);
  });

  it('produces ok:false + "no signer" error when signer is not configured', async () => {
    // Rebuild runtime with null signer.
    ctx = createMockRuntimeAdapter({
      auth: {
        getUserPubkey: () => 'user-pubkey',
        getSigner: () => null,
      },
    });
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(
      PE_WINDOW,
      createNip5dSessionEntry(PE_WINDOW, PE_DTAG, PE_HASH),
    );

    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe-no-signer',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/no signer/);
  });

  it('produces ok:false + "unsupported encryption" error for unknown scheme', async () => {
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe-bad-scheme',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
      encryption: 'pgp',
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const results = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const result = results[0] as NappletMessage & { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/unsupported encryption/);
  });

  it('never exposes plaintext to local subscribers — delivered event carries ciphertext only', async () => {
    // Subscribe so the published (encrypted) event is also delivered back via
    // eventBuffer.bufferAndDeliver. Assert no subscriber envelope carries plaintext.
    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.subscribe',
      id: 'sub-req-1',
      subId: 'sub-pe',
      filters: [{ kinds: [4] }],
    } as NappletMessage);
    ctx.sent.length = 0;

    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe7',
      event: { kind: 4, content: 'hello', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
      encryption: 'nip44',
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    const events = allEnvelopesOfType(ctx.sent, 'relay.event');
    for (const env of events) {
      const ev = (env as NappletMessage & {
        event?: import('@napplet/core').NostrEvent;
      }).event;
      if (ev && typeof ev.content === 'string') {
        expect(ev.content).not.toBe('hello');
        expect(ev.content.startsWith('NIP44:') || ev.content.startsWith('NIP04:')).toBe(true);
      }
    }
  });

  it('ACL denial produces envelope with ok:false (.result) or matching .error — never leaks plaintext', async () => {
    // Block the napplet — every capability check for this identity will deny.
    runtime.aclState.block('', PE_DTAG, PE_HASH);

    runtime.handleMessage(PE_WINDOW, {
      type: 'relay.publishEncrypted',
      id: 'pe-deny',
      event: { kind: 4, content: 'plaintext-do-not-leak', tags: [], created_at: 123 },
      recipient: PE_RECIPIENT,
      encryption: 'nip44',
    } as NappletMessage);
    await new Promise((r) => setTimeout(r, 0));

    // The runtime emits EITHER:
    //   { type: 'relay.publishEncrypted.error', id, error: /denied|capability_missing|relay:/ }
    //     (outer handleMessage short-circuits on ACL denial before reaching the handler), OR
    //   { type: 'relay.publishEncrypted.result', id: 'pe-deny', ok: false, error: /.../ }
    //     (handler runs but emits a failure result).
    const errEnv = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.error')[0] as
      (NappletMessage & { id?: string; error?: string }) | undefined;
    const resEnv = allEnvelopesOfType(ctx.sent, 'relay.publishEncrypted.result')[0] as
      (NappletMessage & { id?: string; ok?: boolean; error?: string }) | undefined;
    const denialSeen = !!errEnv || !!(resEnv && resEnv.ok === false);
    expect(denialSeen).toBe(true);

    if (errEnv) {
      expect(errEnv.id).toBe('pe-deny');
      expect(String(errEnv.error ?? '')).toMatch(/denied|capability_missing|relay:/);
    }
    if (resEnv && resEnv.ok === false) {
      expect(resEnv.id).toBe('pe-deny');
      expect(String(resEnv.error ?? '')).toMatch(
        /denied|capability_missing|relay:|missing|unsupported|no signer|failed/i,
      );
    }

    // Plaintext payload must not appear in any outgoing envelope — the shell must
    // deny BEFORE invoking the signer's encrypt primitive.
    for (const s of ctx.sent) {
      const json = JSON.stringify(s.message);
      expect(json.includes('plaintext-do-not-leak')).toBe(false);
    }
  });
});
