import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); vi.restoreAllMocks(); });

// NAP-RESOURCE ae5b9c64 defines complete-byte delivery and canonical errors.
// Retaining network authority through body consumption is Kehto host policy.
it('revoking the network grant aborts a resource body after headers without a late result', async () => {
  const body = deferred<ArrayBuffer>();
  const reading = deferred<void>();
  const response = new Response('pending body');
  vi.spyOn(response, 'arrayBuffer').mockImplementation(() => { reading.resolve(); return body.promise; });
  let networkSignal: AbortSignal | undefined;
  const service = createResourceService({
    fetch: async (url, init) => {
      if (!init.authorizeNetwork) throw new Error('network approval missing');
      return init.authorizeNetwork(url, async (signal) => {
        networkSignal = signal;
        return response;
      });
    },
  });
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
  runtime.handleMessage('w', { type: 'resource.bytes', id: 'network-body', url: 'https://example.com/data' });
  await reading.promise;
  const networkGrant = runtime.permissions!.grants.find((grant) => grant.permission.category === 'network');
  expect(networkGrant).toBeDefined();
  expect(networkSignal?.aborted).toBe(false);
  runtime.permissions!.revoke(networkGrant!.id);
  try {
    expect(networkSignal?.aborted).toBe(true);
    await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
    expect(adapter.sent[0]?.message).toMatchObject({
      type: 'resource.bytes.error', id: 'network-body', error: 'blocked-by-policy',
    });
  } finally {
    body.resolve(new TextEncoder().encode('late bytes').buffer);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(adapter.sent).toHaveLength(1);
  expect(adapter.sent.some(({ message }) => message.type === 'resource.bytes.result')).toBe(false);
});
