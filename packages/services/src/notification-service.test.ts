/**
 * notification-service.test.ts — Unit tests for the direct notification service.
 */

import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createNotificationService } from './notification-service.js';

const WINDOW_ID = 'win-test-1';
const WINDOW_ID_2 = 'win-test-2';

function makeNotify(action: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type: `notify.${action}`, ...fields } as NappletMessage;
}

function makeIncEmit(topic: string, payload: Record<string, unknown> = {}): NappletMessage {
  return { type: 'inc.emit', topic, payload } as NappletMessage;
}

function createService() {
  return createNotificationService();
}

describe('createNotificationService', () => {
  it('returns the direct notify service descriptor', () => {
    expect(createService().descriptor).toEqual({
      name: 'notifications',
      version: '1.0.0',
      description: 'Notification state registry — tracks notifications per napplet window',
    });
  });

  it('creates a notification from notify.create and emits the shaped direct result', () => {
    const changes: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createNotificationService({ onChange: (list) => changes.push(list) });

    service.handleMessage(
      WINDOW_ID,
      makeNotify('create', { title: 'New Message', body: 'Hello from chat' }),
      (message) => sent.push(message),
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'notify.created' });
    expect(typeof (sent[0] as { id: unknown }).id).toBe('string');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject([{ windowId: WINDOW_ID, title: 'New Message', body: 'Hello from chat', read: false }]);
  });

  it('lists only the requesting window notifications through notify.list', () => {
    const service = createService();
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'First', body: 'One' }), () => {});
    service.handleMessage(WINDOW_ID_2, makeNotify('create', { title: 'Second', body: 'Two' }), () => {});
    service.handleMessage(WINDOW_ID, makeNotify('list'), (message) => sent.push(message));

    expect(sent).toEqual([
      expect.objectContaining({
        type: 'notify.listed',
        notifications: [expect.objectContaining({ title: 'First', body: 'One', windowId: WINDOW_ID })],
      }),
    ]);
  });

  it('marks and dismisses direct notifications by id', () => {
    const changes: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createNotificationService({ onChange: (list) => changes.push([...list]) });

    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'T', body: 'B' }), (message) => sent.push(message));
    const notificationId = (sent[0] as { id: string }).id;
    service.handleMessage(WINDOW_ID, makeNotify('read', { notificationId }), () => {});
    expect(changes.at(-1)).toMatchObject([{ id: notificationId, read: true }]);

    service.handleMessage(WINDOW_ID, makeNotify('dismiss', { notificationId }), () => {});
    expect(changes.at(-1)).toEqual([]);
  });

  it('enforces the configured direct notification limit', () => {
    const changes: unknown[] = [];
    const service = createNotificationService({
      maxPerWindow: 2,
      onChange: (list) => changes.push([...list]),
    });

    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'First' }), () => {});
    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'Second' }), () => {});
    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'Third' }), () => {});

    expect(changes.at(-1)).toMatchObject([{ title: 'Second' }, { title: 'Third' }]);
  });

  it('contains unknown direct notify actions without a side effect or result', () => {
    const changes: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createNotificationService({ onChange: (list) => changes.push(list) });

    service.handleMessage(WINDOW_ID, makeNotify('unknown', { title: 'ignored' }), (message) => sent.push(message));

    expect(changes).toEqual([]);
    expect(sent).toEqual([]);
  });

  it.each([
    ['notifications:create', { title: 'Legacy', body: 'must not run' }],
    ['notify.create', { title: 'Direct-looking INC topic', body: 'must not run' }],
    ['notifications:create?title=Query', { title: 'Query', body: 'must not run' }],
    ['napplet:archetype/intent', { title: 'Opaque', body: 'must not run' }],
  ])('ignores opaque INC topic %s without synthesizing an event', (topic, payload) => {
    const changes: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createNotificationService({ onChange: (list) => changes.push(list) });

    service.handleMessage(WINDOW_ID, makeIncEmit(topic, payload), (message) => sent.push(message));

    expect(changes).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('cleans up direct notification state when its window is destroyed', () => {
    const changes: unknown[] = [];
    const service = createNotificationService({ onChange: (list) => changes.push([...list]) });

    service.handleMessage(WINDOW_ID, makeNotify('create', { title: 'T', body: 'B' }), () => {});
    service.onWindowDestroyed?.(WINDOW_ID);

    expect(changes.at(-1)).toEqual([]);
  });
});
