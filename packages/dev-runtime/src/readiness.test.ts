import { describe, expect, it } from 'vitest';
import { ReadinessError, waitForTargetUrl, type ReadinessFetch } from './readiness.js';

describe('@kehto/dev-runtime readiness', () => {
  it('returns when the target URL responds below 500', async () => {
    const calls: string[] = [];
    const fetcher: ReadinessFetch = async (url) => {
      calls.push(url);
      return { status: 404 };
    };

    await waitForTargetUrl('http://127.0.0.1:5173/app', {
      timeoutMs: 1000,
      fetch: fetcher,
      sleep: async () => undefined,
      now: () => 0,
    });

    expect(calls).toEqual(['http://127.0.0.1:5173/app']);
  });

  it('retries rejected fetches until a later response succeeds', async () => {
    let attempt = 0;
    let clock = 0;
    const fetcher: ReadinessFetch = async () => {
      attempt += 1;
      if (attempt < 3) throw new Error('connection refused');
      return { status: 200 };
    };

    await waitForTargetUrl('http://127.0.0.1:5173', {
      timeoutMs: 1000,
      intervalMs: 10,
      fetch: fetcher,
      sleep: async (ms) => { clock += ms; },
      now: () => clock,
    });

    expect(attempt).toBe(3);
  });

  it('throws a clear timeout error when the target never responds', async () => {
    let clock = 0;
    await expect(waitForTargetUrl('http://127.0.0.1:5173', {
      timeoutMs: 20,
      intervalMs: 10,
      fetch: async () => { throw new Error('offline'); },
      sleep: async (ms) => { clock += ms; },
      now: () => clock,
    })).rejects.toThrow(ReadinessError);
  });
});
