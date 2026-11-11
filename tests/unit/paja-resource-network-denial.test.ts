import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import { createPajaResourceFetch } from '../../packages/paja/src/browser-resource.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
};

const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

// NAP-RESOURCE ae5b9c64: policy rejection retains the canonical error field.
it.each(['https://cdn.example/file', `blossom:${'a'.repeat(64)}`])(
  'reports denied Paja network access as blocked-by-policy for %s', async (url) => {
    const transport = vi.fn(async () => new Response('unexpected transport'));
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
        prompt: async (prompt) => ({
          effect: prompt.request.requirements.some((item) => item.category === 'network') ? 'deny' : 'allow',
          lifetime: 'session',
        }),
      },
    });
    const runtime = createRuntime(adapter.hooks);
    dispose.push(() => runtime.destroy());
    runtime.sessionRegistry.register('w', {
      ...createNip5dSessionEntry('w', 'app', 'a'.repeat(64)),
      permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
    });
    await runtime.permissions!.admit('w', { required: ['resource'], optional: [], available: ['resource'] });
    runtime.handleMessage('w', { type: 'resource.bytes', id: 'denied-network', url });
    await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
    expect(transport).not.toHaveBeenCalled();
    expect(adapter.sent[0]?.message).toMatchObject({
      type: 'resource.bytes.error', id: 'denied-network', error: 'blocked-by-policy',
    });
  },
);

it('projects a rejected Paja transport without leaving an unhandled network approval', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const service = createResourceService({ fetch: createPajaResourceFetch({
      fetch: async () => { throw new Error('proxy transport unavailable'); },
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
    runtime.handleMessage('w', { type: 'resource.bytes', id: 'transport-rejection', url: 'https://cdn.example/file' });
    await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(adapter.sent[0]?.message).toMatchObject({
      type: 'resource.bytes.error', id: 'transport-rejection', error: 'network-error',
    });
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
