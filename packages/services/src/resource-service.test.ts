/**
 * resource-service.test.ts — Unit tests for the NAP-RESOURCE reference service factory.
 *
 * Test plan:
 *   a. createResourceService({}) throws when the runtime resolver is missing
 *   b. createResourceService({ fetch }) succeeds without a Kehto-selected policy
 *   c. Optional origin policy hooks remain available to runtime implementers
 *   d. resource.bytes for an origin rejected by optional runtime policy never calls fetch
 *   e. resource.bytes delegates to the runtime resolver and emits current result fields
 *   f. resource.cancel aborts and drops the late terminal envelope
 *   g. Invalid URL → bytes.error error='invalid-request'
 *   h. Fetch reject (non-abort) → bytes.error error='network-error'
 *   i. onWindowDestroyed(w) aborts all in-flight requests for that window
 *   j. resource.info emits advisory runtime info
 *   k. resource.info provider failures emit resource.info.error
 *   l. resource.bytes emits current NAP-RESOURCE id/blob/mime fields
 *   m. resource.bytesMany preserves order and returns per-URL success/error items
 *   n. resource.bytesMany with empty requests emits a top-level bytesMany.error
 *   o. Blossom server hints reach the resolver for single and bulk requests
 */

import { describe, it, expect, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createResourceService, ResourceServiceError } from './resource-service.js';
import type { ResourceServiceOptions } from './resource-service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const DTAG = 'my-napplet';
const HASH = 'a'.repeat(64);
const GRANTED_ORIGIN = 'http://localhost:5174';
const DENIED_ORIGIN = 'https://untrusted.example';

/** Build minimal valid options with injectable mocks. */
function makeOpts(overrides: Partial<ResourceServiceOptions> = {}): ResourceServiceOptions {
  const mockFetch = vi.fn(async (_url: string, _init: { method?: string; headers?: Record<string, string>; signal: AbortSignal; servers?: readonly string[] }): Promise<Response> => {
    const body = JSON.stringify({ ok: true });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  });

  return {
    fetch: mockFetch,
    resourceInfo: {
      schemes: [
        { scheme: 'http', enabled: true },
        { scheme: 'https', enabled: true },
      ],
    },
    ...overrides,
  } as ResourceServiceOptions;
}

function originPolicy(): Pick<
  ResourceServiceOptions,
  'resolveIdentity' | 'getConnectGrants' | 'isOriginGranted'
