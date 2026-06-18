/**
 * resource-service.test.ts — Unit tests for the NAP-RESOURCE reference service factory.
 *
 * Test plan (9 cases):
 *   a. createResourceService({}) throws with message matching /H-03/ (constructor H-03 guard)
 *   b. createResourceService({ fetch }) throws (missing isOriginGranted + getConnectGrants + resolveIdentity)
 *   c. Full options succeeds; descriptor.name === 'resource'
 *   d. resource.bytes for ungranted origin emits bytes.error code='denied'; fetch NEVER called
 *   e. resource.bytes for granted origin calls fetch once + emits bytes.result with correct fields
 *   f. resource.cancel with matching requestId aborts controller; bytes.error code='canceled'
 *   g. Invalid URL → bytes.error code='invalid-url'
 *   h. Fetch reject (non-abort) → bytes.error code='network-error'
 *   i. onWindowDestroyed(w) aborts all in-flight requests for that window
 */

import { describe, it, expect, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createResourceService } from './resource-service.js';
import type { ResourceServiceOptions } from './resource-service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const DTAG = 'my-napplet';
const HASH = 'a'.repeat(64);
const GRANTED_ORIGIN = 'http://localhost:5174';
const DENIED_ORIGIN = 'https://untrusted.example';

/** Build minimal valid options with injectable mocks. */
function makeOpts(overrides: Partial<ResourceServiceOptions> = {}): ResourceServiceOptions {
  const mockFetch = vi.fn(async (_url: string, _init: { method?: string; headers?: Record<string, string>; signal: AbortSignal }): Promise<Response> => {
    const body = JSON.stringify({ ok: true });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const resolveIdentity = vi.fn((_windowId: string) => ({ dTag: DTAG, aggregateHash: HASH }));

  const getConnectGrants = vi.fn((_dTag: string, _hash: string): readonly string[] => [GRANTED_ORIGIN]);

  const isOriginGranted = vi.fn((origin: string, grants: readonly string[]): boolean =>
    grants.includes(origin)
  );

  return {
    fetch: mockFetch,
    resolveIdentity,
    getConnectGrants,
    isOriginGranted,
    ...overrides,
  };
}

/** Collect sent envelopes synchronously (for async tests, await flushPromises first). */
function collectSent(): { sent: NappletMessage[]; send: (msg: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  const send = (msg: NappletMessage) => { sent.push(msg); };
  return { sent, send };
}

/** Flush microtask queue so async handleMessage flows complete. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('createResourceService', () => {

  // ─── (a) H-03 guard: empty options throws ──────────────────────────────────
  it('(a) throws with H-03 message when called with empty options', () => {
    expect(() => createResourceService({} as ResourceServiceOptions)).toThrow(/H-03/);
  });

  // ─── (b) partial options also throws ───────────────────────────────────────
  it('(b) throws when only fetch is provided (missing isOriginGranted, getConnectGrants, resolveIdentity)', () => {
    const fetchMock = vi.fn();
    expect(() => createResourceService({ fetch: fetchMock } as unknown as ResourceServiceOptions)).toThrow(/H-03/);
  });

  // ─── (c) full options succeeds ─────────────────────────────────────────────
  it('(c) succeeds with all four options; descriptor.name === resource', () => {
    const opts = makeOpts();
    const svc = createResourceService(opts);
    expect(svc).toBeDefined();
    expect(svc.descriptor.name).toBe('resource');
    expect(svc.descriptor.version).toBe('1.0.0');
  });

  // ─── (d) ungranted origin: denied, fetch never called ─────────────────────
  it('(d) resource.bytes for ungranted origin emits bytes.error code=denied; fetch NOT called', async () => {
    const opts = makeOpts();
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r1',
      url: `${DENIED_ORIGIN}/api/data`,
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    const err = sent[0] as { type: string; requestId: string; code: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.requestId).toBe('r1');
    expect(err.code).toBe('denied');
  });

  // ─── (e) granted origin: fetch called, bytes.result emitted ──────────────
  it('(e) resource.bytes for granted origin calls fetch and emits bytes.result', async () => {
    const bodyText = 'hello world';
    const opts = makeOpts({
      fetch: vi.fn(async (_url, _init) => {
        return new Response(bodyText, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }),
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r2',
      url: `${GRANTED_ORIGIN}/api/data`,
      init: { method: 'GET', headers: { 'x-custom': 'yes' } },
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = (opts.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { method?: string; headers?: Record<string, string>; signal: AbortSignal }];
    expect(calledUrl).toBe(`${GRANTED_ORIGIN}/api/data`);
    expect(calledInit.method).toBe('GET');
    expect(calledInit.headers?.['x-custom']).toBe('yes');
    expect(calledInit.signal).toBeInstanceOf(AbortSignal);

    expect(sent).toHaveLength(1);
    const result = sent[0] as { type: string; requestId: string; status: number; headers: Record<string, string>; bodyBase64: string };
    expect(result.type).toBe('resource.bytes.result');
    expect(result.requestId).toBe('r2');
    expect(result.status).toBe(200);
    // Decode check: base64 round-trips to original body
    expect(atob(result.bodyBase64)).toBe(bodyText);
  });

  // ─── (f) resource.cancel with matching requestId → canceled ──────────────
  it('(f) resource.cancel with matching requestId aborts in-flight fetch; bytes.error code=canceled', async () => {
    let capturedSignal!: AbortSignal;

    const opts = makeOpts({
      fetch: vi.fn((_url: string, init: { signal: AbortSignal }) => {
        capturedSignal = init.signal;
        // Return a promise that rejects when aborted
        return new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          });
        });
      }),
    });

    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    // Issue request
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r3',
      url: `${GRANTED_ORIGIN}/slow`,
    } as NappletMessage, send);

    // Cancel before fetch resolves
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.cancel',
      requestId: 'r3',
    } as NappletMessage, send);

    await flushPromises();
    await flushPromises(); // second flush for the abort rejection path

    expect(capturedSignal.aborted).toBe(true);
    expect(sent).toHaveLength(1);
    const err = sent[0] as { type: string; requestId: string; code: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.requestId).toBe('r3');
    expect(err.code).toBe('canceled');
  });

  // ─── (g) invalid URL → bytes.error code=invalid-url ──────────────────────
  it('(g) invalid URL emits bytes.error code=invalid-url; fetch NOT called', async () => {
    const opts = makeOpts();
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r4',
      url: 'not a url',
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    const err = sent[0] as { type: string; code: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.code).toBe('invalid-url');
  });

  // ─── (h) fetch reject (non-abort) → bytes.error code=network-error ────────
  it('(h) fetch network error emits bytes.error code=network-error', async () => {
    const opts = makeOpts({
      fetch: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r5',
      url: `${GRANTED_ORIGIN}/api`,
    } as NappletMessage, send);

    await flushPromises();

    expect(sent).toHaveLength(1);
    const err = sent[0] as { type: string; code: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.code).toBe('network-error');
  });

  // ─── (i) onWindowDestroyed aborts all in-flight for that window ────────────
  it('(i) onWindowDestroyed aborts all in-flight requests for the window', async () => {
    const signals: AbortSignal[] = [];

    const opts = makeOpts({
      fetch: vi.fn((_url: string, init: { signal: AbortSignal }) => {
        signals.push(init.signal);
        return new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    });

    const svc = createResourceService(opts);
    const { send } = collectSent();

    // Issue two in-flight requests on the same window
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r6',
      url: `${GRANTED_ORIGIN}/a`,
    } as NappletMessage, send);

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      requestId: 'r7',
      url: `${GRANTED_ORIGIN}/b`,
    } as NappletMessage, send);

    await flushPromises();

    // All signals should be live before destroy
    expect(signals.every(s => !s.aborted)).toBe(true);

    svc.onWindowDestroyed?.(WINDOW_ID);

    expect(signals.every(s => s.aborted)).toBe(true);
  });

});
