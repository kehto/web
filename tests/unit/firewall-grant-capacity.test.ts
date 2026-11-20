/**
 * kehto/web#513: the Firewall's shared grant table doesn't fill up under a
 * default allow, and a napplet's approvals can't starve another napplet's.
 *
 * NAP-OUTBOX draft napplet/naps#32 at `8865f73d52a4864afee145f28d26520476273927`
 * sets no grant or table limit; both are Kehto host policy (kehto/web#336).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import { MAX_PERMISSION_GRANTS } from '../../packages/firewall/src/index.js';
import { createRuntime } from '../../packages/runtime/src/runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import type { ApprovalAnswer } from '../../packages/runtime/src/approval-coordinator.js';
import { createOutboxService } from '../../packages/services/src/outbox-service.js';
import { createRelayPoolOutboxRouter } from '../../packages/services/src/relay-pool-outbox-router.js';
import type { RelayListEntry } from '../../packages/services/src/relay-pool-outbox-types.js';

const ORIGINS_PER_PLAN = 127;
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

const author = (index: number): string => index.toString(16).padStart(64, '0');
const lists = (count: number): Map<string, RelayListEntry> =>
  new Map(Array.from({ length: count }, (_, index) => [author(index), { read: [], write: [`wss://r${index}.example`] }]));

async function harness(rule: () => 'allow' | 'ask', options: { maxGrants?: number; maxGrantsPerPrincipal?: number } = {}) {
  const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const ctx = createMockRuntimeAdapter({ permissions: {
    now: Date.now, prompt, createCancellation: () => new AbortController(), ...options,
    defaultDecision: (_request, missing) => missing.every((item) => item.category === 'interface') ? 'allow' : rule(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
  } });
  const runtime = createRuntime(ctx.hooks);
  cleanups.push(() => runtime.destroy());
  const subscribe = vi.fn((_filters: NostrFilter[], _urls: string[], callback: (item: NostrEvent | 'EOSE') => void) => {
    queueMicrotask(() => callback('EOSE'));
    return { unsubscribe: vi.fn() };
  });
  const router = createRelayPoolOutboxRouter({
    relayPool: { subscribe, publish: vi.fn(), isAvailable: () => true },
    fallbackRelays: [], loadRelayLists: () => lists(4096), getSignerPubkey: () => author(0), signEvent: vi.fn(),
  });
  runtime.registerService('outbox', createOutboxService({ router }));
  const open = async (windowId: string, name: string): Promise<void> => {
    runtime.sessionRegistry.register(windowId, { ...createNip5dSessionEntry(windowId, name, 'b'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: `http://${name}.localhost`, artifactHash: 'b'.repeat(64) } });
    await runtime.permissions!.admit(windowId, { required: ['outbox'], optional: [], available: ['outbox'] });
  };
  /** Query one plan of 127 relay origins that no earlier plan used. */
  const query = async (windowId: string, plan: number): Promise<Record<string, unknown>> => {
    const id = `q-${windowId}-${plan}`;
    const authors = Array.from({ length: ORIGINS_PER_PLAN }, (_, index) => author(plan * ORIGINS_PER_PLAN + index));
    runtime.handleMessage(windowId, { type: 'outbox.query', id, filters: [{ kinds: [1], authors, limit: 1 }] } as NappletMessage);
    let result: Record<string, unknown> | undefined;
    await vi.waitFor(() => {
      result = ctx.sent.map((entry) => entry.message as unknown as Record<string, unknown>).find((message) => message.id === id);
      expect(result).toBeDefined();
    });
    return result!;
  };
  return { runtime, prompt, open, query };
}

describe('Firewall grant table capacity (#513)', () => {
  it('approves more than the whole grant table under a default allow, and the next request still succeeds', async () => {
    const h = await harness(() => 'allow');
    await h.open('window', 'feed');
    const plans = Math.ceil(MAX_PERMISSION_GRANTS / ORIGINS_PER_PLAN) + 1;
    for (let plan = 0; plan < plans; plan++) expect((await h.query('window', plan)).error).toBeUndefined();
    expect(plans * ORIGINS_PER_PLAN).toBeGreaterThan(MAX_PERMISSION_GRANTS);
    // The rule answers: no relay origin became a stored grant.
    expect(h.runtime.permissions!.grants.filter((grant) => grant.permission.category !== 'interface')).toEqual([]);
    expect((await h.query('window', plans)).error).toBeUndefined();
    expect(h.prompt).not.toHaveBeenCalled();
  });

  it("doesn't let one napplet's approvals starve another napplet", async () => {
    const h = await harness(() => 'ask', { maxGrants: 300, maxGrantsPerPrincipal: 256 });
    await h.open('greedy', 'greedy');
    await h.open('quiet', 'quiet');
    // Far more answered origins than the whole table holds.
    for (let plan = 0; plan < 8; plan++) expect((await h.query('greedy', plan)).error).toBeUndefined();
    const owned = (target: string) => h.runtime.permissions!.grants.filter((grant) =>
      grant.principal.kind === 'development' && grant.principal.target === target).length;
    expect(owned('http://greedy.localhost')).toBeLessThanOrEqual(256);
    expect((await h.query('quiet', 20)).error).toBeUndefined();
    expect(owned('http://quiet.localhost')).toBe(ORIGINS_PER_PLAN);
  });
});
