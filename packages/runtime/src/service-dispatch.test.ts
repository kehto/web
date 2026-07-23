import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { routeServiceMessage } from './service-dispatch.js';
import type { ServiceHandler, ServiceRegistry } from './types.js';

const WINDOW_ID = 'window-1';

function createService(name: string): ServiceHandler {
  return {
    descriptor: { name, version: '1.0.0' },
    handleMessage: vi.fn(),
  };
}

function route(message: NappletMessage, services: ServiceRegistry): boolean {
  return routeServiceMessage(WINDOW_ID, message, services, vi.fn());
}

describe('routeServiceMessage', () => {
  it('routes a direct notify message to the exact registered notify domain', () => {
    const notify = createService('notify');
    const message = { type: 'notify.create', id: 'notification-1' } as NappletMessage;

    expect(route(message, { notify })).toBe(true);
    expect(notify.handleMessage).toHaveBeenCalledWith(WINDOW_ID, message, expect.any(Function));
  });

  it.each([
    'notifications:push',
    'audio:play',
    'notify.create',
    'notify.create?priority=high',
    'napplet:profile/open?pubkey=abc',
  ])('keeps the prefix-like INC topic %s opaque to generic services', (topic) => {
    const notify = createService('notify');
    const notifications = createService('notifications');
    const audio = createService('audio');
    const message = { type: 'inc.emit', topic, payload: { value: true } } as NappletMessage;

    expect(route(message, { notify, notifications, audio })).toBe(false);
    expect(notify.handleMessage).not.toHaveBeenCalled();
    expect(notifications.handleMessage).not.toHaveBeenCalled();
    expect(audio.handleMessage).not.toHaveBeenCalled();
  });

  it('does not delegate inc.emit to a generic inc service', () => {
    const inc = createService('inc');
    const message = { type: 'inc.emit', topic: 'napplet:profile/open' } as NappletMessage;

    expect(route(message, { inc })).toBe(false);
    expect(inc.handleMessage).not.toHaveBeenCalled();
  });

  it('returns no handler for an unknown direct message domain', () => {
    const notify = createService('notify');

    expect(route({ type: 'unknown.create' } as NappletMessage, { notify })).toBe(false);
    expect(notify.handleMessage).not.toHaveBeenCalled();
  });
});
