import { describe, expect, it, vi } from 'vitest';
import {
  createFeedIdentityEventController,
  type FeedIdentityReader,
} from '../../apps/playground/napplets/feed/src/feed-identity-events.js';

const PUBKEY = 'f'.repeat(64);
const OTHER_PUBKEY = 'e'.repeat(64);

class FakeMessageTarget {
  listeners = new Set<(event: MessageEvent) => void>();

  addEventListener(type: string, listener: EventListener): void {
    if (type === 'message') this.listeners.add(listener as (event: MessageEvent) => void);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (type === 'message') this.listeners.delete(listener as (event: MessageEvent) => void);
  }

  dispatch(data: unknown, source = 'parent'): void {
    const event = { data, source } as unknown as MessageEvent;
    for (const listener of [...this.listeners]) listener(event);
  }
}

describe('playground feed identity event controller', () => {
  it('takes one initial snapshot and then subscribes when identity.changed arrives', async () => {
    const readPublicKey = vi.fn(async () => '');
    const target = new FakeMessageTarget();
    const onLoggedOut = vi.fn();
    const onPubkey = vi.fn();
    const onError = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey,
      eventTarget: target as unknown as Window,
      acceptMessage: (event) => event.source === 'parent',
      onLoggedOut,
      onPubkey,
      onError,
    });

    await controller.start();

    expect(readPublicKey).toHaveBeenCalledTimes(1);
    expect(onLoggedOut).toHaveBeenCalledOnce();
    expect(onPubkey).not.toHaveBeenCalled();

    target.dispatch({ type: 'identity.changed', pubkey: PUBKEY });

    expect(readPublicKey).toHaveBeenCalledTimes(1);
    expect(onPubkey).toHaveBeenCalledWith(PUBKEY);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reacts to pubkey changes and signed-out pushes without polling', async () => {
    const target = new FakeMessageTarget();
    const onLoggedOut = vi.fn();
    const onPubkey = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey: vi.fn(async () => PUBKEY),
      eventTarget: target as unknown as Window,
      acceptMessage: (event) => event.source === 'parent',
      onLoggedOut,
      onPubkey,
      onError: vi.fn(),
    });

    await controller.start();
    target.dispatch({ type: 'identity.changed', pubkey: PUBKEY });
    target.dispatch({ type: 'identity.changed', pubkey: OTHER_PUBKEY });
    target.dispatch({ type: 'identity.changed', pubkey: '' });
    target.dispatch({ type: 'identity.changed', pubkey: '' });

    expect(onPubkey).toHaveBeenCalledTimes(2);
    expect(onPubkey).toHaveBeenNthCalledWith(1, PUBKEY);
    expect(onPubkey).toHaveBeenNthCalledWith(2, OTHER_PUBKEY);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });

  it('ignores non-parent or malformed messages and removes its listener on stop', async () => {
    const target = new FakeMessageTarget();
    const onPubkey = vi.fn();
    const controller = createFeedIdentityEventController({
      readPublicKey: vi.fn(async () => ''),
      eventTarget: target as unknown as Window,
      acceptMessage: (event) => event.source === 'parent',
      onLoggedOut: vi.fn(),
      onPubkey,
      onError: vi.fn(),
    });

    await controller.start();
    target.dispatch({ type: 'identity.changed', pubkey: PUBKEY }, 'other');
    target.dispatch({ type: 'identity.changed' });
    target.dispatch({ type: 'theme.changed', pubkey: PUBKEY });

    expect(onPubkey).not.toHaveBeenCalled();

    controller.stop();
    target.dispatch({ type: 'identity.changed', pubkey: PUBKEY });

    expect(onPubkey).not.toHaveBeenCalled();
    expect(target.listeners.size).toBe(0);
  });
});
