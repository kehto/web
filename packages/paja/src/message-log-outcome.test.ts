import { describe, expect, it, vi } from 'vitest';
import { classifyPajaMessageOutcome } from './message-log-outcome.js';
import { appendPajaMessageLog, type PajaDevtoolsState } from './browser-devtools.js';

const out = 'shell->napplet';

// Relay failures are not denials (kehto/web#460). Codes: NAP-OUTBOX #32
// `8865f73d`, NAP-COUNT #69 `9353a0c6`, Kehto runtime ACL `denied: <capability>`.
describe('classifyPajaMessageOutcome', () => {
  it.each([
    [{ type: 'outbox.closed', subId: 's', reason: 'policy denied' }],
    [{ type: 'outbox.query.result', id: 'q', events: [], error: 'denied: outbox:read' }],
    [{ type: 'relay.closed', subId: 's', reason: 'denied: relay:read' }],
    [{ type: 'count.query.result', id: 'c', ok: false, error: 'policy-denied' }],
    [{ type: 'outbox.publish.result', id: 'p', ok: false, error: 'publish denied' }],
    [{ type: 'relay.publish.result', id: 'p', ok: false, error: 'relay authorization unavailable or denied' }],
    [{ type: 'llm.generate.result', id: 'l', error: { code: 'policy-denied' } }],
    [{ type: 'pow.done', jobId: 'j', result: { ok: false, error: 'publish denied' } }],
  ])('marks a real refusal as denied: %j', (message) => {
    expect(classifyPajaMessageOutcome(out, message)).toBe('denied');
  });

  it.each([
    [{ type: 'outbox.closed', subId: 's', reason: 'relay list unavailable' }],
    [{ type: 'outbox.query.result', id: 'q', events: [], incomplete: true, error: 'relay timeout' }],
    [{ type: 'count.query.result', id: 'c', ok: false, error: 'count-unavailable', reason: 'socket closed' }],
    [{ type: 'relay.closed', subId: 's', reason: 'relay subscription failed' }],
    [{ type: 'relay.publish.result', id: 'p', ok: false }],
    [{ type: 'paja.target.error', error: 'fetch failed' }],
  ])('marks a network or transport failure as failed, not denied: %j', (message) => {
    expect(classifyPajaMessageOutcome(out, message)).toBe('failed');
  });

  it.each([
    [out, { type: 'outbox.closed', subId: 's' }],
    [out, { type: 'outbox.query.result', id: 'q', events: [] }],
    [out, { type: 'relay.publish.result', id: 'p', ok: true, eventId: 'e' }],
    ['napplet->shell', { type: 'outbox.query', id: 'q', error: 'policy denied' }],
    [out, ['EVENT', 'sub', {}]],
  ])('leaves ordinary rows alone: %s %j', (direction, message) => {
    expect(classifyPajaMessageOutcome(direction, message)).toBeUndefined();
  });

  it('records the outcome on appended log rows', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    try {
      const state = { messageLog: [], messageFilter: '' } as unknown as PajaDevtoolsState;
      appendPajaMessageLog(state, out, { type: 'outbox.closed', subId: 's', reason: 'relay timeout' }, 'w');
      appendPajaMessageLog(state, out, { type: 'outbox.closed', subId: 's', reason: 'denied: outbox:read' }, 'w');
      appendPajaMessageLog(state, out, { type: 'outbox.event', subId: 's', result: { event: {} } }, 'w');
      expect(state.messageLog.map((entry) => entry.outcome)).toEqual(['failed', 'denied', undefined]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
