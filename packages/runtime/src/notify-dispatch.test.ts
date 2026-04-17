/**
 * notify-dispatch.test.ts — Unit tests for notify.* domain dispatch wiring
 * in @kehto/runtime.
 *
 * Verifies:
 *   - Runtime routes notify.* envelopes to the registered 'notify' service.
 *   - Fallback path emits spec-correct result envelopes for notify.send and
 *     notify.permission.request when no 'notify' service is registered,
 *     so napplets see a reply even without a host-wired backend.
 *   - Fire-and-forget actions (dismiss/badge/channel.register) produce no
 *     envelope on the fallback path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler } from './types.js';

const WINDOW_ID = 'win-test-1';
const TEST_DTAG = 'test-napp';
const TEST_HASH = 'c'.repeat(64);

function makeSessionEntry() {
  return createNip5dSessionEntry(WINDOW_ID, TEST_DTAG, TEST_HASH);
}

describe('runtime notify.* dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, makeSessionEntry());
  });

  describe('with registered notify service', () => {
    it('routes notify.send to the service', () => {
      const calls: NappletMessage[] = [];
      const service: ServiceHandler = {
        descriptor: { name: 'notify', version: '1.0.0' },
        handleMessage(_windowId, msg, send) {
          calls.push(msg);
          send({
            type: 'notify.send.result',
            id: (msg as any).id,
            notificationId: 'service-assigned-42',
          } as NappletMessage);
        },
      };
      runtime.registerService('notify', service);

      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.send',
        id: 'req-1',
        title: 'hi',
      } as NappletMessage);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('notify.send');
      const result = findEnvelopeResponse(ctx.sent, 'notify.send.result');
      expect(result).toBeDefined();
      expect((result as any).notificationId).toBe('service-assigned-42');
    });

    it('routes notify.permission.request to the service', () => {
      const service: ServiceHandler = {
        descriptor: { name: 'notify', version: '1.0.0' },
        handleMessage(_windowId, msg, send) {
          send({
            type: 'notify.permission.result',
            id: (msg as any).id,
            granted: false,
          } as NappletMessage);
        },
      };
      runtime.registerService('notify', service);

      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.permission.request',
        id: 'req-p',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'notify.permission.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-p');
      expect((result as any).granted).toBe(false);
    });

    it('routes fire-and-forget notify.dismiss to the service (no runtime-composed reply)', () => {
      const calls: NappletMessage[] = [];
      const service: ServiceHandler = {
        descriptor: { name: 'notify', version: '1.0.0' },
        handleMessage(_windowId, msg, _send) {
          calls.push(msg);
          // fire-and-forget — service emits no envelope
        },
      };
      runtime.registerService('notify', service);

      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.dismiss',
        notificationId: 'shell-1',
      } as NappletMessage);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('notify.dismiss');
      expect(ctx.sent).toHaveLength(0);
    });
  });

  describe('without registered notify service (fallback path)', () => {
    it('emits notify.send.result so napplets see a reply', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.send',
        id: 'req-a',
        title: 'hi',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'notify.send.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-a');
      expect(typeof (result as any).notificationId).toBe('string');
      expect((result as any).notificationId.length).toBeGreaterThan(0);
    });

    it('emits notify.permission.result (granted:true) so napplets see a reply', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.permission.request',
        id: 'req-b',
      } as NappletMessage);

      const result = findEnvelopeResponse(ctx.sent, 'notify.permission.result');
      expect(result).toBeDefined();
      expect((result as any).id).toBe('req-b');
      expect((result as any).granted).toBe(true);
    });

    it('emits no envelope for notify.dismiss / notify.badge / notify.channel.register', () => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.dismiss',
        notificationId: 'shell-1',
      } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.badge',
        count: 7,
      } as NappletMessage);
      runtime.handleMessage(WINDOW_ID, {
        type: 'notify.channel.register',
        channelId: 'msg',
        label: 'Messages',
      } as NappletMessage);

      expect(ctx.sent).toHaveLength(0);
    });
  });
});
