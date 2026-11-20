/**
 * NAP-CVM operation deadlines through the real approval coordinator (kehto/web#457).
 *
 * Spec checked: NAP-CVM napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f,
 * Timeouts: "The shell MUST enforce the accepted duration from receipt through
 * queueing, initialization, consent, payment, and final response or publication."
 * and "Expiry returns `\"relay timeout\"`". Conformance cases: "A 120000 ms call
 * returns after 45000 ms. | It succeeds if permitted by policy; no fixed 30000 ms
 * binding timeout."
 *
 * The coordinator's own deadline bounds only the approval phase, so it can no
 * longer end an accepted request early with `policy denied`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime, type ApprovalAnswer } from '@kehto/runtime';
import { createCvmService, type CvmTransport } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const SERVER = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };
const allow: ApprovalAnswer = { effect: 'allow', lifetime: 'session' };

afterEach(() => vi.useRealTimers());

async function fixture(options: { respondAfterMs?: number; answer?: () => Promise<ApprovalAnswer> }) {
  vi.useFakeTimers();
  let admitted = false;
  const transport: CvmTransport = {
    discover: async () => [], close: async () => {}, onEvent: () => ({ close() {} }),
    request: (_server, message) => new Promise((resolve) => {
      if (options.respondAfterMs === undefined) return;
      setTimeout(() => resolve({ jsonrpc: '2.0', id: message.id, result: { ok: true } }), options.respondAfterMs);
    }),
  };
  const ctx = createMockRuntimeAdapter({
    services: { cvm: createCvmService({ transport }) },
    permissions: {
      now: () => Date.now(),
      // Admission is answered at once; the per-request prompt is the fixture's.
      prompt: () => (admitted && options.answer ? options.answer() : Promise.resolve(allow)),
      createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
    },
  });
  const runtime = createRuntime(ctx.hooks);
  runtime.sessionRegistry.register('w', { ...createNip5dSessionEntry('w', 'app', 'b'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost/app', artifactHash: 'b'.repeat(64) } });
  const admission = await runtime.permissions!.admit('w', { required: ['cvm'], optional: [], available: ['cvm'] });
  expect(admission.status).toBe('admitted');
  admitted = true;
  const request = (timeoutMs: number) => runtime.handleMessage('w', {
    type: 'cvm.request', id: 'long', server: SERVER,
    message: { jsonrpc: '2.0', id: 'long', method: 'tools/call' }, options: { timeoutMs },
  } as NappletMessage);
  const results = () => ctx.sent.map((sent) => sent.message as NappletMessage & { error?: string; message?: unknown });
  return { runtime, request, results };
}

describe('runtime CVM deadlines', () => {
  it('lets an accepted 120000 ms request finish at 90000 ms', async () => {
    const f = await fixture({ respondAfterMs: 90_000 });
    f.request(120_000);
    await vi.advanceTimersByTimeAsync(89_999);
    expect(f.results()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.results()).toEqual([{ type: 'cvm.request.result', id: 'long',
      message: { jsonrpc: '2.0', id: 'long', result: { ok: true } } }]);
    f.runtime.destroy();
  });

  it('reports relay timeout when the accepted duration expires, not policy denied', async () => {
    const f = await fixture({});
    f.request(120_000);
    await vi.advanceTimersByTimeAsync(119_999);
    expect(f.results()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.results()).toEqual([{ type: 'cvm.request.result', id: 'long', error: 'relay timeout' }]);
    f.runtime.destroy();
  });

  it('reports relay timeout when the duration expires while consent is still open', async () => {
    const f = await fixture({ respondAfterMs: 0, answer: () => new Promise(() => {}) });
    f.request(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(f.results()).toEqual([{ type: 'cvm.request.result', id: 'long', error: 'relay timeout' }]);
    f.runtime.destroy();
  });

  it('keeps the host approval-wait bound inside a longer accepted duration', async () => {
    // Host policy decision, not a deadline: an unanswered prompt is withdrawn
    // after the coordinator's approval timeout (default 60000 ms) and the
    // request is refused as `policy denied`.
    const f = await fixture({ respondAfterMs: 0, answer: () => new Promise(() => {}) });
    f.request(120_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.results()).toEqual([{ type: 'cvm.request.result', id: 'long', error: 'policy denied' }]);
    f.runtime.destroy();
  });
});
