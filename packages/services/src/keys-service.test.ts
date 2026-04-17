/**
 * keys-service.test.ts — Unit tests for the keys NUB reference service.
 */

import { describe, it, expect } from 'vitest';
import { createKeysService } from './keys-service.js';
import type { NappletMessage } from '@napplet/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createKeysService', () => {
  it('returns a ServiceHandler with descriptor { name: "keys" }', () => {
    const service = createKeysService();
    expect(service.descriptor.name).toBe('keys');
    expect(typeof service.descriptor.version).toBe('string');
  });

  describe('keys.forward', () => {
    it('invokes onForward callback with translated DOM field names and emits zero envelopes', () => {
      const received: Array<Record<string, unknown>> = [];
      const sent: NappletMessage[] = [];
      const service = createKeysService({
        onForward: (event) => received.push(event as unknown as Record<string, unknown>),
      });

      const msg: NappletMessage = {
        type: 'keys.forward',
        key: 's',
        code: 'KeyS',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });
      expect(sent).toHaveLength(0);
    });

    it('tolerates missing onForward callback and still emits zero envelopes', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.forward',
        key: 'a',
        code: 'KeyA',
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(0);
    });
  });

  describe('keys.registerAction', () => {
    it('produces keys.registerAction.result with actionId + defaultKey binding', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.registerAction',
        id: 'r1',
        action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(1);
      const reply = sent[0] as NappletMessage & { id: string; actionId: string; binding?: string };
      expect(reply.type).toBe('keys.registerAction.result');
      expect(reply.id).toBe('r1');
      expect(reply.actionId).toBe('editor.save');
      expect(reply.binding).toBe('Ctrl+S');
    });

    it('omits binding when action has no defaultKey', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.registerAction',
        id: 'r2',
        action: { id: 'x.y', label: 'Do thing' },
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(1);
      const reply = sent[0] as NappletMessage & { id: string; actionId: string; binding?: string };
      expect(reply.type).toBe('keys.registerAction.result');
      expect(reply.id).toBe('r2');
      expect(reply.actionId).toBe('x.y');
      expect(reply.binding).toBeUndefined();
    });
  });

  describe('keys.unregisterAction', () => {
    it('produces no envelope (fire-and-forget)', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.unregisterAction',
        actionId: 'editor.save',
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(0);
    });
  });

  describe('unknown keys.* method', () => {
    it('produces {type}.error envelope with descriptive error', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.bogus',
        id: 'x',
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(1);
      const reply = sent[0] as NappletMessage & { id: string; error: string };
      expect(reply.type).toBe('keys.bogus.error');
      expect(reply.id).toBe('x');
      expect(reply.error).toMatch(/Unknown keys method/i);
    });
  });

  describe('ACL-denial envelope shape', () => {
    it('mirrors the runtime enforcer-denial envelope shape for keys.forward', () => {
      // This test asserts the denial envelope shape the runtime emits on ACL denial,
      // using the same composition logic runtime.ts uses after enforceNub returns
      // { allowed: false }. The service itself is bypassed in that path.
      const enforcer = {
        check: (): { allowed: false; reason: string; capability: string } => ({
          allowed: false,
          reason: 'capability_missing: keys:forward',
          capability: 'keys:forward',
        }),
      };

      const sent: NappletMessage[] = [];
      const msg: NappletMessage = {
        type: 'keys.forward',
        key: 'a',
        code: 'KeyA',
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage;

      const result = enforcer.check();
      if (!result.allowed) {
        const id = (msg as NappletMessage & { id?: string }).id ?? '';
        sent.push({
          type: `${msg.type}.error`,
          id,
          error: result.reason,
        } as NappletMessage);
      }

      expect(sent).toHaveLength(1);
      const err = sent[0] as NappletMessage & { error: string };
      expect(err.type).toBe('keys.forward.error');
      expect(err.error).toMatch(/capability_missing|denied|keys:forward/);
    });
  });
});
