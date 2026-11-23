/**
 * outbox-relay-budget.test.ts — plans stay inside one Firewall approval (kehto/web#455).
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927` (Shell Behavior: relay
 * intelligence may choose among candidates; Security Considerations: shells
 * SHOULD enforce limits; Error Handling: partial results set `incomplete`).
 */

import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import { MAX_PERMISSION_REQUIREMENTS, type ApprovalSignal, type PermissionRequirement, type ServiceRuntimeContext } from '@kehto/runtime';
import { OUTBOX_RELAY_ORIGIN_BUDGET, boundPlanRelays, relayOrigins, selectReadRelays } from './outbox-relay-budget.js';
import { createOutboxService, type OutboxRelayPlan, type StreamingOutboxRouter } from './outbox-service.js';

const relay = (index: number): string => `wss://r${index}.example`;
const many = (count: number): string[] => Array.from({ length: count }, (_, index) => relay(index));
const PK = 'a'.repeat(64);
const event: NostrEvent = { id: 'e'.repeat(64), pubkey: PK, kind: 1, tags: [], content: 'hi', created_at: 1, sig: 'f'.repeat(128) };

describe('OUTBOX_RELAY_ORIGIN_BUDGET', () => {
  it('leaves room for the outbox interface requirement', () => {
    expect(OUTBOX_RELAY_ORIGIN_BUDGET).toBe(MAX_PERMISSION_REQUIREMENTS - 1);
  });
});

describe('selectReadRelays', () => {
  it('keeps a plan within budget unchanged, in planner order', () => {
    const candidates = new Map([[relay(2), new Set(['a'])], [relay(1), new Set(['b'])]]);
    expect(selectReadRelays(candidates)).toEqual({ relays: [relay(2), relay(1)], partial: false });
  });

  it('covers every author before adding redundancy, then hints', () => {
    const candidates = new Map<string, Set<string>>([
      ['wss://hint.example', new Set()],
      [relay(1), new Set(['a', 'b'])],
      [relay(2), new Set(['a', 'b', 'c'])],
      [relay(3), new Set(['d'])],
    ]);
    expect(selectReadRelays(candidates, 2)).toEqual({ relays: [relay(2), relay(3)], partial: false });
    expect(selectReadRelays(candidates, 3)).toEqual({ relays: [relay(2), relay(3), relay(1)], partial: false });
  });

  it('marks the plan partial when the budget leaves an author without relays', () => {
    const candidates = new Map(many(5).map((url, index) => [url, new Set([`author-${index}`])]));
    const selected = selectReadRelays(candidates, 3);
    expect(selected.partial).toBe(true);
    // Ties fall back to origin order, so the choice is stable across reloads.
    expect(selected.relays).toEqual([relay(0), relay(1), relay(2)]);
  });

  it('skips unusable URLs and reports only authors who lost every relay', () => {
    expect(selectReadRelays(new Map([['not a url', new Set(['a'])], [relay(1), new Set(['a'])]])))
      .toEqual({ relays: [relay(1)], partial: false });
    expect(selectReadRelays(new Map([['not a url', new Set(['a'])], [relay(1), new Set(['b'])]])))
      .toEqual({ relays: [relay(1)], partial: true });
  });

  it('spends one budget slot per origin and keeps every path on it', () => {
    const candidates = new Map([['wss://same.example/a', new Set(['a'])], ['wss://same.example/b', new Set(['b'])], [relay(1), new Set(['c'])]]);
    expect(selectReadRelays(candidates, 1)).toEqual({ relays: ['wss://same.example/a', 'wss://same.example/b'], partial: true });
  });
});

describe('boundPlanRelays', () => {
  it('cuts best-effort relays at the budget in router order', () => {
    expect(boundPlanRelays(many(5), [], 3)).toEqual({ relays: many(3), partial: true });
  });

  it('always keeps required relays, then fills with the rest', () => {
    expect(boundPlanRelays([relay(0), relay(1), relay(2)], [relay(2)], 2)).toEqual({ relays: [relay(0), relay(2)], partial: true });
  });

  it('refuses required relays that do not fit, or are unusable', () => {
    expect(() => boundPlanRelays(many(3), many(3), 2)).toThrow('too many relays');
    expect(() => boundPlanRelays(['not a url'], ['not a url'])).toThrow('invalid relay destination');
  });

  it('fails only when no relay is usable', () => {
    expect(boundPlanRelays(['not a url', relay(1)], [])).toEqual({ relays: [relay(1)], partial: true });
    expect(() => boundPlanRelays(['not a url'], [])).toThrow('invalid relay destination');
    expect(boundPlanRelays([], [])).toEqual({ relays: [], partial: false });
  });
});

