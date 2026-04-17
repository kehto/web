/**
 * media-service.test.ts — Unit tests for the stub-level media NUB service.
 *
 * Covers the 5 napplet->shell request types from @napplet/nub-media plus
 * unknown-action + ACL-denial envelope shapes.
 */

import { describe, it, expect } from 'vitest';
import { createMediaService } from './media-service.js';
import type { NappletMessage } from '@napplet/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-media-1';

/**
 * Compose the runtime-level ACL gate in front of the media service.
 * Mirrors the shape of packages/runtime/src/runtime.ts: when the enforce
 * gate denies, the runtime emits a `<type>.error` envelope and never
 * invokes the service. We reproduce that here so the test asserts the
 * exact envelope the napplet will see.
 */
function dispatchWithEnforcer(
  enforcer: { check: () => { allowed: boolean; reason?: string } },
  service: ReturnType<typeof createMediaService>,
  windowId: string,
  message: NappletMessage,
  send: (msg: NappletMessage) => void,
): void {
  const decision = enforcer.check();
  if (!decision.allowed) {
    const id = (message as NappletMessage & { id?: string }).id ?? '';
    send({
      type: `${message.type}.error`,
      id,
      error: decision.reason ?? 'denied',
    } as NappletMessage);
    return;
  }
  service.handleMessage(windowId, message, send);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createMediaService', () => {
  it('returns a ServiceHandler with a media descriptor', () => {
    const service = createMediaService();
    expect(service.descriptor.name).toBe('media');
    expect(typeof service.descriptor.version).toBe('string');
  });

  describe('media.session.create', () => {
    it('emits media.session.create.result with matching sessionId', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm1',
          sessionId: 's1',
          metadata: { title: 't' },
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.session.create.result');
      expect((sent[0] as any).id).toBe('m1');
      expect((sent[0] as any).sessionId).toBe('s1');
    });

    it('invokes onSessionCreate callback with windowId, sessionId, metadata', () => {
      const calls: Array<{ windowId: string; sessionId: string; metadata: unknown }> = [];
      const service = createMediaService({
        onSessionCreate: (windowId, sessionId, metadata) => {
          calls.push({ windowId, sessionId, metadata });
        },
      });

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm2',
          sessionId: 's2',
          metadata: { title: 'song' },
        } as NappletMessage,
        () => {},
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].windowId).toBe(WINDOW_ID);
      expect(calls[0].sessionId).toBe('s2');
      expect(calls[0].metadata).toEqual({ title: 'song' });
    });
  });

  describe('fire-and-forget requests emit zero envelopes', () => {
    it('media.session.update emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.session.update',
          sessionId: 's1',
          metadata: { title: 'new-title' },
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.session.destroy emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        { type: 'media.session.destroy', sessionId: 's1' } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.state emits nothing (high-frequency state report)', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.state',
          sessionId: 's1',
          status: 'playing',
          position: 42.5,
          duration: 240,
          volume: 0.8,
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('media.capabilities emits nothing', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.capabilities',
          sessionId: 's1',
          actions: ['play', 'pause', 'seek', 'volume'],
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(0);
    });

    it('invokes onState callback for media.state', () => {
      const states: Array<{ windowId: string; sessionId: string; state: unknown }> = [];
      const service = createMediaService({
        onState: (windowId, sessionId, state) => {
          states.push({ windowId, sessionId, state });
        },
      });

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'media.state',
          sessionId: 's1',
          status: 'playing',
        } as NappletMessage,
        () => {},
      );

      expect(states).toHaveLength(1);
      expect(states[0].windowId).toBe(WINDOW_ID);
      expect(states[0].sessionId).toBe('s1');
    });
  });

  describe('unknown media action', () => {
    it('emits <type>.error envelope', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];

      service.handleMessage(
        WINDOW_ID,
        { type: 'media.bogus', id: 'x' } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.bogus.error');
      expect((sent[0] as any).id).toBe('x');
      expect((sent[0] as any).error).toMatch(/Unknown media method/);
    });
  });

  describe('ACL denial envelope shape (runtime-composed)', () => {
    it('media.session.create denied by ACL emits media.session.create.error', () => {
      const service = createMediaService();
      const sent: NappletMessage[] = [];
      const denyingEnforcer = {
        check: () => ({ allowed: false, reason: 'capability_missing: media:control' }),
      };

      dispatchWithEnforcer(
        denyingEnforcer,
        service,
        WINDOW_ID,
        {
          type: 'media.session.create',
          id: 'm-deny',
          sessionId: 's-deny',
        } as NappletMessage,
        (msg) => sent.push(msg),
      );

      expect(sent).toHaveLength(1);
      expect((sent[0] as any).type).toBe('media.session.create.error');
      expect((sent[0] as any).id).toBe('m-deny');
      expect((sent[0] as any).error).toMatch(/capability_missing|denied|media:control/);
    });
  });
});
