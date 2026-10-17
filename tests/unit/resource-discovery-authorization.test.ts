import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import type { OutboxRouter, ResourceServiceOptions } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import { createPajaResourceFetch } from '../../packages/paja/src/browser-resource.js';
import { createPajaBlossomEventResolver } from '../../packages/paja/src/browser-blossom-events.js';

const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

async function deniedNetwork(fetch: ResourceServiceOptions['fetch'], url: string) {
  const adapter = createMockRuntimeAdapter({
    services: { resource: createResourceService({ fetch }) }, isDomainAllowed: () => true,
    permissions: {
      now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      prompt: async ({ request }) => ({
        effect: request.requirements.some((item) => item.category === 'network') ? 'deny' : 'allow',
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
  runtime.handleMessage('w', { type: 'resource.bytes', id: 'discovery', url });
  await vi.waitFor(() => expect(adapter.sent).toHaveLength(1));
  return adapter.sent;
}

// NAP-RESOURCE ae5b9c64: resolution remains runtime policy-controlled. The
// Phase 113 contract includes actual discovery relay destinations in that policy.
it('denies WebSocket resolver transport before its callback executes', async () => {
  const transport = vi.fn(async () => new Response('unexpected bytes'));
  const sent = await deniedNetwork(async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    return init.authorizeNetwork('wss://relay.example', transport);
  }, 'blossom:' + 'b'.repeat(64));
  expect(transport).not.toHaveBeenCalled();
  expect(sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'discovery', error: 'blocked-by-policy',
  });
});

it('denies Blossom discovery relay queries before reading publisher server lists', async () => {
  const query = vi.fn(async () => ({ events: [] }));
  const router: OutboxRouter = {
    query,
    subscribe: () => ({ close() {} }),
    publish: async () => ({ ok: true }),
    resolveRelays: async () => ({ relays: ['wss://relay.example'], source: 'fallback' }),
  };
  const resolver = createPajaBlossomEventResolver({
    baseRouter: router, getConfiguredServers: () => ['https://blossom.example'],
  });
  const transport = vi.fn<typeof fetch>();
  const resourceFetch = createPajaResourceFetch({
    getBlossomServers: ({ url, windowId }) => resolver.getServers(url, windowId),
    fetch: transport,
  });
  const sent = await deniedNetwork(resourceFetch, `blossom:${'b'.repeat(64)}?as=${'c'.repeat(64)}`);
  expect(query).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
  expect(sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'discovery', error: 'blocked-by-policy',
  });
});
