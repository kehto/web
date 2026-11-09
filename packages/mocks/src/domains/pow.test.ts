import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MOCK_ACCOUNTS } from '../fixtures/nostr.js';
import { POW_MOCK_ENTRY, POW_SPEC_REF, createMockPowService, leadingZeroBits } from './pow.js';

const ROUTES = ['pow.mine', 'pow.mineAndPublish', 'pow.queue', 'pow.job', 'pow.hashrate', 'pow.cancel', 'pow.pause', 'pow.resume'];
const CLOCK = { now: () => 1_700_000_000_000 };
const ALICE = MOCK_ACCOUNTS[0]!;
const TEMPLATE = { kind: 1, content: 'gm', tags: [] };

function run(service: ReturnType<typeof createMockPowService>, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

function pushed(service: ReturnType<typeof createMockPowService>): NappletMessage[] {
  return service.mock.sent.map((entry) => entry.message).filter((msg) => !msg.type.endsWith('.result'));
}

describe('NAP-POW mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockPowService();
    expect(service.descriptor).toEqual({ name: 'pow', version: '0.1.0', description: 'Mock NAP-POW NIP-13 proof-of-work miner' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(POW_SPEC_REF).toEqual({ nap: 'NAP-POW', status: 'draft', source: 'pr', pr: 39, sha: 'd85b4252f26f', path: 'naps/NAP-POW.md' });
    expect(POW_MOCK_ENTRY).toMatchObject({ domain: 'pow', kind: 'extension' });
    expect(POW_MOCK_ENTRY.create?.({}).descriptor.name).toBe('pow');
  });

  it('counts NIP-13 leading zero bits', () => {
    expect(leadingZeroBits('000007ab'.padEnd(64, 'f'))).toBe(21);
    expect(leadingZeroBits('ffff')).toBe(0);
    expect(leadingZeroBits('0'.repeat(64))).toBe(256);
    expect(leadingZeroBits('0005334891b3dbd7d487f28e91dba74f52bda86562f48cce4b6fc0c79c75c4cd')).toBe(13);
  });

  it('mines a job: ack, progress pushes, state, and pow.done with a committed event', () => {
    const service = createMockPowService({ clock: CLOCK });
    expect(run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 12, options: { workers: 2 } }))
      .toEqual({ type: 'pow.mine.result', id: 'm1', jobId: 'job-1', accepted: true, state: 'mining' });
    expect(service.advance()).toEqual([]);
    expect(service.advance()).toEqual(['job-1']);
    expect(pushed(service)).toEqual([
      { type: 'pow.progress', jobId: 'job-1', progress: { jobId: 'job-1', target: 12, state: 'mining', bestPow: 6, bestNonce: '384557', hashes: 500_000, hashRate: 500_000, workers: [{ workerId: 0, bestPow: 6, hashes: 250_000, hashRate: 250_000 }, { workerId: 1, bestPow: 5, hashes: 250_000, hashRate: 250_000 }], elapsedMs: 1000 } },
      { type: 'pow.progress', jobId: 'job-1', progress: { jobId: 'job-1', target: 12, state: 'mining', bestPow: 12, bestNonce: '912155', hashes: 1_000_000, hashRate: 500_000, workers: [{ workerId: 0, bestPow: 12, hashes: 500_000, hashRate: 250_000 }, { workerId: 1, bestPow: 11, hashes: 500_000, hashRate: 250_000 }], elapsedMs: 2000 } },
      { type: 'pow.state', jobId: 'job-1', state: 'done' },
      { type: 'pow.done', jobId: 'job-1', result: {
        jobId: 'job-1', ok: true, pow: 12, nonce: '912155', hashes: 1_000_000, elapsedMs: 2000,
        event: { id: '0005334891b3dbd7d487f28e91dba74f52bda86562f48cce4b6fc0c79c75c4cd', pubkey: ALICE.pubkey, created_at: 1_700_000_000, kind: 1, tags: [['nonce', '912155', '12']], content: 'gm' },
      } },
    ]);
    const done = pushed(service).at(-1) as unknown as { result: { event: { id: string; sig?: string } } };
    expect(leadingZeroBits(done.result.event.id)).toBeGreaterThanOrEqual(12);
    expect(done.result.event.sig).toBeUndefined();
    expect(run(service, 'w1', { type: 'pow.job', id: 'j1', jobId: 'job-1' })).toMatchObject({ type: 'pow.job.result', id: 'j1', progress: { state: 'done', bestPow: 12, hashRate: 0 } });
    expect(run(service, 'w1', { type: 'pow.queue', id: 'q1' })).toEqual({ type: 'pow.queue.result', id: 'q1', jobs: [] });
  });

  it('queues beyond maxConcurrent, reports positions, and promotes with pow.state', () => {
    const service = createMockPowService({ clock: CLOCK });
    run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 6 });
    expect(run(service, 'w1', { type: 'pow.mine', id: 'm2', jobId: 'job-2', template: TEMPLATE, target: 6, options: { priority: 5 } }))
      .toEqual({ type: 'pow.mine.result', id: 'm2', jobId: 'job-2', accepted: true, state: 'queued', position: 0 });
    expect(run(service, 'w1', { type: 'pow.queue', id: 'q1' })).toEqual({ type: 'pow.queue.result', id: 'q1', jobs: [
      { jobId: 'job-1', target: 6, state: 'mining', priority: 0, bestPow: 0, hashRate: 250_000, kind: 1, mode: 'mine' },
      { jobId: 'job-2', target: 6, state: 'queued', priority: 5, position: 0, bestPow: 0, hashRate: 0, kind: 1, mode: 'mine' },
    ] });
    expect(run(service, 'w1', { type: 'pow.hashrate', id: 'h1' })).toEqual({ type: 'pow.hashrate.result', id: 'h1', hashrate: { hashRate: 250_000, workers: 1, perWorker: [{ workerId: 0, hashRate: 250_000 }], byJob: [{ jobId: 'job-1', hashRate: 250_000 }] } });
    expect(service.advance()).toEqual(['job-1']);
    expect(pushed(service).filter((msg) => msg.type === 'pow.state')).toEqual([
      { type: 'pow.state', jobId: 'job-1', state: 'done' },
      { type: 'pow.state', jobId: 'job-2', state: 'mining' },
    ]);
    expect(run(service, 'w1', { type: 'pow.job', id: 'j2', jobId: 'job-2' })).toMatchObject({ progress: { state: 'mining', bestPow: 0 } });
  });

  it('rejects duplicates, invalid targets, templates, and unknown jobs', () => {
    const service = createMockPowService({ clock: CLOCK, maxTarget: 24 });
    run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 6 });
    expect(run(service, 'w1', { type: 'pow.mine', id: 'm2', jobId: 'job-1', template: TEMPLATE, target: 6 })).toEqual({ type: 'pow.mine.result', id: 'm2', jobId: 'job-1', accepted: false, error: 'duplicate jobId' });
    expect(run(service, 'w1', { type: 'pow.mine', id: 'm3', jobId: 'job-3', template: TEMPLATE, target: 25 })).toEqual({ type: 'pow.mine.result', id: 'm3', jobId: 'job-3', accepted: false, error: 'invalid target' });
    expect(run(service, 'w1', { type: 'pow.mine', id: 'm4', jobId: 'job-4', template: { kind: 1 }, target: 6 })).toEqual({ type: 'pow.mine.result', id: 'm4', jobId: 'job-4', accepted: false, error: 'invalid template' });
    expect(run(service, 'w1', { type: 'pow.job', id: 'j1', jobId: 'nope' })).toEqual({ type: 'pow.job.result', id: 'j1', error: 'unknown jobId' });
    expect(run(service, 'w2', { type: 'pow.job', id: 'j2', jobId: 'job-1' })).toEqual({ type: 'pow.job.result', id: 'j2', error: 'unknown jobId' });
    expect(run(service, 'w1', { type: 'pow.cancel', id: 'c1', jobId: 'nope' })).toEqual({ type: 'pow.cancel.result', id: 'c1', jobId: 'nope', cancelled: false, error: 'unknown jobId' });
    expect(run(service, 'w1', { type: 'pow.pause', id: 'p1', jobId: 'nope' })).toEqual({ type: 'pow.pause.result', id: 'p1', jobId: 'nope', error: 'unknown jobId' });
    expect(service.mock.state().jobs.size).toBe(1);
  });

  it('cancels, pauses, and resumes jobs and the whole miner', () => {
    const service = createMockPowService({ clock: CLOCK, maxConcurrent: 2 });
    run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 12 });
    run(service, 'w1', { type: 'pow.mine', id: 'm2', jobId: 'job-2', template: TEMPLATE, target: 12 });
    service.advance();
    expect(run(service, 'w1', { type: 'pow.pause', id: 'p1', jobId: 'job-1' })).toEqual({ type: 'pow.pause.result', id: 'p1', jobId: 'job-1' });
    expect(run(service, 'w1', { type: 'pow.job', id: 'j1', jobId: 'job-1' })).toMatchObject({ progress: { state: 'paused', bestPow: 6, hashes: 250_000, hashRate: 0 } });
    service.advance();
    expect(run(service, 'w1', { type: 'pow.job', id: 'j2', jobId: 'job-1' })).toMatchObject({ progress: { state: 'paused', hashes: 250_000 } });
    expect(run(service, 'w1', { type: 'pow.resume', id: 'r1', jobId: 'job-1' })).toEqual({ type: 'pow.resume.result', id: 'r1', jobId: 'job-1' });
    expect(run(service, 'w1', { type: 'pow.job', id: 'j3', jobId: 'job-1' })).toMatchObject({ progress: { state: 'mining', hashes: 250_000 } });

    expect(run(service, 'w1', { type: 'pow.pause', id: 'p2' })).toEqual({ type: 'pow.pause.result', id: 'p2' });
    expect(service.mock.state().minerPaused).toBe(true);
    expect(run(service, 'w1', { type: 'pow.queue', id: 'q' })).toMatchObject({ jobs: [{ jobId: 'job-1', state: 'paused', hashRate: 0 }] });
    expect(run(service, 'w1', { type: 'pow.resume', id: 'r2' })).toEqual({ type: 'pow.resume.result', id: 'r2' });
    expect(service.mock.state().jobs.get('job-1')!.state).toBe('mining');

    expect(run(service, 'w1', { type: 'pow.cancel', id: 'c1', jobId: 'job-1' })).toEqual({ type: 'pow.cancel.result', id: 'c1', jobId: 'job-1', cancelled: true });
    expect(pushed(service).slice(-2)).toEqual([{ type: 'pow.state', jobId: 'job-1', state: 'cancelled' }, { type: 'pow.error', jobId: 'job-1', error: 'cancelled' }]);
    expect(run(service, 'w1', { type: 'pow.cancel', id: 'c2', jobId: 'job-1' })).toEqual({ type: 'pow.cancel.result', id: 'c2', jobId: 'job-1', cancelled: false });
  });

  it('mines and publishes through outbox fanout, or reports publish denial', () => {
    const service = createMockPowService({ clock: CLOCK });
    expect(run(service, 'w1', { type: 'pow.mineAndPublish', id: 'p1', jobId: 'job-2', template: { kind: 1, content: 'powered note', tags: [['t', 'linux']] }, target: 6 }))
      .toEqual({ type: 'pow.mineAndPublish.result', id: 'p1', jobId: 'job-2', accepted: true, state: 'mining' });
    service.advance();
    const done = pushed(service).at(-1) as unknown as { type: string; result: Record<string, unknown> & { event: { id: string; sig: string; tags: string[][] } } };
    expect(done.type).toBe('pow.done');
    expect(done.result).toMatchObject({ jobId: 'job-2', ok: true, pow: 6, published: { eventId: done.result.event.id, relays: { [ALICE.writeRelays[0]!]: true, [ALICE.writeRelays[1]!]: true } } });
    expect(done.result.event.sig).toHaveLength(128);
    expect(done.result.event.tags).toEqual([['t', 'linux'], ['nonce', done.result.nonce as string, '6']]);
    expect(leadingZeroBits(done.result.event.id)).toBeGreaterThanOrEqual(6);

    const denied = createMockPowService({ clock: CLOCK, denyPublish: true });
    run(denied, 'w1', { type: 'pow.mineAndPublish', id: 'p1', jobId: 'job-9', template: TEMPLATE, target: 6 });
    denied.advance();
    expect(pushed(denied).at(-1)).toMatchObject({ type: 'pow.done', jobId: 'job-9', result: { ok: false, error: 'publish denied' } });
  });

  it('times out mining and runs autoplay through the scheduler', () => {
    const service = createMockPowService({ clock: CLOCK });
    run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 32, options: { timeoutMs: 1500 } });
    expect(service.advance(2)).toEqual(['job-1']);
    expect(pushed(service).slice(-2)).toEqual([{ type: 'pow.state', jobId: 'job-1', state: 'error' }, { type: 'pow.error', jobId: 'job-1', error: 'timeout' }]);

    const queued: Array<() => void> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } };
    const auto = createMockPowService({ clock: CLOCK, scheduler, autoplay: true, tickMs: 10 });
    run(auto, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 12 });
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(pushed(auto).at(-1)).toMatchObject({ type: 'pow.done', jobId: 'job-1' });
    expect(queued).toHaveLength(0);
    run(auto, 'w1', { type: 'pow.mine', id: 'm2', jobId: 'job-2', template: TEMPLATE, target: 12 });
    expect(queued).toHaveLength(1);
    auto.mock.reset();
    expect(cancelled).toBe(1);
    expect(auto.mock.state().jobs.size).toBe(0);
    expect(auto.mock.sent).toEqual([]);
  });

  it('drops a window\'s jobs on destroy and revocation, promoting other windows', () => {
    const service = createMockPowService({ clock: CLOCK });
    run(service, 'w1', { type: 'pow.mine', id: 'm1', jobId: 'job-1', template: TEMPLATE, target: 12 });
    run(service, 'w2', { type: 'pow.mine', id: 'm2', jobId: 'job-2', template: TEMPLATE, target: 12 });
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().jobs.has('job-1')).toBe(false);
    expect(service.mock.state().order).toEqual(['job-2']);
    expect(service.mock.state().jobs.get('job-2')!.state).toBe('mining');
    service.onCapabilityRevoked?.('w2', null);
    expect(service.mock.state().jobs.size).toBe(0);
  });
});
