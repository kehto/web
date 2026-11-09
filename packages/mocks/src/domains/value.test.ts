import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MOCK_ACCOUNTS } from '../fixtures/nostr.js';
import { VALUE_MOCK_ENTRY, VALUE_SPEC_REF, createMockValueService } from './value.js';

const ROUTES = ['value.quote', 'value.send', 'value.status'];
const CLOCK = { now: () => 1_700_000_000_000 };
const ALICE = MOCK_ACCOUNTS[0]!.pubkey;
const BOB = MOCK_ACCOUNTS[1]!.pubkey;
const EVENT_ID = 'ab'.repeat(32);
const ZAP = { rail: 'zap', amountMsat: 21_000, comment: 'great note', target: { type: 'zap', pubkey: BOB, eventId: EVENT_ID, relays: ['wss://relay-a.example.org'] } };

function run(service: ReturnType<typeof createMockValueService>, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

describe('NAP-VALUE mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockValueService();
    expect(service.descriptor).toEqual({ name: 'value', version: '0.1.0', description: 'Mock NAP-VALUE shell-mediated value transfer' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(VALUE_SPEC_REF).toEqual({ nap: 'NAP-VALUE', status: 'draft', source: 'pr', pr: 30, sha: 'e468764d9f8a', path: 'naps/NAP-VALUE.md' });
    expect(VALUE_MOCK_ENTRY).toMatchObject({ domain: 'value', kind: 'extension' });
    expect(VALUE_MOCK_ENTRY.create?.({}).descriptor.name).toBe('value');
    expect(service.mock.state().balanceMsat).toBe(100_000_000);
  });

  it('quotes a zap with fees and expiry, or a policy error', () => {
    const service = createMockValueService({ clock: CLOCK });
    expect(run(service, 'w1', { type: 'value.quote', id: 'q1', request: ZAP })).toEqual({
      type: 'value.quote.result', id: 'q1', quote: { ok: true, rail: 'zap', amountMsat: 21_000, feesMsat: 21, expiresAt: 1_700_000_600 },
    });
    expect(run(service, 'w1', { type: 'value.quote', id: 'q2', request: { ...ZAP, rail: 'cashu' } })).toEqual({
      type: 'value.quote.result', id: 'q2', quote: { ok: false, rail: 'cashu', amountMsat: 21_000, error: 'unsupported rail' }, error: 'unsupported rail',
    });
    expect(run(service, 'w1', { type: 'value.quote', id: 'q3', request: { rail: 'lnurl', amountMsat: 1000, target: { type: 'lnurl' } } })).toMatchObject({ error: 'invalid target' });
    expect(run(service, 'w1', { type: 'value.quote', id: 'q4', request: { rail: 'lnurl', amountMsat: 1000, target: { type: 'lnurl', lnurl: 'lnurl1dp68gurn8ghj7mock' } } })).toMatchObject({ quote: { ok: true, rail: 'lnurl' } });
    expect(run(service, 'w1', { type: 'value.quote', id: 'q5', request: null })).toEqual({ type: 'value.quote.result', id: 'q5', error: 'invalid target' });
  });

  it('sends a zap: pending result with the shell-built kind 9734 request', () => {
    const service = createMockValueService({ clock: CLOCK });
    expect(run(service, 'w1', { type: 'value.send', id: 's1', request: ZAP })).toEqual({
      type: 'value.send.result', id: 's1',
      result: {
        ok: true, transferId: 'value-1', status: 'pending', rail: 'zap', amountMsat: 21_000,
        event: {
          id: '9026f5013d806f3359c9e990b3712dc20ed997ee4f9ac95f47d58544b0b7c181', pubkey: ALICE, created_at: 1_700_000_000, kind: 9734,
          tags: [['p', BOB], ['e', EVENT_ID], ['amount', '21000'], ['relays', 'wss://relay-a.example.org']],
          content: 'great note',
          sig: 'b019f7304716e1fd87ac7caa2c6ff53183c13eb226a2a5adb3285752a6d6c3b689ae81ac52e4f5e832d48879b628ad0494d8a0759729b7cad56f622851b9a592',
        },
      },
    });
    expect(run(service, 'w1', { type: 'value.status', id: 'st', transferId: 'value-1' })).toMatchObject({
      type: 'value.status.result', id: 'st', status: { ok: true, transferId: 'value-1', status: 'pending', rail: 'zap', amountMsat: 21_000, updatedAt: 1_700_000_000 },
    });
    expect(run(service, 'w2', { type: 'value.status', id: 'st2', transferId: 'value-1' })).toEqual({ type: 'value.status.result', id: 'st2', error: 'transfer not found' });
  });

  it('settles pending transfers, discloses the preimage, debits the wallet, and pushes value.status.changed', () => {
    const service = createMockValueService({ clock: CLOCK });
    run(service, 'w1', { type: 'value.send', id: 's1', request: ZAP });
    expect(service.settle()).toEqual(['value-1']);
    const changed = service.mock.sent.at(-1)!;
    expect(changed.windowId).toBe('w1');
    expect(changed.message).toMatchObject({
      type: 'value.status.changed',
      status: { ok: true, transferId: 'value-1', status: 'settled', rail: 'zap', amountMsat: 21_000, updatedAt: 1_700_000_000, preimage: 'ea4ed7b3179b6cdd19c3c8b11fcd09f5be5afd739e2c34d334988297de854cd2', event: { kind: 9735 } },
    });
    expect((changed.message as unknown as { status: { event: { tags: string[][] } } }).status.event.tags.slice(0, 4)).toEqual([
      ['p', BOB], ['e', EVENT_ID], ['bolt11', 'lnbc21n1mock556bfbb09dd5d195'], ['preimage', 'ea4ed7b3179b6cdd19c3c8b11fcd09f5be5afd739e2c34d334988297de854cd2'],
    ]);
    expect((changed.message as unknown as { id?: string }).id).toBeUndefined();
    expect(service.mock.state().balanceMsat).toBe(99_978_979);
    expect(service.settle()).toEqual([]);
    expect(run(service, 'w1', { type: 'value.status', id: 'st', transferId: 'value-1' })).toMatchObject({ status: { status: 'settled' } });
  });

  it('models consent, policy, and funds failures per the NAP', () => {
    const service = createMockValueService({ clock: CLOCK, balanceSats: 10 });
    service.approveNext(false);
    expect(run(service, 'w1', { type: 'value.send', id: 's1', request: ZAP })).toEqual({
      type: 'value.send.result', id: 's1', result: { ok: false, transferId: 'value-1', status: 'cancelled', rail: 'zap', amountMsat: 21_000, error: 'user cancelled' },
    });
    expect(run(service, 'w1', { type: 'value.send', id: 's2', request: ZAP })).toEqual({
      type: 'value.send.result', id: 's2', result: { ok: false, transferId: 'value-2', status: 'failed', rail: 'zap', amountMsat: 21_000, error: 'insufficient funds' },
    });
    expect(run(service, 'w1', { type: 'value.send', id: 's3', request: { ...ZAP, amountMsat: 200_000_000 } })).toEqual({ type: 'value.send.result', id: 's3', error: 'amount out of policy' });
    expect(run(service, 'w1', { type: 'value.send', id: 's4', request: { ...ZAP, target: { type: 'zap' } } })).toEqual({ type: 'value.send.result', id: 's4', error: 'invalid target' });
    expect(run(service, 'w1', { type: 'value.send', id: 's5', request: { ...ZAP, rail: 'cashu' } })).toEqual({ type: 'value.send.result', id: 's5', error: 'unsupported rail' });
    expect(service.mock.state().transfers.size).toBe(2);
    expect(service.mock.state().balanceMsat).toBe(10_000);

    const flaky = createMockValueService({ clock: CLOCK });
    run(flaky, 'w1', { type: 'value.send', id: 's1', request: { rail: 'lnurl', amountMsat: 5_000, target: { type: 'lnurl', lnurl: 'lnurl1mock' } } });
    expect(flaky.failTransfer('value-1')).toBe(true);
    expect(flaky.failTransfer('value-1')).toBe(false);
    expect(flaky.mock.sent.at(-1)!.message).toEqual({
      type: 'value.status.changed', status: { ok: false, transferId: 'value-1', status: 'failed', rail: 'lnurl', amountMsat: 5_000, updatedAt: 1_700_000_000, error: 'payment failed' },
    });
    expect(flaky.mock.state().balanceMsat).toBe(100_000_000);
  });

  it('auto-settles through the scheduler and cancels timers on reset and window destroy', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } };
    const service = createMockValueService({ clock: CLOCK, scheduler, settleMs: 50 });
    run(service, 'w1', { type: 'value.send', id: 's1', request: ZAP });
    expect(queued).toHaveLength(1);
    queued[0]!();
    expect(service.mock.sent.at(-1)!.message).toMatchObject({ type: 'value.status.changed', status: { transferId: 'value-1', status: 'settled' } });

    run(service, 'w1', { type: 'value.send', id: 's2', request: ZAP });
    run(service, 'w2', { type: 'value.send', id: 's3', request: ZAP });
    service.onWindowDestroyed?.('w2');
    expect(cancelled).toBe(1);
    expect(service.mock.state().transfers.has('value-3')).toBe(false);
    service.mock.reset();
    expect(cancelled).toBe(2);
    expect(service.mock.state()).toMatchObject({ balanceMsat: 100_000_000, nextSeq: 1, consentQueue: [] });
    expect(service.mock.state().transfers.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