describe('relayOrigins', () => {
  it('deduplicates by origin', () => {
    expect(relayOrigins(['wss://a.example/x', 'wss://a.example/y', 'wss://b.example'])).toEqual(['wss://a.example', 'wss://b.example']);
  });
});

describe('outbox service with a custom router plan', () => {
  type Authorize = NonNullable<ServiceRuntimeContext['authorizeOperation']>;
  function serve(plan: OutboxRelayPlan) {
    const seen: PermissionRequirement[][] = [];
    const authorize = (async (_w: string, _op: string, requirements: readonly PermissionRequirement[], execute: (signal: ApprovalSignal) => unknown) => {
      seen.push([...requirements]);
      return { status: 'executed', value: await execute(new AbortController().signal) };
    }) as unknown as Authorize;
    const queryWithPlan = vi.fn(async (_f: unknown, _o: unknown, _plan: OutboxRelayPlan) => ({ events: [{ event }] }));
    const subscribeWithPlan = vi.fn((_f: unknown, _plan: OutboxRelayPlan) => ({ close: vi.fn() }));
    const router: StreamingOutboxRouter = {
      query: vi.fn(async () => ({ events: [] })), subscribe: vi.fn(() => ({ close: vi.fn() })),
      publish: vi.fn(async () => ({ ok: true })), resolveRelays: vi.fn(async () => plan),
      queryStream: vi.fn(() => ({ result: Promise.resolve({ events: [] }), close: vi.fn() })),
      planRead: vi.fn(async () => plan), queryWithPlan, subscribeWithPlan,
    };
    const service = createOutboxService({ router });
    service.onRegistered?.({ authorizeOperation: authorize } as ServiceRuntimeContext);
    const sent: NappletMessage[] = [];
    return { service, sent, send: (message: NappletMessage) => { sent.push(message); }, seen, queryWithPlan, subscribeWithPlan };
  }
  const query = { type: 'outbox.query', id: 'q', filters: [{ authors: [PK] }] } as NappletMessage;
  const subscribe = { type: 'outbox.subscribe', id: 's', subId: 'feed', filters: [{ authors: [PK] }] } as NappletMessage;

  it('bounds an oversized plan to one approval and marks the query incomplete', async () => {
    const h = serve({ relays: many(300), source: 'nip65' });
    h.service.handleMessage('w', query, h.send);
    await vi.waitFor(() => expect(h.sent).toHaveLength(1));
    expect(h.sent[0]).toMatchObject({ type: 'outbox.query.result', incomplete: true, events: [{ event }] });
    expect(h.sent[0]).not.toHaveProperty('error');
    expect(h.seen[0]).toHaveLength(MAX_PERMISSION_REQUIREMENTS);
    expect(h.queryWithPlan.mock.calls[0]![2].relays).toEqual(many(OUTBOX_RELAY_ORIGIN_BUDGET));
  });

  it('opens a subscription on the usable relays of a plan with a malformed URL', async () => {
    const h = serve({ relays: [relay(1), 'wss://bad host', relay(2)], source: 'nip65' });
    h.service.handleMessage('w', subscribe, h.send);
    await vi.waitFor(() => expect(h.subscribeWithPlan).toHaveBeenCalledTimes(1));
    expect(h.subscribeWithPlan.mock.calls[0]![1].relays).toEqual([relay(1), relay(2)]);
    expect(h.sent).toEqual([]);
  });

  it('never sends the host-only partial marker in outbox.resolveRelays', async () => {
    const h = serve({ relays: [relay(1)], source: 'nip65', partial: true });
    h.service.handleMessage('w', { type: 'outbox.resolveRelays', id: 'r', target: { pubkey: PK } } as NappletMessage, h.send);
    await vi.waitFor(() => expect(h.sent).toHaveLength(1));
    expect(h.sent[0]).toEqual({ type: 'outbox.resolveRelays.result', id: 'r', plan: { relays: [relay(1)], source: 'nip65' } });
  });
});
