import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { NOTIFY_MOCK_ENTRY, NOTIFY_SPEC_REF, createMockNotifyService } from './notify.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const CLOCK = { now: () => 1_700_000_000_000 };

describe('createMockNotifyService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockNotifyService();
    expect(service.descriptor).toMatchObject({ name: 'notify', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['notify.send', 'notify.dismiss', 'notify.badge', 'notify.channel.register', 'notify.permission.request']);
    expect(NOTIFY_SPEC_REF).toEqual({ nap: 'NAP-NOTIFY', status: 'draft', source: 'pr', pr: 11, sha: '67877ef6', path: 'naps/NAP-NOTIFY.md' });
    expect(NOTIFY_MOCK_ENTRY.kind).toBe('service');
    expect(NOTIFY_MOCK_ENTRY.create?.({}).descriptor.name).toBe('notify');
  });

  it('pushes controls once, then assigns notification ids on send', () => {
    const service = createMockNotifyService({ clock: CLOCK });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'notify.send', id: 'n1', title: 'New message', body: 'Alice: hey!', priority: 'normal' } as NappletMessage, send);
    service.handleMessage('w1', {
      type: 'notify.send', id: 'n2', title: 'Incoming call', priority: 'urgent',
      actions: [{ id: 'answer', label: 'Answer' }, { id: 'decline', label: 'Decline' }, { id: 'a3', label: '3' }, { id: 'a4', label: '4' }],
    } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'notify.controls', controls: ['toasts', 'badges', 'actions', 'channels'] },
      { type: 'notify.send.result', id: 'n1', notificationId: 'shell-1' },
      { type: 'notify.send.result', id: 'n2', notificationId: 'shell-2' },
    ]);
    expect(service.mock.state().notifications.get('shell-2')).toEqual({
      notificationId: 'shell-2', windowId: 'w1', title: 'Incoming call', priority: 'urgent', createdAt: 1_700_000_000_000,
      actions: [{ id: 'answer', label: 'Answer' }, { id: 'decline', label: 'Decline' }, { id: 'a3', label: '3' }],
    });
  });

  it('rejects malformed sends, unknown channels, and denied permission', () => {
    const service = createMockNotifyService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'notify.send', id: 'n3' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.send', id: 'n4', title: 'x', channel: 'promos' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.send', id: 'n5', title: 'x', actions: [{ id: 1 }] } as NappletMessage, send);
    expect(sent.slice(1)).toEqual([
      { type: 'notify.send.result', id: 'n3', error: 'invalid notification' },
      { type: 'notify.send.result', id: 'n4', error: 'invalid channel' },
      { type: 'notify.send.result', id: 'n5', error: 'invalid notification' },
    ]);

    const denied = createMockNotifyService({ grantPermission: false, controls: ['toasts'] });
    const out = sink();
    denied.handleMessage('w1', { type: 'notify.send', id: 'n6', title: 'x' } as NappletMessage, out.send);
    denied.handleMessage('w1', { type: 'notify.permission.request', id: 'p2' } as NappletMessage, out.send);
    expect(out.sent).toEqual([
      { type: 'notify.controls', controls: ['toasts'] },
      { type: 'notify.send.result', id: 'n6', error: 'permission denied' },
      { type: 'notify.permission.result', id: 'p2', granted: false },
    ]);
  });

  it('registers channels, grants permission, and tracks badges', () => {
    const service = createMockNotifyService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'notify.channel.register', channelId: 'messages', label: 'Messages', description: 'Direct messages and mentions', defaultPriority: 'normal' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.permission.request', id: 'p1', channel: 'messages' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.send', id: 'n1', title: 'hi', channel: 'messages' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.badge', count: 3 } as NappletMessage, send);
    service.handleMessage('w1', { type: 'notify.badge', count: -2.5 } as NappletMessage, send);
    expect(sent.slice(1)).toEqual([
      { type: 'notify.permission.result', id: 'p1', granted: true },
      { type: 'notify.send.result', id: 'n1', notificationId: 'shell-1' },
    ]);
    expect(service.mock.state().channels.get('w1')?.get('messages')).toEqual({ channelId: 'messages', label: 'Messages', description: 'Direct messages and mentions', defaultPriority: 'normal' });
    expect(service.mock.state().badges.get('w1')).toBe(0);
  });

  it('pushes action, clicked, and dismissed interactions to the owning window', () => {
    const service = createMockNotifyService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'notify.send', id: 'n2', title: 'Incoming call', actions: [{ id: 'answer', label: 'Answer' }] } as NappletMessage, send);
    sent.length = 0;
    expect(service.interact('shell-1', 'answer')).toBe(true);
    expect(service.interact('shell-1', 'nope')).toBe(false);
    expect(service.interact('shell-1', 'clicked')).toBe(true);
    expect(service.interact('shell-1', { type: 'dismissed', reason: 'timeout' })).toBe(true);
    expect(service.interact('shell-1', 'clicked')).toBe(false);
    expect(service.interact('shell-99', 'clicked')).toBe(false);
    expect(sent).toEqual([
      { type: 'notify.action', notificationId: 'shell-1', actionId: 'answer' },
      { type: 'notify.clicked', notificationId: 'shell-1' },
      { type: 'notify.dismissed', notificationId: 'shell-1', reason: 'timeout' },
    ]);
    expect(service.mock.state().notifications.size).toBe(0);
  });

  it('ignores unknown dismiss ids, cleans windows, and resets', () => {
    const service = createMockNotifyService();
    const { send } = sink();
    service.handleMessage('w1', { type: 'notify.send', id: 'n1', title: 'a' } as NappletMessage, send);
    service.handleMessage('w2', { type: 'notify.send', id: 'n2', title: 'b' } as NappletMessage, send);
    service.handleMessage('w2', { type: 'notify.dismiss', notificationId: 'shell-1' } as NappletMessage, send);
    service.handleMessage('w2', { type: 'notify.dismiss', notificationId: 'shell-404' } as NappletMessage, send);
    expect([...service.mock.state().notifications.keys()]).toEqual(['shell-1', 'shell-2']);
    service.handleMessage('w1', { type: 'notify.dismiss', notificationId: 'shell-1' } as NappletMessage, send);
    expect([...service.mock.state().notifications.keys()]).toEqual(['shell-2']);
    service.onWindowDestroyed?.('w2');
    expect(service.mock.state().notifications.size).toBe(0);
    expect(service.mock.state().controlsSent.has('w2')).toBe(false);
    service.mock.reset();
    expect(service.mock.state().counter).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
