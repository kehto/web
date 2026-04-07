/**
 * notification-service.test.ts — Unit tests for the notification service.
 */

import { describe, it, expect } from 'vitest';
import { createNotificationService } from './notification-service.js';
import type { NappletMessage } from '@napplet/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';
const WINDOW_ID_2 = 'win-test-2';

function makeIfcEmit(topic: string, payload: Record<string, unknown> = {}): NappletMessage {
  return { type: 'ifc.emit', topic, payload } as NappletMessage;
}

function createService() {
  return createNotificationService();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createNotificationService', () => {
  it('returns ServiceHandler with correct descriptor', () => {
    const service = createNotificationService();
    expect(service.descriptor).toEqual({
      name: 'notifications',
      version: '1.0.0',
      description: 'Notification state registry — tracks notifications per napplet window',
    });
  });

  it('ignores non-ifc.emit messages', () => {
    const service = createService();
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, { type: 'relay.subscribe' } as NappletMessage, (msg) => sent.push(msg));
    expect(sent).toHaveLength(0);
  });

  it('ignores events with non-notifications topic', () => {
    const service = createService();
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, makeIfcEmit('chat:message', { text: 'hello' }), (msg) => sent.push(msg));
    expect(sent).toHaveLength(0);
  });

  describe('notifications:create', () => {
    it('creates a notification and sends notifications:created with an id', () => {
      const service = createService();
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'New Message', body: 'Hello from chat' }), (msg) => sent.push(msg));

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('ifc.event');
      expect((sent[0] as any).topic).toBe('notifications:created');
      expect(typeof (sent[0] as any).payload.id).toBe('string');
      expect(((sent[0] as any).payload.id as string).length).toBeGreaterThan(0);
    });

    it('calls onChange with the new notification', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'Alert', body: 'Something happened' }), () => {});

      expect(changes).toHaveLength(1);
      const list = changes[0] as Array<{ title: string; body: string; read: boolean }>;
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Alert');
      expect(list[0].body).toBe('Something happened');
      expect(list[0].read).toBe(false);
    });

    it('creates notification with correct windowId', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), () => {});

      const list = changes[0] as Array<{ windowId: string }>;
      expect(list[0].windowId).toBe(WINDOW_ID);
    });
  });

  describe('notifications:list', () => {
    it('returns notifications:listed with current window notifications', () => {
      const service = createService();
      const sent: NappletMessage[] = [];

      // Create a notification first
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T1', body: 'B1' }), () => {});

      // Request list
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:list'), (msg) => sent.push(msg));

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('ifc.event');
      expect((sent[0] as any).topic).toBe('notifications:listed');
      const notifs = (sent[0] as any).payload.notifications as Array<{ title: string }>;
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe('T1');
    });

    it('returns empty list for window with no notifications', () => {
      const service = createService();
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:list'), (msg) => sent.push(msg));

      const notifs = (sent[0] as any).payload.notifications as unknown[];
      expect(notifs).toHaveLength(0);
    });

    it('returns only notifications for the requesting window', () => {
      const service = createService();
      const sent: NappletMessage[] = [];

      // Create notifications for two different windows
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'Win1', body: 'B' }), () => {});
      service.handleMessage(WINDOW_ID_2, makeIfcEmit('notifications:create', { title: 'Win2', body: 'B' }), () => {});

      // Request list from WINDOW_ID — should only see its own
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:list'), (msg) => sent.push(msg));

      const notifs = (sent[0] as any).payload.notifications as Array<{ title: string }>;
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe('Win1');
    });
  });

  describe('notifications:read', () => {
    it('flips read from false to true', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), (msg) => sent.push(msg));
      const notifId = (sent[0] as any).payload.id as string;

      // Mark as read
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:read', { id: notifId }), () => {});

      const lastChange = changes[changes.length - 1] as Array<{ id: string; read: boolean }>;
      const notif = lastChange.find((n) => n.id === notifId);
      expect(notif?.read).toBe(true);
    });

    it('does not call onChange if notification is already read', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), (msg) => sent.push(msg));
      const notifId = (sent[0] as any).payload.id as string;

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:read', { id: notifId }), () => {});
      const changesAfterRead = changes.length;

      // Reading again should not trigger onChange
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:read', { id: notifId }), () => {});
      expect(changes.length).toBe(changesAfterRead);
    });
  });

  describe('notifications:dismiss', () => {
    it('removes the notification from the list', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), (msg) => sent.push(msg));
      const notifId = (sent[0] as any).payload.id as string;

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:dismiss', { id: notifId }), () => {});

      const lastChange = changes[changes.length - 1] as Array<{ id: string }>;
      expect(lastChange.find((n) => n.id === notifId)).toBeUndefined();
    });

    it('calls onChange after dismissal', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });
      const sent: NappletMessage[] = [];

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), (msg) => sent.push(msg));
      const notifId = (sent[0] as any).payload.id as string;
      const countBefore = changes.length;

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:dismiss', { id: notifId }), () => {});
      expect(changes.length).toBeGreaterThan(countBefore);
    });
  });

  describe('maxPerWindow', () => {
    it('evicts oldest notification (FIFO) when limit is exceeded', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({
        onChange: (list) => changes.push([...list]),
        maxPerWindow: 2,
      });

      // Create 3 notifications — the first should be evicted
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'First', body: '1' }), () => {});
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'Second', body: '2' }), () => {});
      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'Third', body: '3' }), () => {});

      const lastChange = changes[changes.length - 1] as Array<{ title: string }>;
      expect(lastChange).toHaveLength(2);
      expect(lastChange.find((n) => n.title === 'First')).toBeUndefined();
      expect(lastChange.find((n) => n.title === 'Second')).toBeDefined();
      expect(lastChange.find((n) => n.title === 'Third')).toBeDefined();
    });
  });

  describe('onWindowDestroyed', () => {
    it('removes notifications for the destroyed window and calls onChange', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });

      service.handleMessage(WINDOW_ID, makeIfcEmit('notifications:create', { title: 'T', body: 'B' }), () => {});
      const countBefore = changes.length;

      service.onWindowDestroyed?.(WINDOW_ID);

      expect(changes.length).toBeGreaterThan(countBefore);
      const lastChange = changes[changes.length - 1] as Array<{ windowId: string }>;
      expect(lastChange.find((n) => n.windowId === WINDOW_ID)).toBeUndefined();
    });

    it('does not call onChange for a window that has no notifications', () => {
      const changes: unknown[] = [];
      const service = createNotificationService({ onChange: (list) => changes.push(list) });

      const countBefore = changes.length;
      service.onWindowDestroyed?.('nonexistent-window');
      expect(changes.length).toBe(countBefore);
    });

    it('does not throw for unknown window', () => {
      const service = createService();
      expect(() => service.onWindowDestroyed?.('nonexistent-window')).not.toThrow();
    });
  });
});
