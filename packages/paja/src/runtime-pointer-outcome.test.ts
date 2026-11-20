import { describe, expect, it } from 'vitest';

import {
  PAJA_RELAY_EOSE_REASON as EOSE,
  classifyPointerMiss,
  describePointerNotFound,
  tallyPointerRelayReasons,
} from './runtime-pointer-outcome.js';

// Reason strings are the ones nostr-tools 2.23 `subscribeManyEose` reports per
// relay: EOSE closes with PAJA_RELAY_EOSE_REASON, a socket that never opened
// with the `ensureRelay` rejection text.
const RELAYS = ['wss://nos.example', 'wss://primal.example', 'wss://snort.example', 'wss://overpay.example', 'wss://damus.example'];

describe('classifyPointerMiss (#471)', () => {
  it('four EOSE plus one failed relay is a not-found with both counts', () => {
    const outcome = classifyPointerMiss({
      relays: RELAYS,
      reasons: [EOSE, EOSE, EOSE, EOSE, 'connection failed'],
      timedOut: false,
    });
    expect(outcome).toEqual({
      kind: 'not-found',
      tally: { answered: 4, failed: [{ url: 'wss://damus.example', reason: 'connection failed' }] },
    });
    if (outcome.kind !== 'not-found') throw new Error('unreachable');
    expect(describePointerNotFound('nevent', outcome.tally)).toBe(
      'Napplet manifest not found (4 answered, 1 failed): 4 relays reached EOSE without a matching nevent napplet manifest event.'
      + ' One relay could not be asked (wss://damus.example: connection failed).',
    );
  });

  it('every relay answering EOSE is a clean not-found', () => {
    const outcome = classifyPointerMiss({ relays: RELAYS.slice(0, 2), reasons: [EOSE, EOSE], timedOut: false });
    expect(outcome).toEqual({ kind: 'not-found', tally: { answered: 2, failed: [] } });
    if (outcome.kind !== 'not-found') throw new Error('unreachable');
    expect(describePointerNotFound('naddr', outcome.tally)).toBe(
      'Napplet manifest not found (2 answered, 0 failed): 2 relays reached EOSE without a matching naddr napplet manifest event.',
    );
  });

  it('zero opened sockets stays unreachable even when the deadline also expired', () => {
    const connections = { total: 2, connected: [], pending: [], failed: RELAYS.slice(0, 2).map((url) => ({ url, reason: 'connection failed' })) };
    expect(classifyPointerMiss({ relays: RELAYS.slice(0, 2), reasons: [], timedOut: true, connections }))
      .toEqual({ kind: 'unreachable', connections });
  });

  it('no relay answering while some connected stays a query failure, never a not-found', () => {
    const connections = { total: 2, connected: [RELAYS[0]!], pending: [], failed: [{ url: RELAYS[1]!, reason: 'connection failed' }] };
    expect(classifyPointerMiss({
      relays: RELAYS.slice(0, 2),
      reasons: ['blocked: not allowed', 'connection failed'],
      timedOut: false,
      connections,
    })).toEqual({ kind: 'query-failed', detail: 'blocked: not allowed; connection failed' });
  });

  it('keeps timeout and thrown-pool outcomes', () => {
    expect(classifyPointerMiss({ relays: RELAYS, reasons: [], timedOut: true })).toEqual({ kind: 'timed-out' });
    expect(classifyPointerMiss({ relays: RELAYS, reasons: [], timedOut: false, error: new Error('pool closed') }))
      .toEqual({ kind: 'query-failed', detail: 'pool closed' });
  });

  it('treats a pool without per-relay reasons as all relays reaching EOSE (legacy querySync)', () => {
    expect(classifyPointerMiss({ relays: RELAYS.slice(0, 3), reasons: [], timedOut: false }))
      .toEqual({ kind: 'not-found', tally: { answered: 3, failed: [] } });
  });
});

describe('tallyPointerRelayReasons', () => {
  it('pairs failures with URLs only when there is one reason per relay', () => {
    expect(tallyPointerRelayReasons(RELAYS.slice(0, 2), [EOSE, 'relay connection closed']).failed)
      .toEqual([{ url: RELAYS[1], reason: 'relay connection closed' }]);
    expect(tallyPointerRelayReasons(RELAYS.slice(0, 3), [EOSE, 'connection failed']).failed)
      .toEqual([{ reason: 'connection failed' }]);
  });

  it('caps listed failures in the message and counts the rest', () => {
    const failed = RELAYS.map((url) => ({ url, reason: 'connection failed' }));
    expect(describePointerNotFound('nevent', { answered: 1, failed })).toMatch(/5 relays could not be asked \(.*; \+2 more\)\.$/);
  });
});
