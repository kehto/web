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
