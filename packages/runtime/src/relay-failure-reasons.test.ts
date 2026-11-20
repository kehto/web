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

async function fixture(network: ApprovalAnswer['effect'], execute: RelayPlanningServiceHandler['executeRelayOperation'],
  relayUrls: readonly string[] = ['wss://relay.example'], limits: { maxRequirements?: number; maxGrants?: number } = {}) {
  // Admission is allowed; only the relay destination answer varies.
  const prompt = vi.fn(async ({ missing }: ApprovalPrompt): Promise<ApprovalAnswer> =>
    ({ effect: missing.some((item) => item.category === 'network') ? network : 'allow', lifetime: 'session' }));
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: () => 0, prompt, createCancellation: () => new AbortController(), ...limits,
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
  } });
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  runtime.sessionRegistry.register('window', { ...createNip5dSessionEntry('window', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development' as const, target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } });
  await runtime.permissions!.admit('window', { required: ['relay'], optional: [], available: ['relay'] });
  const service: RelayPlanningServiceHandler = {
    descriptor: { name: 'relay', version: '1' },
    planRelayOperation: (): RelayOperationPlan => Object.freeze({ operation: 'subscribe', relayUrls: Object.freeze([...relayUrls]), localOnly: false }),
    executeRelayOperation: execute,
    handleMessage: vi.fn(),
  };
  runtime.registerService('relay', service);
  runtime.handleMessage('window', { type: 'relay.subscribe', id: 's', subId: 'feed', filters: [{ kinds: [1] }] } as NappletMessage);
  const messages = () => ctx.sent.map(({ message }) => message).filter((message): message is NappletMessage => !Array.isArray(message));
  return Object.assign(() => messages().filter((message) => message.type === 'relay.closed'), { messages, prompt });
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

/**
 * kehto/web#455: the Firewall caps one request at MAX_PERMISSION_REQUIREMENTS.
 * NAP-RELAY lets the shell close a subscription for a resource limit, with a
 * free-form reason, so an oversized host plan is not reported as a denial.
 */
describe('relay.subscribe plans larger than one approval', () => {
  it('closes a plan over the origin cap with too many relays, never a denial', async () => {
    const execute = vi.fn();
    const relays = Array.from({ length: 200 }, (_, index) => `wss://r${index}.example`);
    const closed = await fixture('allow', execute, relays);
    await vi.waitFor(() => expect(closed()).toEqual([{ type: 'relay.closed', subId: 'feed', reason: 'too many relays' }]));
    expect(execute).not.toHaveBeenCalled();
  });

  it('asks for each relay origin once, however many paths share it', async () => {
    const execute = vi.fn();
    const relays = Array.from({ length: 200 }, (_, index) => `wss://same.example/r${index}`);
    const closed = await fixture('allow', execute, relays);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const network = closed.prompt.mock.calls.flatMap(([call]) => call.missing).filter((item) => item.category === 'network');
    expect(network).toEqual([{ category: 'network', domain: 'relay', operation: 'relay.network', scope: { kind: 'origin', value: 'wss://same.example' } }]);
    expect(closed()).toEqual([]);
  });
});

// kehto/web#514/#513: the bound follows the host option, and a full grant table is not a denial.
describe('relay.subscribe under configured Firewall limits', () => {
  it('accepts a host plan up to a larger configured maxRequirements', async () => {
    const execute = vi.fn();
    const relays = Array.from({ length: 200 }, (_, index) => `wss://r${index}.example`);
    const closed = await fixture('allow', execute, relays, { maxRequirements: 256 });
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(closed()).toEqual([]);
  });

  it('closes with approval capacity reached when the grant table is full', async () => {
    const execute = vi.fn();
    // One grant: the relay interface admission fits, the relay origin does not.
    const closed = await fixture('allow', execute, ['wss://relay.example'], { maxGrants: 1 });
    await vi.waitFor(() => expect(closed()).toEqual([{ type: 'relay.closed', subId: 'feed', reason: 'approval capacity reached' }]));
    expect(execute).not.toHaveBeenCalled();
  });
});
