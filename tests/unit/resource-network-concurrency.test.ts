import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import type { ApprovalAnswer, ApprovalPrompt } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import type { ResourceServiceOptions } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

async function fixture(fetch: ResourceServiceOptions['fetch'], prompt: (value: ApprovalPrompt) => Promise<ApprovalAnswer>) {
  const adapter = createMockRuntimeAdapter({
    services: { resource: createResourceService({ fetch }) }, isDomainAllowed: () => true,
    permissions: {
      now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      prompt,
    },
  });
  const runtime = createRuntime(adapter.hooks);
  dispose.push(() => runtime.destroy());
  runtime.sessionRegistry.register('w', {
    ...createNip5dSessionEntry('w', 'app', 'a'.repeat(64)),
    permissionPrincipal: { kind: 'development', target: 'http://localhost:5173', artifactHash: 'a'.repeat(64) },
  });
  await runtime.permissions!.admit('w', { required: ['resource'], optional: [], available: ['resource'] });
  return { runtime, sent: adapter.sent, send: () => runtime.handleMessage('w', {
    type: 'resource.bytes', id: 'concurrent', url: 'https://cdn.example/resource',
  }) };
}

it('keeps concurrent same-origin resolver work behind network approval', async () => {
  const answer = deferred<ApprovalAnswer>();
  const shown = deferred<void>();
  const transport = vi.fn(async () => new Response('unexpected bytes'));
  const f = await fixture(async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    const responses = await Promise.all([
      init.authorizeNetwork('https://cdn.example/one', transport),
      init.authorizeNetwork('https://cdn.example/two', transport),
    ]);
    return responses[0]!;
  }, (prompt) => {
    if (prompt.request.requirements.some((item) => item.category === 'network')) {
      shown.resolve();
      return answer.promise;
    }
    return Promise.resolve({ effect: 'allow', lifetime: 'session' });
  });
  f.send();
  await shown.promise;
  try {
    expect(transport).not.toHaveBeenCalled();
  } finally {
    answer.resolve({ effect: 'deny', lifetime: 'session' });
  }
  await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  expect(transport).not.toHaveBeenCalled();
  expect(f.sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'concurrent', error: 'blocked-by-policy',
  });
});

it.each([false, true])('shares granted same-origin authority through pending resolver work (revoke=%s)', async (revoke) => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  let pendingSignal: AbortSignal | undefined;
  const prompt = vi.fn(async (): Promise<ApprovalAnswer> => ({ effect: 'allow', lifetime: 'session' }));
  const f = await fixture(async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    const responses = await Promise.all([
      init.authorizeNetwork('https://cdn.example/one', async () => new Response('first')),
      init.authorizeNetwork('https://cdn.example/two', async (signal) => {
        pendingSignal = signal;
        started.resolve();
        return pending.promise;
      }),
    ]);
    return responses[1]!;
  }, prompt);
  f.send();
  await started.promise;
  expect(pendingSignal?.aborted).toBe(false);
  expect(f.sent).toHaveLength(0);
  expect(prompt).toHaveBeenCalledTimes(3); // Interface, exact resource, one origin.
  try {
    if (revoke) {
      const grant = f.runtime.permissions!.grants.find((item) => item.permission.category === 'network');
      expect(grant).toBeDefined();
      f.runtime.permissions!.revoke(grant!.id);
      expect(pendingSignal?.aborted).toBe(true);
      await vi.waitFor(() => expect(f.sent).toHaveLength(1));
      expect(f.sent[0]?.message).toMatchObject({
        type: 'resource.bytes.error', id: 'concurrent', error: 'blocked-by-policy',
      });
    }
  } finally {
    pending.resolve(new Response('second'));
  }
  await vi.waitFor(() => expect(f.sent).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.sent).toHaveLength(1);
  if (!revoke) expect(f.sent[0]?.message).toMatchObject({
    type: 'resource.bytes.result', id: 'concurrent', blob: btoa('second'),
  });
  else expect(f.sent.some(({ message }) => message.type === 'resource.bytes.result')).toBe(false);
});
