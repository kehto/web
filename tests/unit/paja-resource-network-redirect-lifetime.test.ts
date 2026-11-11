import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import { createPajaResourceFetch } from '../../packages/paja/src/browser-resource.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

// NAP-RESOURCE ae5b9c64 permits bounded redirects with per-hop checks.
it('follows a same-origin redirect while retaining network revocation control', async () => {
    const url = 'https://cdn.example/file';
    const transport = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 302, location: '/final' }), {
        headers: { 'x-kehto-resource-redirect': '1' },
      }))
      .mockResolvedValueOnce(new Response('redirected text'));
    const service = createResourceService({ fetch: createPajaResourceFetch({
      fetch: transport, getBlossomServers: () => ['https://cdn.example'],
    }) });
    const adapter = createMockRuntimeAdapter({
      services: { resource: service }, isDomainAllowed: () => true,
      permissions: {
        now: () => 0, createCancellation: () => new AbortController(),
        schedule: (callback, delay) => {
          const timer = setTimeout(callback, delay);
          return () => clearTimeout(timer);
        },
        prompt: async () => ({ effect: 'allow', lifetime: 'session' }),
      },
    });
    const runtime = createRuntime(adapter.hooks);
    dispose.push(() => runtime.destroy());
    runtime.sessionRegistry.register('w', {
      ...createNip5dSessionEntry('w', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
    });
    await runtime.permissions!.admit('w', { required: ['resource'], optional: [], available: ['resource'] });
    runtime.handleMessage('w', { type: 'resource.bytes', id: 'same-origin', url });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2), { timeout: 500 });
    await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
    expect(adapter.sent[0]?.message).toMatchObject({
      type: 'resource.bytes.result', id: 'same-origin', blob: btoa('redirected text'),
    });
  });
