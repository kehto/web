import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import type { NotifyPresentation } from './notify-service.js';
import { describe, expect, it, vi } from 'vitest';
import { createNotifyService } from './notify-service.js';

const WINDOW_ID = 'win-test-1';

function makeMsg(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, ...fields } as NappletMessage;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function attachApproval(service: ReturnType<typeof createNotifyService>, authorizeOperation: NonNullable<ServiceRuntimeContext['authorizeOperation']>): void {
  service.onRegistered?.({ authorizeOperation, resolveDTag: () => 'app', listWindowIds: () => [],
    hasCapability: () => true, sendToEligibleNapplet: () => true });
}

describe('createNotifyService', () => {
  it('fails closed when notification presentation is unavailable', async () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'hi' }), (message) => sent.push(message));
    service.handleMessage(WINDOW_ID, makeMsg('notify.permission.request', { id: 'p1' }), (message) => sent.push(message));
    await settle();

    expect(sent).toEqual([
      {
        type: 'notify.send.result',
        id: 'n1',
        error: 'notification presentation unavailable',
      },
      { type: 'notify.permission.result', id: 'p1', granted: false },
    ]);
  });

  it('delegates presentation and returns an id only after delivery succeeds', async () => {
    const present = vi.fn(async (_presentation: NotifyPresentation) => {});
    const service = createNotifyService({
      generateId: () => 'host-notification-7',
      present,
      controls: ['toasts', 'actions'],
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.send', { id: 'n1', title: 'New message', body: 'Hello' }),
      (message) => sent.push(message),
    );
    await settle();

    expect(present).toHaveBeenCalledWith(expect.objectContaining({
      windowId: WINDOW_ID,
      notificationId: 'host-notification-7',
      message: expect.objectContaining({ title: 'New message', body: 'Hello' }),
      emit: expect.any(Function),
    }));
    expect(sent).toEqual([
      { type: 'notify.controls', controls: ['toasts', 'actions'] },
      { type: 'notify.send.result', id: 'n1', notificationId: 'host-notification-7' },
    ]);
  });

  it('reports host delivery failures without assigning a notification id', async () => {
    const service = createNotifyService({
      present: () => Promise.reject(new Error('rate limited')),
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'hi' }), (message) => sent.push(message));
    await settle();

    expect(sent).toEqual([{ type: 'notify.send.result', id: 'n1', error: 'rate limited' }]);
  });

  it('routes host interactions to the requesting napplet', async () => {
    const presentations: NotifyPresentation[] = [];
    const service = createNotifyService({
      present: (value) => { presentations.push(value); },
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'hi' }), (message) => sent.push(message));
    await settle();
    const presentation = presentations[0];
    presentation.emit({ type: 'notify.clicked', notificationId: presentation.notificationId });
    presentation.emit({ type: 'notify.action', notificationId: presentation.notificationId, actionId: 'open' });
    presentation.emit({ type: 'notify.dismissed', notificationId: presentation.notificationId, reason: 'user' });
    presentation.emit({ type: 'notify.clicked', notificationId: presentation.notificationId });

    expect(sent.slice(1)).toEqual([
      { type: 'notify.clicked', notificationId: 'shell-1' },
      { type: 'notify.action', notificationId: 'shell-1', actionId: 'open' },
      { type: 'notify.dismissed', notificationId: 'shell-1', reason: 'user' },
    ]);
  });

  it('delegates dismiss, badge, channel, and permission operations', async () => {
    const dismiss = vi.fn();
    const setBadge = vi.fn();
    const registerChannel = vi.fn();
    const requestPermission = vi.fn(async () => true);
    const service = createNotifyService({
      present: () => {},
      dismiss,
      setBadge,
      registerChannel,
      requestPermission,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'hi' }), (message) => sent.push(message));
    await settle();
    service.handleMessage(WINDOW_ID, makeMsg('notify.dismiss', { notificationId: 'shell-1' }), (message) => sent.push(message));
    service.handleMessage(WINDOW_ID, makeMsg('notify.dismiss', { notificationId: 'unknown' }), (message) => sent.push(message));
    service.handleMessage(WINDOW_ID, makeMsg('notify.badge', { count: 3 }), (message) => sent.push(message));
    service.handleMessage(WINDOW_ID, makeMsg('notify.channel.register', {
      channelId: 'messages',
      label: 'Messages',
    }), (message) => sent.push(message));
    service.handleMessage(WINDOW_ID, makeMsg('notify.permission.request', {
      id: 'p1',
      channel: 'messages',
    }), (message) => sent.push(message));
    await settle();

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(WINDOW_ID, 'shell-1');
    expect(setBadge).toHaveBeenCalledWith(WINDOW_ID, 3);
    expect(registerChannel).toHaveBeenCalledWith(WINDOW_ID, expect.objectContaining({ channelId: 'messages' }));
    expect(requestPermission).toHaveBeenCalledWith(WINDOW_ID, 'messages', expect.objectContaining({ aborted: false }));
    expect(sent).toContainEqual({ type: 'notify.permission.result', id: 'p1', granted: true });
  });

  it('cleans active notifications and host state when a window is destroyed', async () => {
    const dismiss = vi.fn();
    const destroyWindow = vi.fn();
    const service = createNotifyService({ present: () => {}, dismiss, destroyWindow });

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'one' }), () => {});
    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n2', title: 'two' }), () => {});
    await settle();
    service.onWindowDestroyed?.(WINDOW_ID);

    expect(dismiss.mock.calls).toEqual([
      [WINDOW_ID, 'shell-1'],
      [WINDOW_ID, 'shell-2'],
    ]);
    expect(destroyWindow).toHaveBeenCalledWith(WINDOW_ID);
  });

  it('closes a presentation that resolves after its window is destroyed without sending a result', async () => {
    let resolvePresentation!: () => void;
    let presentation!: NotifyPresentation;
    const dismiss = vi.fn();
    const service = createNotifyService({
      present: (value) => {
        presentation = value;
        return new Promise<void>((resolve) => { resolvePresentation = resolve; });
      },
      dismiss,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'late' }), (message) => sent.push(message));
    service.onWindowDestroyed?.(WINDOW_ID);
    resolvePresentation();
    await settle();
    presentation.emit({ type: 'notify.clicked', notificationId: presentation.notificationId });

    expect(sent).toEqual([]);
    expect(dismiss.mock.calls).toEqual([[WINDOW_ID, 'shell-1']]);
  });

  it('waits for Firewall approval, captures the exact channel/payload, and denies without host effects', async () => {
    let decide!: (value: { status: 'executed'; value: void } | { status: 'denied' }) => void;
    let execute!: (signal: AbortSignal) => Promise<void>;
    const authorizeOperation = vi.fn((_windowId, _operation, _requirements, callback) => {
      execute = callback;
      return new Promise((resolve) => { decide = resolve; });
    }) as unknown as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
    const present = vi.fn();
    const service = createNotifyService({ present });
    attachApproval(service, authorizeOperation);
    const sent: NappletMessage[] = [];
    const message = makeMsg('notify.send', { id: 'n1', title: 'Original', channel: 'alerts' });
    service.handleMessage(WINDOW_ID, message, (result) => sent.push(result));
    expect(present).not.toHaveBeenCalled();
    expect(authorizeOperation).toHaveBeenCalledWith(WINDOW_ID, 'notify.send', [expect.objectContaining({
      category: 'resource', scope: { kind: 'exact', value: 'channel:alerts' },
    })], expect.any(Function));
    (message as unknown as { title: string }).title = 'Changed';
    await execute(new AbortController().signal);
    decide({ status: 'executed', value: undefined });
    await settle();
    expect(present.mock.calls[0][0].message.title).toBe('Original');
    expect(sent).toContainEqual({ type: 'notify.send.result', id: 'n1', notificationId: 'shell-1' });

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n2', title: 'Denied' }), (result) => sent.push(result));
    decide({ status: 'denied' });
    await settle();
    expect(present).toHaveBeenCalledTimes(1);
    expect(sent).toContainEqual({ type: 'notify.send.result', id: 'n2', error: 'permission denied' });
  });

  it('drops an approved send and callback after revocation before approval settles', async () => {
    let execute!: (signal: AbortSignal) => Promise<void>;
    let decide!: (value: { status: 'executed'; value: void }) => void;
    const authorizeOperation = vi.fn((_windowId, _operation, _requirements, callback) => {
      execute = callback;
      return new Promise((resolve) => { decide = resolve; });
    }) as unknown as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
    const present = vi.fn();
    const service = createNotifyService({ present });
    attachApproval(service, authorizeOperation);
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'Late' }), (result) => sent.push(result));
    service.onPermissionRevoked?.(WINDOW_ID);
    await execute(new AbortController().signal);
    decide({ status: 'executed', value: undefined });
    await settle();
    expect(present).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('stops interaction pushes when the source loses its notification ACL capability', async () => {
    let allowed = true;
    let presentation!: NotifyPresentation;
    const service = createNotifyService({ present: (value) => { presentation = value; } });
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, action) => ({
      status: 'executed', value: await action(new AbortController().signal),
    })) as unknown as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
    service.onRegistered?.({ authorizeOperation, resolveDTag: () => 'app', listWindowIds: () => [],
      hasCapability: () => allowed, sendToEligibleNapplet: () => true });
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'Hello' }), (result) => sent.push(result));
    await settle();
    presentation.emit({ type: 'notify.clicked', notificationId: presentation.notificationId });
    allowed = false;
    presentation.emit({ type: 'notify.clicked', notificationId: presentation.notificationId });
    expect(sent.filter((message) => message.type === 'notify.clicked')).toHaveLength(1);
  });

  it.each(['https://example.test/track', '//example.test/track', '/track'])('rejects icon URL %s before prompting or host fetching', async (icon) => {
    const authorizeOperation = vi.fn() as unknown as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
    const present = vi.fn();
    const service = createNotifyService({ present });
    attachApproval(service, authorizeOperation);
    const sent: NappletMessage[] = [];
    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'Icon', icon }), (result) => sent.push(result));
    await settle();
    expect(authorizeOperation).not.toHaveBeenCalled();
    expect(present).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'notify.send.result', id: 'n1', error: 'invalid notification' }]);
  });

  it('warns once on host-only effects while canonical runtime-approved calls stay quiet', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const legacy = createNotifyService({ present: () => {} });
      legacy.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'First' }), () => {});
      legacy.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n2', title: 'Second' }), () => {});
      await settle();
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0][0]).toMatch(/FW-NOTIFY-LEGACY-001.*RuntimeAdapter\.permissions.*once per service instance/i);

      const canonical = createNotifyService({ present: () => {} });
      const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, action) => ({
        status: 'executed', value: await action(new AbortController().signal),
      })) as unknown as NonNullable<ServiceRuntimeContext['authorizeOperation']>;
      attachApproval(canonical, authorizeOperation);
      canonical.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n3', title: 'Current' }), () => {});
      await settle();
      expect(authorizeOperation).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledTimes(1);
    } finally { warning.mockRestore(); }
  });

  it('rejects a destroyed presentation callback after the window id is reused', async () => {
    const presentations: NotifyPresentation[] = [];
    const service = createNotifyService({
      present: (presentation) => { presentations.push(presentation); },
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n1', title: 'first' }), (message) => sent.push(message));
    await settle();
    service.onWindowDestroyed?.(WINDOW_ID);
    service.handleMessage(WINDOW_ID, makeMsg('notify.send', { id: 'n2', title: 'second' }), (message) => sent.push(message));
    await settle();
    presentations[0]!.emit({ type: 'notify.clicked', notificationId: presentations[0]!.notificationId });

    expect(sent).toEqual([
      { type: 'notify.send.result', id: 'n1', notificationId: 'shell-1' },
      { type: 'notify.send.result', id: 'n2', notificationId: 'shell-2' },
    ]);
  });

  it('returns an error envelope for unknown notify methods', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];

    service.handleMessage(WINDOW_ID, makeMsg('notify.bogus', { id: 'x' }), (message) => sent.push(message));

    expect(sent).toEqual([{
      type: 'notify.bogus.error',
      id: 'x',
      error: 'Unknown notify method: notify.bogus',
    }]);
  });
});
