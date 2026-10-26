import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostFetch } from '../../apps/playground/src/demo-hooks.js';

describe('playground resource deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps a timed-out request aborted when network approval arrives later', async () => {
    vi.useFakeTimers();
    const fetchResource = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Response('late fetch');
    });
    vi.stubGlobal('fetch', fetchResource);
    let approve!: () => void;
    const approval = new Promise<void>((resolve) => { approve = resolve; });
    const result = hostFetch('https://assets.example/data', {
      signal: new AbortController().signal,
      authorizeNetwork: async (_url, action) => {
        await approval;
        return action(new AbortController().signal);
      },
    });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchResource).not.toHaveBeenCalled();
    approve();
    await rejected;
  });

  it.each(['request', 'network'])('honors an already aborted %s signal', async (which) => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Response('unexpected fetch');
    }));
    await expect(hostFetch('https://assets.example/data', {
      signal: which === 'request' ? controller.signal : new AbortController().signal,
      authorizeNetwork: async (_url, action) => action(
        which === 'network' ? controller.signal : new AbortController().signal,
      ),
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
