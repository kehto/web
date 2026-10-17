import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import type { ApprovalAnswer, ApprovalPrompt } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import type { ResourceServiceOptions } from '@kehto/services';
import type { NappletMessage } from '@napplet/core';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); vi.restoreAllMocks(); });

async function fixture(prompt: (prompt: ApprovalPrompt) => Promise<ApprovalAnswer>,
  fetch: ResourceServiceOptions['fetch'] = vi.fn(async (url, init) => init.authorizeNetwork
    ? init.authorizeNetwork(url, async () => new Response('bytes', { headers: { 'content-type': 'application/octet-stream' } }))
    : new Response('bytes', { headers: { 'content-type': 'application/octet-stream' } }))) {
  const service = createResourceService({ fetch });
  const adapter = createMockRuntimeAdapter({ services: { resource: service }, isDomainAllowed: () => true,
    permissions: { now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); },
      prompt: (value) => value.request.requirements.every((item) => item.category === 'interface')
        ? Promise.resolve({ effect: 'allow', lifetime: 'session' }) : prompt(value),
    },
  });
  const runtime = createRuntime(adapter.hooks);
  dispose.push(() => runtime.destroy());
  runtime.sessionRegistry.register('w', { ...createNip5dSessionEntry('w', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) } });
  await runtime.permissions!.admit('w', { required: ['resource'], optional: [], available: ['resource'] });
  return { runtime, fetch, sent: adapter.sent, send: (message: unknown) => runtime.handleMessage('w', message) };
}

describe('resource service runtime approvals', () => {
  it('retains revocation control until the response body finishes', async () => {
    const body = deferred<ArrayBuffer>();
    const started = deferred<void>();
    const response = new Response('bytes');
    vi.spyOn(response, 'arrayBuffer').mockImplementation(() => { started.resolve(); return body.promise; });
    let signal!: AbortSignal;
    const f = await fixture(async () => ({ effect: 'allow', lifetime: 'session' }), vi.fn(async (_url, init) => {
      signal = init.signal; return response;
    }));
    f.send({ type: 'resource.bytes', id: 'one', url: 'https://example.com/a' });
    await started.promise;
    const grant = f.runtime.permissions!.grants.find((item) => item.permission.category === 'resource')!;
    f.runtime.permissions!.revoke(grant.id);
    expect(signal.aborted).toBe(true);
    await flush();
    expect(f.sent.at(-1)?.message).toMatchObject({ type: 'resource.bytes.error', id: 'one', error: 'blocked-by-policy' });
    const count = f.sent.length;
    body.resolve(new ArrayBuffer(1));
    await flush();
    expect(f.sent).toHaveLength(count);
  });

  it('warns once when the retained resolver-only path is actually used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = vi.fn(async () => new Response('bytes'));
    const service = createResourceService({ fetch });
    const send = vi.fn();
    expect(warn).not.toHaveBeenCalled();
    for (const id of ['one', 'two']) {
      service.handleMessage('w', { type: 'resource.bytes', id, url: 'https://example.com/a' } as NappletMessage, send);
      await flush();
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('FW-RESOURCE-LEGACY-001');
    expect(warn.mock.calls[0][0]).toContain('RuntimeAdapter.permissions');
    expect(warn.mock.calls[0][0]).toContain('once per service instance');
  });

  it('holds fetch for the exact resource scope before each resolver network scope', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = await fixture((value) => { shown.resolve(value); return answer.promise; });
    f.send({ type: 'resource.bytes', id: 'one', url: 'https://example.com/a?x=1' });
    const prompt = await shown.promise;
    expect(f.fetch).not.toHaveBeenCalled();
    expect(prompt.missing).toEqual([
      { category: 'resource', domain: 'resource', operation: 'resource.bytes', scope: { kind: 'exact', value: 'https://example.com/a?x=1' } },
    ]);
    answer.resolve({ effect: 'allow', lifetime: 'once' });
    await flush();
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.sent.at(-1)?.message).toMatchObject({ type: 'resource.bytes.result', id: 'one' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('cancels the pending prompt and ignores its late grant', async () => {
    const answer = deferred<ApprovalAnswer>();
    const shown = deferred<ApprovalPrompt>();
    const f = await fixture((value) => { shown.resolve(value); return answer.promise; });
    f.send({ type: 'resource.bytes', id: 'one', url: 'https://example.com/a' });
    const prompt = await shown.promise;
    f.send({ type: 'resource.cancel', id: 'one' });
    expect(prompt.signal.aborted).toBe(true);
    answer.resolve({ effect: 'allow', lifetime: 'session' });
    await flush();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.sent).toEqual([]);
    expect(f.runtime.permissions!.grants.every((grant) => grant.permission.category === 'interface')).toBe(true);
  });

  it('preserves successful bulk siblings when a resource is denied', async () => {
    const f = await fixture(async (value) => ({ effect: value.request.requirements.some((item) => item.scope.value.endsWith('/deny')) ? 'deny' : 'allow', lifetime: 'once' }));
    f.send({ type: 'resource.bytesMany', id: 'bulk', urls: [
      'https://example.com/deny', 'https://example.com/allow',
    ] });
    await flush();
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.sent.at(-1)?.message).toMatchObject({ type: 'resource.bytesMany.result', id: 'bulk', items: [
      { url: 'https://example.com/deny', ok: false, error: 'blocked-by-policy' },
      { url: 'https://example.com/allow', ok: true },
    ] });
  });
});
