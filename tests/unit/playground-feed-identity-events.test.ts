import { describe, expect, it, vi } from 'vitest';
import {
  createFeedIdentityEventController,
  type FeedIdentityReader,
  type FeedIdentitySubscriber,
} from '../../apps/playground/napplets/feed/src/feed-identity-events.js';

const PUBKEY = 'f'.repeat(64);
const OTHER_PUBKEY = 'e'.repeat(64);

class FakeIdentitySubscriber {
  handler: ((pubkey: string) => void) | null = null;
  close = vi.fn(() => {
    this.handler = null;
  });

  subscribe: FeedIdentitySubscriber = (handler) => {
    this.handler = handler;
    return { close: this.close };
  };

  push(pubkey: string): void {
    this.handler?.(pubkey);
  }
}

describe('playground feed identity event controller', () => {
  it('takes one initial snapshot and then subscribes when identity.changed arrives', async () => {
    const readPublicKey = vi.fn(async () => '');
    const changes = new FakeIdentitySubscriber();
    const onLoggedOut = vi.fn();
    const onPubkey = vi.fn();
    const onError = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey,
      subscribeToChanges: changes.subscribe,
      onLoggedOut,
      onPubkey,
      onError,
    });

    await controller.start();

    expect(readPublicKey).toHaveBeenCalledTimes(1);
    expect(onLoggedOut).toHaveBeenCalledOnce();
    expect(onPubkey).not.toHaveBeenCalled();

    changes.push(PUBKEY);

    expect(readPublicKey).toHaveBeenCalledTimes(1);
    expect(onPubkey).toHaveBeenCalledWith(PUBKEY);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reacts to pubkey changes and signed-out pushes without polling', async () => {
    const changes = new FakeIdentitySubscriber();
    const onLoggedOut = vi.fn();
    const onPubkey = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey: vi.fn(async () => PUBKEY),
      subscribeToChanges: changes.subscribe,
      onLoggedOut,
      onPubkey,
      onError: vi.fn(),
    });

    await controller.start();
    changes.push(PUBKEY);
    changes.push(OTHER_PUBKEY);
    changes.push('');
    changes.push('');

    expect(onPubkey).toHaveBeenCalledTimes(2);
    expect(onPubkey).toHaveBeenNthCalledWith(1, PUBKEY);
    expect(onPubkey).toHaveBeenNthCalledWith(2, OTHER_PUBKEY);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });

  it('closes the identity change subscription on stop', async () => {
    const changes = new FakeIdentitySubscriber();
    const onPubkey = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey: vi.fn(async () => ''),
      subscribeToChanges: changes.subscribe,
      onLoggedOut: vi.fn(),
      onPubkey,
      onError: vi.fn(),
    });

    await controller.start();
    controller.stop();
    changes.push(PUBKEY);

    expect(changes.close).toHaveBeenCalledOnce();
    expect(onPubkey).not.toHaveBeenCalled();
  });
});
