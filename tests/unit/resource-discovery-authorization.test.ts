import { afterEach, expect, it, vi } from 'vitest';
import { createRuntime } from '@kehto/runtime';
import { createResourceService } from '@kehto/services';
import type { OutboxRouter, ResourceServiceOptions } from '@kehto/services';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';
import { createPajaResourceFetch } from '../../packages/paja/src/browser-resource.js';
import { createPajaBlossomEventResolver } from '../../packages/paja/src/browser-blossom-events.js';

const dispose: Array<() => void> = [];
afterEach(() => { for (const close of dispose.splice(0)) close(); });

async function deniedNetwork(fetch: ResourceServiceOptions['fetch'], url: string, allowNetwork = false) {
  const adapter = createMockRuntimeAdapter({
    services: { resource: createResourceService({ fetch }) }, isDomainAllowed: () => true,
    permissions: {
      now: () => 0, createCancellation: () => new AbortController(),
      schedule: (callback, delay) => {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      prompt: async ({ request }) => ({
        effect: !allowNetwork && request.requirements.some((item) => item.category === 'network') ? 'deny' : 'allow',
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
it.each(['ws://relay.example', 'wss://relay.example'])('denies resolver transport to %s before its callback executes', async (destination) => {
  const transport = vi.fn(async () => new Response('unexpected bytes'));
  const sent = await deniedNetwork(async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    return init.authorizeNetwork(destination, transport);
  }, 'blossom:' + 'b'.repeat(64));
  expect(transport).not.toHaveBeenCalled();
  expect(sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'discovery', error: 'blocked-by-policy',
  });
});

it('executes an approved WebSocket resolver callback once', async () => {
  const transport = vi.fn(async () => new Response('approved bytes'));
  const sent = await deniedNetwork(async (_url, init) => {
    if (!init.authorizeNetwork) throw new Error('network approval missing');
    return init.authorizeNetwork('wss://relay.example', transport);
  }, 'blossom:' + 'b'.repeat(64), true);
  expect(transport).toHaveBeenCalledOnce();
  expect(sent[0]?.message).toMatchObject({
    type: 'resource.bytes.result', id: 'discovery', blob: btoa('approved bytes'),
  });
});

it.each(['ftp://relay.example', 'data:text/plain,bytes', 'wss://user:secret@relay.example'])(
  'rejects invalid network destination %s without executing transport', async (destination) => {
    const transport = vi.fn(async () => new Response('unexpected bytes'));
    const sent = await deniedNetwork(async (_url, init) => {
      if (!init.authorizeNetwork) throw new Error('network approval missing');
      return init.authorizeNetwork(destination, transport);
    }, 'blossom:' + 'b'.repeat(64), true);
    expect(transport).not.toHaveBeenCalled();
    expect(sent[0]?.message).toMatchObject({
      type: 'resource.bytes.error', id: 'discovery', error: 'blocked-by-policy',
    });
  },
);

it('denies Blossom discovery relay queries before reading publisher server lists', async () => {
  const query = vi.fn(async () => ({ events: [] }));
  const router: OutboxRouter = {
    query,
    subscribe: () => ({ close() {} }),
    publish: async () => ({ ok: true }),
    resolveRelays: async () => ({ relays: ['wss://relay.example'], source: 'fallback' }),
  };
  const resolver = createPajaBlossomEventResolver({
    baseRouter: router,
    getConfiguredServers: () => ['https://blossom.example'],
    discoverServerList: async (_pubkey, context) => context.authorizeNetwork(
      'wss://relay.example',
      async () => {
        await query();
        return { events: [] };
      },
    ),
  });
  const transport = vi.fn<typeof fetch>();
  const resourceFetch = createPajaResourceFetch({
    getBlossomServers: ({ url, windowId, signal, authorizeNetwork }) => resolver.getServers(
      url, windowId, { signal, authorizeNetwork },
    ),
    fetch: transport,
  });
  const sent = await deniedNetwork(resourceFetch, `blossom:${'b'.repeat(64)}?as=${'c'.repeat(64)}`);
  expect(query).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
  expect(sent[0]?.message).toMatchObject({
    type: 'resource.bytes.error', id: 'discovery', error: 'blocked-by-policy',
  });
});
