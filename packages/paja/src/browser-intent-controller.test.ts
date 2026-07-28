import { describe, expect, it, vi } from 'vitest';
import type { IntentDispatchParams } from '@kehto/services';
import { BrowserIntentController } from './browser-intent-controller.js';

function params(overrides: Partial<IntentDispatchParams> = {}): IntentDispatchParams {
  return {
    handler: 'profile-viewer',
    sender: 'social-feed',
    archetype: 'profile',
    action: 'open',
    convention: 'napplet:profile/open',
    payload: { pubkey: 'a'.repeat(64) },
    ...overrides,
  };
}

describe('BrowserIntentController', () => {
  it('waits for a current ready generation, sends once, and returns its window id', async () => {
    let releaseReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      releaseReady = resolve;
    });
    let dispatched: IntentDispatchParams | undefined;
    const openOrReuse = vi.fn((value: IntentDispatchParams) => {
      dispatched = value;
      return { id: 'generation-1' };
    });
    const send = vi.fn();
    const controller = new BrowserIntentController({
      openOrReuse,
      waitForReady: () => ready,
      isCurrent: () => true,
      getWindowId: () => 'window-1',
      send,
    });

    const result = controller.dispatch(params());
    expect(openOrReuse).toHaveBeenCalledOnce();
    expect(dispatched).toBeDefined();
    expect(Object.isFrozen(dispatched)).toBe(true);
    expect(Object.isFrozen(dispatched?.payload)).toBe(true);
    releaseReady();

    await expect(result).resolves.toEqual({ windowId: 'window-1' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('retries replaced generations and delivers only to the current one', async () => {
    const openOrReuse = vi.fn()
      .mockResolvedValueOnce({ id: 'generation-1' })
      .mockResolvedValueOnce({ id: 'generation-2' });
    const send = vi.fn();
    const controller = new BrowserIntentController({
      openOrReuse,
      waitForReady: vi.fn(),
      isCurrent: (generation) => generation.id === 'generation-2',
      getWindowId: () => 'window-2',
      send,
      maxAttempts: 2,
    });

    await expect(controller.dispatch(params())).resolves.toEqual({ windowId: 'window-2' });
    expect(openOrReuse).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      { id: 'generation-2' },
      expect.objectContaining({ convention: 'napplet:profile/open' }),
    );
  });

  it('rejects bounded terminal failures and reports the final reason', async () => {
    const onTerminal = vi.fn();
    const controller = new BrowserIntentController({
      openOrReuse: () => ({ id: 'stale' }),
      waitForReady: vi.fn(),
      isCurrent: () => false,
      getWindowId: () => null,
      send: vi.fn(),
      maxAttempts: 2,
      onTerminal,
    });

    await expect(controller.dispatch(params())).rejects.toThrow('no-current-target');
    expect(onTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ handler: 'profile-viewer' }),
      'no-current-target',
    );
  });

  it('rejects non-finite attempt limits and clamps finite values', async () => {
    const callbacks = {
      openOrReuse: vi.fn(() => null),
      waitForReady: () => undefined,
      isCurrent: () => false,
      getWindowId: () => null,
      send: () => undefined,
    };
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new BrowserIntentController({ ...callbacks, maxAttempts: value }))
        .toThrow('maxAttempts must be finite');
    }
    for (const [value, attempts] of [[0, 1], [-1, 1], [999, 10]] as const) {
      callbacks.openOrReuse.mockClear();
      const controller = new BrowserIntentController({ ...callbacks, maxAttempts: value });
      await expect(controller.dispatch(params())).rejects.toThrow('open-failed');
      expect(callbacks.openOrReuse).toHaveBeenCalledTimes(attempts);
    }
  });
});
