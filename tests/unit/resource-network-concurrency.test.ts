import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import type { ApprovalAnswer } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

it('keeps concurrent same-origin resolver work behind network approval', async () => {
  const answer = deferred<ApprovalAnswer>();
  const shown = deferred<void>();
  const transport = vi.fn(async () => new Response('unexpected bytes'));
  const service = createResourceService({ fetch: async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    const responses = await Promise.all([
      init.authorizeNetwork('https://cdn.example/one', transport),
      init.authorizeNetwork('https://cdn.example/two', transport),
    ]);
    return responses[0]!;
  } });
  const adapter = createMockRuntimeAdapter({
    services: { resource: service }, isDomainAllowed: () => true,
    permissions: {
      now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      prompt: (prompt) => {
        if (prompt.request.requirements.some((item) => item.category === 'network')) {
          shown.resolve();
          return answer.promise;
        }
        return Promise.resolve({ effect: 'allow', lifetime: 'session' });
      },
    },
  });
  const runtime = createRuntime(adapter.hooks);
  dispose.push(() => runtime.destroy());
  runtime.sessionRegistry.register('w', {
    ...createNip5dSessionEntry('w', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
  });
  await runtime.permissions!.admit('w', { required: ['resource'], optional: [], available: ['resource'] });
  runtime.handleMessage('w', { type: 'resource.bytes', id: 'concurrent', url: 'https://cdn.example/resource' });
  await shown.promise;
  try {
    expect(transport).not.toHaveBeenCalled();
  } finally {
    answer.resolve({ effect: 'deny', lifetime: 'session' });
  }
  await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
  expect(transport).not.toHaveBeenCalled();
  expect(adapter.sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'concurrent', error: 'blocked-by-policy',
  });
});
