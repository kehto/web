/**
 * notify-service.test.ts — Unit tests for the notify NUB service.
 *
 * Covers the 5 napplet->shell request types from @napplet/nub/notify:
 *   notify.send, notify.dismiss, notify.badge, notify.channel.register,
 *   notify.permission.request.
 *
 * Also covers unknown-action error shape and ACL-denial envelope shape.
 */

import { describe, it, expect } from 'vitest';
import { createNotifyService } from './notify-service.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW_ID = 'win-test-1';

function makeMsg(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, ...fields } as NappletMessage;
}

describe('createNotifyService', () => {
  it('returns a ServiceHandler with the notify descriptor', () => {
    const service = createNotifyService();
    expect(service.descriptor.name).toBe('notify');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(typeof service.descriptor.description).toBe('string');
  });

  // ── notify.send ──────────────────────────────────────────────────────────

  it('notify.send produces notify.send.result with generated notificationId', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.send', { id: 'n1', title: 'hi' }),
      send,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('notify.send.result');
    expect((sent[0] as any).id).toBe('n1');
    const notificationId = (sent[0] as any).notificationId;
    expect(typeof notificationId).toBe('string');
    expect(notificationId.length).toBeGreaterThan(0);
  });

  it('notify.send honors options.generateId', () => {
    const service = createNotifyService({ generateId: () => 'custom-id-xyz' });
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.send', { id: 'n1', title: 'hi' }),
      send,
    );

    expect((sent[0] as any).notificationId).toBe('custom-id-xyz');
  });

  it('notify.send invokes options.onSend with windowId + payload', () => {
    const received: Array<{ windowId: string; type: string; id: string; title: string }> = [];
    const service = createNotifyService({
      onSend: (windowId, msg) => {
        received.push({ windowId, type: msg.type, id: msg.id, title: msg.title });
      },
    });
    const send = (_msg: NappletMessage): void => {};

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.send', { id: 'n-trace', title: 'payload-trace' }),
      send,
    );

    expect(received).toEqual([{
      windowId: WINDOW_ID,
      type: 'notify.send',
      id: 'n-trace',
      title: 'payload-trace',
    }]);
  });

  // ── fire-and-forget actions ──────────────────────────────────────────────

  it('notify.dismiss emits zero envelopes', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.dismiss', { notificationId: 'shell-42' }),
      send,
    );

    expect(sent).toHaveLength(0);
  });

  it('notify.badge emits zero envelopes', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.badge', { count: 3 }),
      send,
    );

    expect(sent).toHaveLength(0);
  });

  it('notify.channel.register emits zero envelopes', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.channel.register', {
        channelId: 'messages',
        label: 'Messages',
      }),
      send,
    );

    expect(sent).toHaveLength(0);
  });

  // ── notify.permission.request ────────────────────────────────────────────

  it('notify.permission.request produces notify.permission.result with granted:true by default', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.permission.request', { id: 'p1' }),
      send,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('notify.permission.result');
    expect((sent[0] as any).id).toBe('p1');
    expect((sent[0] as any).granted).toBe(true);
  });

  it('notify.permission.request honors options.defaultGrant=false', () => {
    const service = createNotifyService({ defaultGrant: false });
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.permission.request', { id: 'p2' }),
      send,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('notify.permission.result');
    expect((sent[0] as any).id).toBe('p2');
    expect((sent[0] as any).granted).toBe(false);
  });

  // ── unknown action ───────────────────────────────────────────────────────

  it('unknown notify.* action produces .error envelope', () => {
    const service = createNotifyService();
    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    service.handleMessage(
      WINDOW_ID,
      makeMsg('notify.bogus', { id: 'x' }),
      send,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('notify.bogus.error');
    expect((sent[0] as any).id).toBe('x');
    expect((sent[0] as any).error).toMatch(/unknown/i);
  });

  // ── ACL denial (runtime-composed denial envelope shape) ──────────────────

  it('notify.* request denied by ACL produces .error envelope without reaching the service', () => {
    // Emulate the runtime's ACL gate composed around the service.
    const service = createNotifyService();
    const serviceCalls: string[] = [];
    const wrappedService = {
      descriptor: service.descriptor,
      handleMessage(windowId: string, msg: NappletMessage, send: (m: NappletMessage) => void): void {
        serviceCalls.push(msg.type);
        service.handleMessage(windowId, msg, send);
      },
    };

    const enforcer = {
      check: (): { allowed: boolean; reason: string } => ({
        allowed: false,
        reason: 'capability_missing: notify:send',
      }),
    };

    const sent: NappletMessage[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg); };

    function dispatch(windowId: string, msg: NappletMessage): void {
      const check = enforcer.check();
      if (!check.allowed) {
        const id = (msg as NappletMessage & { id?: string }).id ?? '';
        send({ type: `${msg.type}.error`, id, error: check.reason } as NappletMessage);
        return;
      }
      wrappedService.handleMessage(windowId, msg, send);
    }

    dispatch(WINDOW_ID, makeMsg('notify.send', { id: 'n-deny', title: 'hi' }));

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('notify.send.error');
    expect((sent[0] as any).id).toBe('n-deny');
    expect((sent[0] as any).error).toMatch(/capability_missing|denied|notify:send/);
    // Service must NOT have been invoked when denied.
    expect(serviceCalls).toHaveLength(0);
  });

  // ── lifecycle ────────────────────────────────────────────────────────────

  it('onWindowDestroyed does not throw', () => {
    const service = createNotifyService();
    expect(() => service.onWindowDestroyed?.(WINDOW_ID)).not.toThrow();
  });
});
