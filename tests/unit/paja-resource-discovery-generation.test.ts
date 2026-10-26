import { expect, it, vi } from 'vitest';
import type { OutboxResult, OutboxRouter } from '@kehto/services';
import { createPajaBlossomEventResolver } from '../../packages/paja/src/browser-blossom-events.js';

const author = 'a'.repeat(64);
const url = `blossom:${'b'.repeat(64)}?as=${author}`;

function serverList(server: string): OutboxResult {
  return { events: [{ event: {
    id: 'c'.repeat(64), pubkey: author, created_at: 1,
    kind: 10063, tags: [['server', server]], content: '', sig: 'd'.repeat(128),
  } }] };
}

// RESOURCE ae5b9c64 requires runtime-bound identity scope. A recycled window ID
// must not inherit cache entries written by a destroyed source's late lookup.
it('does not seed a replacement source cache from a late destroyed-source lookup', async () => {
  let release!: (result: OutboxResult) => void;
  const oldLookup = new Promise<OutboxResult>((resolve) => { release = resolve; });
  const query = vi.fn()
    .mockImplementationOnce(() => oldLookup)
    .mockResolvedValue(serverList('https://current.example'));
  const router: OutboxRouter = {
    query,
    subscribe: () => ({ close() {} }),
    publish: async () => ({ ok: true }),
    resolveRelays: async () => ({ relays: [], source: 'fallback' }),
  };
  const resolver = createPajaBlossomEventResolver({
    baseRouter: router, getConfiguredServers: () => [],
  });
  const first = resolver.getServers(url, 'reused-window');
  expect(query).toHaveBeenCalledOnce();
  resolver.clearWindow('reused-window');
  release(serverList('https://stale.example'));
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  expect(await resolver.getServers(url, 'reused-window')).toEqual(['https://current.example']);
  expect(query).toHaveBeenCalledTimes(2);
});
