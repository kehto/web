/**
 * NAP-CVM admission through the real runtime boundary (kehto/web#355).
 *
 * Spec checked: NAP-CVM napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f,
 * Security Considerations ("SHOULD apply per-napplet concurrency limits") and
 * Sessions ("Endpoint destruction performs the same cleanup").
 *
 * The service tests drive lifecycle hooks directly. These drive the hooks the
 * way a host does: through `Runtime.handleMessage`, `destroyWindow`, session
 * re-registration, grant revocation, and `destroy`, with the scoped-permission
 * coordinator in the path.
 */
import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime, type ApprovalSignal } from '@kehto/runtime';
import { createCvmService, type CvmConcurrencyOptions, type CvmTransport } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const SERVER = { pubkey: 'a'.repeat(64), relays: ['wss://relay.example'] };

interface Call { id: unknown; signal: ApprovalSignal; resolve(): void }

function entry(windowId: string, dTag: string, hash: string) {
  return { ...createNip5dSessionEntry(windowId, dTag, hash),
    permissionPrincipal: { kind: 'development' as const, target: `http://localhost/${dTag}`, artifactHash: hash } };
}

async function fixture(concurrency: CvmConcurrencyOptions, maxPending?: number) {
  const calls: Call[] = [];
  const transport: CvmTransport = {
    discover: async () => [], close: async () => {}, onEvent: () => ({ close() {} }),
    request: (_server, message, _options, execution) => new Promise((resolve) => {
      calls.push({ id: message.id, signal: execution!.signal, resolve: () => resolve({ jsonrpc: '2.0', id: message.id, result: {} }) });
    }),
  };
  const ctx = createMockRuntimeAdapter({
    services: { cvm: createCvmService({ transport, concurrency }) },
    permissions: {
      now: () => 0, prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
      createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
      ...(maxPending === undefined ? {} : { maxPending }),
    },
  });
  const runtime = createRuntime(ctx.hooks);
  async function open(windowId: string, dTag: string, hash: string) {
    runtime.sessionRegistry.register(windowId, entry(windowId, dTag, hash));
    const admission = await runtime.permissions!.admit(windowId, { required: ['cvm'], optional: [], available: ['cvm'] });
    expect(admission.status).toBe('admitted');
  }
  const request = (windowId: string, id: string, server = SERVER) => runtime.handleMessage(windowId, {
    type: 'cvm.request', id, server, message: { jsonrpc: '2.0', id, method: 'tools/call' },
  } as NappletMessage);
  const results = (windowId: string) => ctx.sent.filter((sent) => sent.windowId === windowId)
    .map((sent) => sent.message as { id?: string; error?: string })
    .map((message) => [message.id, message.error ?? 'ok']);
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return { runtime, ctx, calls, open, request, results, settle };
}

describe('runtime CVM admission', () => {
  it('bounds one endpoint and leaves a second napplet untouched', async () => {
    const f = await fixture({ maxInFlight: 1, maxQueued: 1 });
    await f.open('greedy', 'greedy-app', 'a'.repeat(64));
    await f.open('quiet', 'quiet-app', 'b'.repeat(64));
    for (const id of ['g1', 'g2', 'g3']) f.request('greedy', id);
    f.request('quiet', 'q1');
    await f.settle();
    expect(f.results('greedy')).toEqual([['g3', 'policy denied']]);
    expect(f.calls.map((call) => call.id)).toEqual(['g1', 'q1']);
    f.calls[1].resolve();
    await f.settle();
    expect(f.results('quiet')).toEqual([['q1', 'ok']]);
    f.calls[0].resolve();
    await f.settle();
    expect(f.calls.map((call) => call.id)).toEqual(['g1', 'q1', 'g2']);
    f.runtime.destroy();
  });

  it('keeps a queueing napplet from exhausting the shared approval budget', async () => {
    // The approval coordinator's `maxPending` is one budget for every napplet
    // and every coordinated domain, and it only serializes identical scopes.
    // Distinct servers are distinct scopes, so without admission these twelve
    // requests would take all four shared slots and `quiet` would be refused.
    const f = await fixture({ maxInFlight: 2, maxQueued: 16 }, 4);
    await f.open('greedy', 'greedy-app', 'a'.repeat(64));
    await f.open('quiet', 'quiet-app', 'b'.repeat(64));
    for (let i = 0; i < 12; i++) f.request('greedy', `g${i}`, { ...SERVER, pubkey: i.toString(16).repeat(64) });
    await f.settle();
    f.request('quiet', 'q1');
    await f.settle();
    expect(f.results('greedy')).toEqual([]);
    expect(f.calls.map((call) => call.id)).toEqual(['g0', 'g1', 'q1']);
    f.runtime.destroy();
  });

  it('frees the budget when the window is destroyed', async () => {
    const f = await fixture({ maxInFlight: 1, maxQueued: 1 });
    await f.open('a', 'app', 'a'.repeat(64));
    f.request('a', 'r1');
    f.request('a', 'r2');
    await f.settle();
    f.runtime.destroyWindow('a');
    f.runtime.sessionRegistry.unregister('a');
    await f.settle();
    expect(f.calls[0].signal.aborted).toBe(true);
    expect(f.results('a')).toEqual([]);
    await f.open('a', 'app', 'a'.repeat(64));
    f.request('a', 'n1');
    f.request('a', 'n2');
    await f.settle();
    expect(f.results('a')).toEqual([]);
    expect(f.calls.map((call) => call.id)).toEqual(['r1', 'n1']);
    f.runtime.destroy();
  });

  it('retires the old endpoint when its window id is re-registered', async () => {
    const f = await fixture({ maxInFlight: 1, maxQueued: 0 });
    await f.open('a', 'app', 'a'.repeat(64));
    f.request('a', 'old');
    await f.settle();
    // A reload re-registers the same window id with a new source.
    await f.open('a', 'app', 'c'.repeat(64));
    expect(f.calls[0].signal.aborted).toBe(true);
    f.request('a', 'new');
    await f.settle();
    expect(f.calls.map((call) => call.id)).toEqual(['old', 'new']);
    f.calls[0].resolve();
    f.calls[1].resolve();
    await f.settle();
    // The old endpoint's answer is not projected into its replacement.
    expect(f.results('a')).toEqual([['new', 'ok']]);
    f.runtime.destroy();
  });

  it('frees the budget when grants are revoked while the source stays live', async () => {
    const f = await fixture({ maxInFlight: 1, maxQueued: 1 });
    await f.open('a', 'app', 'a'.repeat(64));
    f.request('a', 'r1');
    f.request('a', 'r2');
    await f.settle();
    expect(f.runtime.permissions!.clear()).toBe(true);
    await f.settle();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].signal.aborted).toBe(true);
    const admission = await f.runtime.permissions!.admit('a', { required: ['cvm'], optional: [], available: ['cvm'] });
    expect(admission.status).toBe('admitted');
    f.ctx.sent.length = 0;
    f.request('a', 'n1');
    f.request('a', 'n2');
    await f.settle();
    expect(f.results('a')).toEqual([]);
    expect(f.calls.map((call) => call.id)).toEqual(['r1', 'n1']);
    f.runtime.destroy();
  });

  it('aborts running work and drops queued work on runtime teardown', async () => {
    const f = await fixture({ maxInFlight: 1, maxQueued: 4 });
    await f.open('a', 'app', 'a'.repeat(64));
    for (const id of ['r1', 'r2', 'r3']) f.request('a', id);
    await f.settle();
    f.runtime.destroy();
    await f.settle();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].signal.aborted).toBe(true);
    expect(f.results('a')).toEqual([]);
  });
});