> {
  return {
    resolveIdentity: vi.fn((_windowId: string) => ({ dTag: DTAG, aggregateHash: HASH })),
    getConnectGrants: vi.fn((_dTag: string, _hash: string): readonly string[] => [GRANTED_ORIGIN]),
    isOriginGranted: vi.fn((origin: string, grants: readonly string[]): boolean =>
      grants.includes(origin)
    ),
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

  // ─── (a) Runtime resolver guard: empty options throws ──────────────────────
  it('(a) throws when called without a runtime resource resolver', () => {
    expect(() => createResourceService({} as ResourceServiceOptions)).toThrow(/fetch/);
  });

  // ─── (b) Kehto does not select runtime policy ──────────────────────────────
  it('(b) accepts a runtime resource resolver without origin-policy hooks', () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    expect(() => createResourceService({ fetch: fetchMock })).not.toThrow();
  });

  it('(b) rejects a partially configured optional origin policy', () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    expect(() => createResourceService({
      fetch: fetchMock,
      isOriginGranted: () => true,
    })).toThrow(/isOriginGranted, getConnectGrants, resolveIdentity/);
  });

  // ─── (c) optional runtime policy succeeds ──────────────────────────────────
  it('(c) accepts optional runtime-owned origin policy; descriptor.name === resource', () => {
    const opts = makeOpts({
      ...originPolicy(),
      resourceInfo: { schemes: [{ scheme: 'http', enabled: true }] },
    });
    const svc = createResourceService(opts);
    expect(svc).toBeDefined();
    expect(svc.descriptor.name).toBe('resource');
    expect(svc.descriptor.version).toBe('1.0.0');
  });

  // ─── (d) ungranted origin: denied, fetch never called ─────────────────────
  it('(d) optional runtime origin policy can reject before fetch', async () => {
    const opts = makeOpts(originPolicy());
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
    const err = sent[0] as { type: string; id: string; error: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.id).toBe('r1');
    expect(err.error).toBe('blocked-by-policy');
  });

  // ─── (e) runtime resolver: fetch called, bytes.result emitted ────────────
  it('(e) resource.bytes delegates to the runtime resolver and emits bytes.result', async () => {
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
    expect(calledInit.headers).toBeUndefined();
    expect(calledInit.signal).toBeInstanceOf(AbortSignal);

    expect(sent).toHaveLength(1);
    const result = sent[0] as { type: string; id: string; blob: Blob; mime: string; requestId?: string; headers?: unknown; bodyBase64?: string };
    expect(result.type).toBe('resource.bytes.result');
    expect(result.id).toBe('r2');
    expect(result.mime).toBe('text/plain');
    expect(await result.blob.text()).toBe(bodyText);
    expect(result).not.toHaveProperty('requestId');
    expect(result).not.toHaveProperty('headers');
    expect(result).not.toHaveProperty('bodyBase64');
  });

  // ─── (f) resource.cancel drops the late terminal envelope ────────────────
  it('(f) resource.cancel aborts its window-scoped request and emits no terminal envelope', async () => {
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
    expect(sent).toHaveLength(0);
  });

  // ─── (g) invalid URL → bytes.error invalid-request ───────────────────────
  it('(g) invalid URL emits invalid-request; fetch NOT called', async () => {
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
    const err = sent[0] as { type: string; error: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.error).toBe('invalid-request');
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
    const err = sent[0] as { type: string; error: string };
    expect(err.type).toBe('resource.bytes.error');
    expect(err.error).toBe('network-error');
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

  // ─── (j) resource.info current fields ────────────────────────────────────
  it('(j) resource.info emits advisory runtime info', async () => {
    const opts = makeOpts({
      resourceInfo: {
        schemes: [
          { scheme: 'https', enabled: true },
          { scheme: 'blossom', enabled: false },
        ],
        maxBytes: 1024,
        maxUrls: 8,
        maxServers: 4,
      },
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.info',
      id: 'info-1',
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        type: 'resource.info.result',
        id: 'info-1',
        info: {
          schemes: [
            { scheme: 'https', enabled: true },
            { scheme: 'blossom', enabled: false },
          ],
          maxBytes: 1024,
          maxUrls: 8,
          maxServers: 4,
        },
      },
    ]);
  });

  // ─── (k) resource.info provider failure ──────────────────────────────────
  it('(k) resource.info provider failures emit resource.info.error', async () => {
    const opts = makeOpts({
      resourceInfo: () => {
        throw new Error('policy unavailable');
      },
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.info',
      id: 'info-fail',
    } as NappletMessage, send);

    await flushPromises();

    expect(sent).toEqual([
      {
        type: 'resource.info.error',
        id: 'info-fail',
        error: 'unavailable',
        message: 'policy unavailable',
      },
    ]);
  });

  // ─── (l) resource.bytes current fields ───────────────────────────────────
  it('(l) resource.bytes emits id, blob, and mime for current NAP-RESOURCE callers', async () => {
    const bodyText = 'current resource payload';
    const opts = makeOpts({
      fetch: vi.fn(async () => {
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
      id: 'current-1',
      url: `${GRANTED_ORIGIN}/current`,
    } as NappletMessage, send);

    await flushPromises();

    expect(sent).toHaveLength(1);
    const result = sent[0] as {
      type: string;
      id: string;
      blob: Blob;
      mime: string;
      requestId?: string;
      bodyBase64?: string;
    };
    expect(result.type).toBe('resource.bytes.result');
    expect(result.id).toBe('current-1');
    expect(result.mime).toBe('text/plain');
    expect(await result.blob.text()).toBe(bodyText);
    expect(result.requestId).toBeUndefined();
    expect(result.bodyBase64).toBeUndefined();
  });

  // ─── (m) resource.bytesMany ordered partial result ───────────────────────
  it('(m) resource.bytesMany preserves input order and keeps per-URL failures local', async () => {
    const opts = makeOpts({
      ...originPolicy(),
      fetch: vi.fn(async (url: string) => {
        return new Response(url.endsWith('/one') ? 'first' : 'third', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }),
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytesMany',
      id: 'bulk-1',
      requests: [
        { url: `${GRANTED_ORIGIN}/one` },
        { url: `${DENIED_ORIGIN}/two` },
        { url: `${GRANTED_ORIGIN}/three` },
      ],
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).toHaveBeenCalledTimes(2);
    expect(sent).toHaveLength(1);
    const result = sent[0] as {
      type: string;
      id: string;
      items: Array<{
        url: string;
        ok: boolean;
        blob?: Blob;
        mime?: string;
        error?: string;
        message?: string;
      }>;
    };
    expect(result.type).toBe('resource.bytesMany.result');
    expect(result.id).toBe('bulk-1');
    expect(result.items.map((item) => item.url)).toEqual([
      `${GRANTED_ORIGIN}/one`,
      `${DENIED_ORIGIN}/two`,
      `${GRANTED_ORIGIN}/three`,
    ]);
    expect(result.items[0]?.ok).toBe(true);
    expect(result.items[0]?.mime).toBe('text/plain');
    expect(await result.items[0]?.blob?.text()).toBe('first');
    expect(result.items[1]).toMatchObject({
      ok: false,
      error: 'blocked-by-policy',
    });
    expect(result.items[1]?.blob).toBeUndefined();
    expect(result.items[2]?.ok).toBe(true);
    expect(await result.items[2]?.blob?.text()).toBe('third');
  });

  // ─── (n) resource.bytesMany invalid top-level request ────────────────────
  it('(n) resource.bytesMany with empty requests emits a top-level invalid-request error', async () => {
    const opts = makeOpts();
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytesMany',
      id: 'bulk-empty',
      requests: [],
    } as NappletMessage, send);

    await flushPromises();

    expect(opts.fetch).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'resource.bytesMany.error',
      id: 'bulk-empty',
      error: 'invalid-request',
    });
  });

  it('(o) carries per-resource Blossom server hints and ignores them for other schemes', async () => {
    const opts = makeOpts({
      fetch: vi.fn(async () => new Response('hinted', {
        headers: { 'content-type': 'text/plain' },
      })),
    });
    const svc = createResourceService(opts);
    const single = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      id: 'hint-single',
      url: `blossom:sha256:${'a'.repeat(64)}`,
      servers: ['https://one.example', 'https://two.example'],
    } as NappletMessage, single.send);
    await flushPromises();

    expect(opts.fetch).toHaveBeenNthCalledWith(1, `blossom:sha256:${'a'.repeat(64)}`, expect.objectContaining({
      servers: ['https://one.example', 'https://two.example'],
    }));
    expect(single.sent[0]).toMatchObject({ type: 'resource.bytes.result', id: 'hint-single' });

    const bulk = collectSent();
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytesMany',
      id: 'hint-bulk',
      requests: [
        { url: `blossom:sha256:${'b'.repeat(64)}`, servers: ['https://bulk.example'] },
        { url: 'https://media.example/image.png', servers: ['https://ignored.example'] },
      ],
    } as NappletMessage, bulk.send);
    await flushPromises();

    expect(opts.fetch).toHaveBeenNthCalledWith(2, `blossom:sha256:${'b'.repeat(64)}`, expect.objectContaining({
      servers: ['https://bulk.example'],
    }));
    expect(opts.fetch).toHaveBeenNthCalledWith(3, 'https://media.example/image.png', expect.not.objectContaining({
      servers: expect.anything(),
    }));
    expect(bulk.sent[0]).toMatchObject({ type: 'resource.bytesMany.result', id: 'hint-bulk' });
  });

  it('keeps resource.info scheme disclosure advisory instead of authorizing fetches', async () => {
    const opts = makeOpts({
      resourceInfo: { schemes: [{ scheme: 'http', enabled: true }] },
      fetch: vi.fn(async () => new Response('runtime-resolved', {
        headers: { 'content-type': 'text/plain' },
      })),
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      id: 'scheme-off',
      url: 'https://example.com/image.png',
    } as NappletMessage, send);
    await flushPromises();

    expect(opts.fetch).toHaveBeenCalledOnce();
    expect(sent[0]).toMatchObject({
      type: 'resource.bytes.result',
      id: 'scheme-off',
      mime: 'text/plain',
    });
  });

  it('preserves a runtime resolver unsupported-scheme decision', async () => {
    const opts = makeOpts({
      resourceInfo: { schemes: [{ scheme: 'https', enabled: true }] },
      fetch: vi.fn(async () => {
        throw new ResourceServiceError('unsupported-scheme', 'runtime does not resolve https:');
      }),
    });
    const svc = createResourceService(opts);
    const { sent, send } = collectSent();

    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      id: 'runtime-policy',
      url: 'https://example.com/image.png',
    } as NappletMessage, send);
    await flushPromises();

    expect(sent[0]).toMatchObject({
      type: 'resource.bytes.error',
      id: 'runtime-policy',
      error: 'unsupported-scheme',
      message: 'runtime does not resolve https:',
    });
  });

  it('enforces disclosed response and bulk caps', async () => {
    const opts = makeOpts({
      resourceInfo: {
        schemes: [{ scheme: 'http', enabled: true }],
        maxBytes: 3,
        maxUrls: 1,
      },
      fetch: vi.fn(async () => new Response('four', {
        headers: { 'content-type': 'text/plain' },
      })),
    });
    const svc = createResourceService(opts);
    const single = collectSent();
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytes',
      id: 'too-big',
      url: `${GRANTED_ORIGIN}/large`,
    } as NappletMessage, single.send);
    await flushPromises();
    expect(single.sent[0]).toMatchObject({ error: 'too-large' });

    const bulk = collectSent();
    svc.handleMessage(WINDOW_ID, {
      type: 'resource.bytesMany',
      id: 'too-many',
      requests: [{ url: `${GRANTED_ORIGIN}/one` }, { url: `${GRANTED_ORIGIN}/two` }],
    } as NappletMessage, bulk.send);
    await flushPromises();
    expect(bulk.sent[0]).toMatchObject({
      type: 'resource.bytesMany.error',
      error: 'too-large',
    });
  });

});
