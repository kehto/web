/**
 * Relay transport failures are never reported as authorization refusals (kehto/web#460).
 *
 * NAP-RELAY (napplet/naps#2 at `9f30b3505335a52c574ff570576687d6467021ff`):
 * "`relay.closed` indicates the shell terminated a subscription, with an
 * optional `reason`." The reason is free-form, so Kehto only fixes the split:
 * an approval that did not execute says so; a relay that failed says that.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { ApprovalAnswer, ApprovalCancellation, ApprovalPrompt } from './approval-coordinator.js';
import type { RelayOperationPlan, RelayPlanningServiceHandler } from './service-types.js';

declare const AbortController: { new(): ApprovalCancellation };
declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); });

async function fixture(network: ApprovalAnswer['effect'], execute: RelayPlanningServiceHandler['executeRelayOperation']) {
  // Admission is allowed; only the relay destination answer varies.
  const prompt = vi.fn(async ({ missing }: ApprovalPrompt): Promise<ApprovalAnswer> =>
    ({ effect: missing.some((item) => item.category === 'network') ? network : 'allow', lifetime: 'session' }));
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: () => 0, prompt, createCancellation: () => new AbortController(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
  } });
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  runtime.sessionRegistry.register('window', { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } });
  await runtime.permissions!.admit('window', { required: ['relay'], optional: [], available: ['relay'] });
  const service: RelayPlanningServiceHandler = {
    descriptor: { name: 'relay', version: '1' },
    planRelayOperation: (): RelayOperationPlan => Object.freeze({ operation: 'subscribe', relayUrls: Object.freeze(['wss://relay.example']), localOnly: false }),
    executeRelayOperation: execute,
    handleMessage: vi.fn(),
  };
  runtime.registerService('relay', service);
  runtime.handleMessage('window', { type: 'relay.subscribe', id: 's', subId: 'feed', filters: [{ kinds: [1] }] } as NappletMessage);
  const messages = () => ctx.sent.map(({ message }) => message).filter((message): message is NappletMessage => !Array.isArray(message));
  return Object.assign(() => messages().filter((message) => message.type === 'relay.closed'), { messages });
}

describe('relay.subscribe failure reasons', () => {
  it('reports a relay that throws while opening as a subscription failure, not a denial', async () => {
    const closed = await fixture('allow', () => { throw new Error('WebSocket connection failed'); });
    await vi.waitFor(() => expect(closed()).toEqual([{ type: 'relay.closed', subId: 'feed', reason: 'relay subscription failed' }]));
  });

  it('keeps the authorization reason for an approval that did not execute', async () => {
    const execute = vi.fn();
    const closed = await fixture('deny', execute);
    await vi.waitFor(() => expect(closed()).toEqual([{ type: 'relay.closed', subId: 'feed', reason: 'relay authorization unavailable or denied' }]));
    expect(execute).not.toHaveBeenCalled();
  });

  it('retires a subscription whose relay threw so a late delivery never follows relay.closed', async () => {
    let late!: (message: NappletMessage) => void;
    const closed = await fixture('allow', (_w, _m, _plan, _signal, send) => {
      late = send;
      throw new Error('WebSocket connection failed');
    });
    await vi.waitFor(() => expect(closed()).toHaveLength(1));
    late({ type: 'relay.eose', subId: 'feed' } as NappletMessage);
    expect(closed.messages().map((message) => message.type)).toEqual(['relay.closed']);
  });
});
