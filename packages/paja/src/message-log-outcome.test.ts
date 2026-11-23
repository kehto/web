import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createCatalogIntentResolver, createIntentService } from '@kehto/services';
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

  // NAP-INTENT napplet/naps master 377bf939: `invoke rejected` covers a policy
  // denial and other rejections, so it is neither `denied` nor `failed` (kehto/web#523).
  describe('NAP-INTENT invoke results', () => {
    const request = { archetype: 'note', action: 'open', convention: 'napplet:note/open' };
    const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
    const catalog = [{ id: 'nip5d:35129:pk:reader', title: 'Reader', archetypes: { note: { contracts: [{ convention: 'napplet:note/open', params: [] }] } } }];

    async function invokeWire(
      message: Record<string, unknown>,
      options: { authorize?: 'denied' | 'executed'; accept?: () => never } = {},
    ): Promise<NappletMessage> {
      const resolver = createCatalogIntentResolver({
        loadCatalog: () => catalog,
        targets: { accept: options.accept ?? (() => ({ completion: Promise.resolve() })) },
      });
      const service = createIntentService({ resolveSender: () => 'nip5d:35129:pk:feed', resolver });
      if (options.authorize) {
        const status = options.authorize;
        service.onRegistered?.({
          listWindowIds: () => [],
          authorizeOperation: async (_w: string, _o: string, _r: unknown, run: (signal: AbortSignal) => Promise<unknown>) =>
            status === 'executed' ? { status, value: await run(new AbortController().signal) } : { status },
        } as unknown as ServiceRuntimeContext);
      }
      const sent: NappletMessage[] = [];
      service.handleMessage('w', { type: 'intent.invoke', id: 'i', ...message } as NappletMessage, (reply) => sent.push(reply));
      await flush();
      expect(sent).toHaveLength(1);
      return sent[0];
    }

    it('badges a firewall-denied invoke as rejected, not as a plain failure', async () => {
      const reply = await invokeWire({ request }, { authorize: 'denied' });
      expect(reply).toEqual({ type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invoke rejected' } });
      expect(classifyPajaMessageOutcome(out, reply)).toBe('rejected');
    });

    it('badges an unauthorized explicit handler as rejected, not as a firewall denial', async () => {
      const reply = await invokeWire({ request: { ...request, handler: 'nip5d:35129:pk:reader' } }, { authorize: 'executed' });
      expect(reply).toEqual({ type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invoke rejected' } });
      expect(classifyPajaMessageOutcome(out, reply)).toBe('rejected');
    });

    it('badges a target that refuses delivery as rejected', async () => {
      const reply = await invokeWire({ request }, { accept: () => { throw new Error('target gone'); } });
      expect(reply).toEqual({ type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invoke rejected' } });
      expect(classifyPajaMessageOutcome(out, reply)).toBe('rejected');
    });

    it('keeps no handler and invalid conventions as failures', async () => {
      const none = await invokeWire({ request: { archetype: 'profile', action: 'open', convention: 'napplet:profile/open' } });
      expect(none).toEqual({ type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'no handler' } });
      expect(classifyPajaMessageOutcome(out, none)).toBe('failed');
      const invalid = await invokeWire({ request: { ...request, convention: 'napplet:profile/open' } });
      expect(invalid).toEqual({ type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invalid convention' } });
      expect(classifyPajaMessageOutcome(out, invalid)).toBe('failed');
    });

    it('leaves an accepted invoke unhighlighted', async () => {
      const reply = await invokeWire({ request });
      expect(reply).toMatchObject({ type: 'intent.invoke.result', id: 'i', result: { ok: true, handler: 'nip5d:35129:pk:reader' } });
      expect(classifyPajaMessageOutcome(out, reply)).toBeUndefined();
    });

    it('applies the rejected outcome only to intent.invoke.result', () => {
      expect(classifyPajaMessageOutcome(out, { type: 'cvm.request.result', id: 'c', ok: false, error: 'invoke rejected' })).toBe('failed');
      expect(classifyPajaMessageOutcome('napplet->shell', { type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invoke rejected' } })).toBeUndefined();
    });

    it('labels the rejected badge as policy or handler', () => {
      vi.stubGlobal('document', { getElementById: () => null });
      try {
        const state = { messageLog: [], messageFilter: '' } as unknown as PajaDevtoolsState;
        appendPajaMessageLog(state, out, { type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'invoke rejected' } }, 'w');
        expect(state.messageLog[0]?.outcome).toBe('rejected');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
