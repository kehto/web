import { describe, expect, it, vi } from 'vitest';
import {
  createFeedIdentityController,
  type FeedIdentitySchedule,
} from '../../apps/playground/napplets/feed/src/feed-identity-controller.js';

const PUBKEY = 'f'.repeat(64);

describe('playground feed identity controller', () => {
  it('keeps retrying after an empty identity and subscribes when signer identity appears', async () => {
    const reads = ['', PUBKEY];
    const readPublicKey = vi.fn(async () => reads.shift() ?? PUBKEY);
    const onLoggedOut = vi.fn();
    const onPubkey = vi.fn();
    const onError = vi.fn();
    const scheduled: Array<() => Promise<void>> = [];
    const schedule: FeedIdentitySchedule<number> = (callback) => {
      scheduled.push(callback);
      return scheduled.length;
    };

    const controller = createFeedIdentityController({
      readPublicKey,
      onLoggedOut,
      onPubkey,
      onError,
      loggedOutRetryDelayMs: 1,
      connectedRefreshDelayMs: 2,
      schedule,
      cancel: () => {},
    });

    await controller.start();

    expect(readPublicKey).toHaveBeenCalledTimes(1);
    expect(onLoggedOut).toHaveBeenCalledOnce();
    expect(onPubkey).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    await scheduled[0]?.();

    expect(readPublicKey).toHaveBeenCalledTimes(2);
    expect(onPubkey).toHaveBeenCalledWith(PUBKEY);
    expect(onError).not.toHaveBeenCalled();
  });

  it('notifies logged-out only once for a continuous empty identity streak', async () => {
    const onLoggedOut = vi.fn();
    const scheduled: Array<() => Promise<void>> = [];

    const controller = createFeedIdentityController({
      readPublicKey: vi.fn(async () => ''),
      onLoggedOut,
      onPubkey: vi.fn(),
      onError: vi.fn(),
      schedule: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      cancel: () => {},
    });

    await controller.start();
    await scheduled[0]?.();

    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(2);
  });
});
