/**
 * keys-service.test.ts — Unit tests for the keys NAP reference service.
 */

import { describe, it, expect } from 'vitest';
import { createKeysService } from './keys-service.js';
import type { NappletMessage } from '@napplet/core';
import type { HostKeysBridge, HostKeyEvent } from './keys-service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';

/**
 * Create a mock EventTarget that records addEventListener / removeEventListener
 * calls. Mirrors the pattern used by packages/shell/src/keys-forwarder.test.ts.
 */
function createMockTarget(): EventTarget & {
  _listeners: Array<{ ev: string; fn: EventListener }>;
  _removedCount: number;
} {
  const listeners: Array<{ ev: string; fn: EventListener }> = [];
  let removed = 0;
  const target = new EventTarget();
  const origAdd = target.addEventListener.bind(target);
  const origRemove = target.removeEventListener.bind(target);
  target.addEventListener = ((ev: string, fn: EventListenerOrEventListenerObject) => {
    listeners.push({ ev, fn: fn as EventListener });
    origAdd(ev, fn);
  }) as EventTarget['addEventListener'];
  target.removeEventListener = ((ev: string, fn: EventListenerOrEventListenerObject) => {
    removed++;
    origRemove(ev, fn);
  }) as EventTarget['removeEventListener'];
  const decorated = target as EventTarget & {
    _listeners: Array<{ ev: string; fn: EventListener }>;
    _removedCount: number;
  };
  decorated._listeners = listeners;
  Object.defineProperty(decorated, '_removedCount', {
    configurable: true,
    enumerable: true,
    get: (): number => removed,
  });
  return decorated;
}

/**
 * Dispatch a synthetic keydown event on the given target. Uses KeyboardEvent
 * when available (jsdom/happy-dom/browser envs) and falls back to a plain
 * Event with the key/modifier fields pinned on top (Node-only vitest env).
 */
function dispatchChord(
  target: EventTarget,
  init: {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    repeat?: boolean;
  },
): void {
  if (typeof KeyboardEvent !== 'undefined') {
    const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    return;
  }
  const ev = new Event('keydown') as Event & {
    key: string;
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    repeat: boolean;
  };
  ev.key = init.key;
  ev.code = init.code ?? '';
  ev.ctrlKey = init.ctrlKey ?? false;
  ev.altKey = init.altKey ?? false;
  ev.shiftKey = init.shiftKey ?? false;
  ev.metaKey = init.metaKey ?? false;
  ev.repeat = init.repeat ?? false;
  target.dispatchEvent(ev);
}

function messageType(message: NappletMessage): string {
  return (message as NappletMessage & { type: string }).type;
}

function keysActionEnvelopes(sent: NappletMessage[]): NappletMessage[] {
  return sent.filter((m) => messageType(m) === 'keys.action');
}

function keysBindingsEnvelopes(sent: NappletMessage[]): NappletMessage[] {
  return sent.filter((m) => messageType(m) === 'keys.bindings');
}

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
    it('produces keys.registerAction.result and pushes keys.bindings for defaultKey bindings', () => {
      const sent: NappletMessage[] = [];
      const service = createKeysService();

      const msg: NappletMessage = {
        type: 'keys.registerAction',
        id: 'r1',
        action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
      } as NappletMessage;

      service.handleMessage(WINDOW_ID, msg, (m) => sent.push(m));

      expect(sent).toHaveLength(2);
      const reply = sent[0] as NappletMessage & { id: string; actionId: string; binding?: string };
      expect(reply.type).toBe('keys.registerAction.result');
      expect(reply.id).toBe('r1');
      expect(reply.actionId).toBe('editor.save');
      expect(reply.binding).toBe('Ctrl+S');

      expect(sent[1]).toEqual({
        type: 'keys.bindings',
        bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }],
      });
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

    it('dispatches keys.action when a forwarded chord matches a registered action', () => {
      const sent: NappletMessage[] = [];
      const received: Array<Record<string, unknown>> = [];
      const service = createKeysService({
        onForward: (event) => received.push(event as unknown as Record<string, unknown>),
      });

      service.handleMessage(
        'win-1',
        {
          type: 'keys.registerAction',
          id: 'reg-1',
          action: { id: 'game.a', label: 'A', defaultKey: 'x' },
        } as NappletMessage,
        (message) => sent.push(message),
      );

      service.handleMessage(
        'win-1',
        {
          type: 'keys.forward',
          key: 'x',
          code: 'KeyX',
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
        } as NappletMessage,
        (message) => sent.push(message),
      );

      expect(received).toHaveLength(1);
      expect(keysBindingsEnvelopes(sent)).toEqual([
        {
          type: 'keys.bindings',
          bindings: [{ actionId: 'game.a', key: 'x' }],
        },
      ]);
      expect(keysActionEnvelopes(sent)).toEqual([
        {
          type: 'keys.action',
          actionId: 'game.a',
          chord: { ctrl: false, alt: false, shift: false, meta: false, key: 'X' },
        },
      ]);

      service.destroy();
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
      // using the same composition logic runtime.ts uses after enforceNap returns
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

// ─── Plan 26-01 additions: real document-listener path ──────────────────────

describe('document keydown subscription (real listener path)', () => {
  it('fires onForward AND pushes keys.action envelope when a subscribed chord matches a keydown', () => {
    const target = createMockTarget();
    const received: Array<Record<string, unknown>> = [];
    const sent: NappletMessage[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-sub-1',
        action: { id: 'demo.chord', label: 'Demo', defaultKey: 'Ctrl+Shift+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    // First envelopes sent are registerAction.result and the current bindings list.
    expect(sent).toHaveLength(2);
    expect((sent[0] as NappletMessage & { type: string }).type).toBe('keys.registerAction.result');
    expect((sent[1] as NappletMessage & { type: string }).type).toBe('keys.bindings');

    dispatchChord(target, { key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true });

    // onForward called once with DOM-shape payload.
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });

    // keys.action pushed to the owning napplet's send callback.
    expect(sent).toHaveLength(3);
    const action = sent[2] as NappletMessage & {
      type: string;
      actionId?: string;
      chord?: Record<string, unknown>;
    };
    expect(action.type).toBe('keys.action');
    expect(action.actionId).toBe('demo.chord');
    expect(action.chord).toMatchObject({
      ctrl: true,
      shift: true,
      alt: false,
      meta: false,
      key: 'K',
    });

    service.destroy();
  });

  it('does not fire onForward or emit keys.action when modifiers do not match', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    dispatchChord(target, { key: 'k', code: 'KeyK', shiftKey: true }); // no Ctrl
    expect(received).toHaveLength(0);
    // Registration/result/bindings only — no keys.action push.
    expect(
      sent.filter((m) => (m as NappletMessage & { type: string }).type === 'keys.action'),
    ).toHaveLength(0);

    service.destroy();
  });

  it('ignores OS-autorepeat keydowns (event.repeat=true) — no onForward, no keys.action', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    dispatchChord(target, { key: 'k', code: 'KeyK', ctrlKey: true, repeat: true });
    expect(received).toHaveLength(0);
    expect(
      sent.filter((m) => (m as NappletMessage & { type: string }).type === 'keys.action'),
    ).toHaveLength(0);

    service.destroy();
  });

  it('case-insensitive modifier + key parsing (ctrl+s matches Ctrl+S)', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'ctrl+s' },
      } as NappletMessage,
      () => {},
    );
    dispatchChord(target, { key: 'S', code: 'KeyS', ctrlKey: true });
    expect(received).toHaveLength(1);

    service.destroy();
  });

  it('Cmd alias maps to meta modifier', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Cmd+P' },
      } as NappletMessage,
      () => {},
    );
    dispatchChord(target, { key: 'p', code: 'KeyP', metaKey: true });
    expect(received).toHaveLength(1);

    service.destroy();
  });
});

describe('keys.unregisterAction clears the subscription (no onForward, no keys.action)', () => {
  it('does not fire onForward or emit keys.action after unregisterAction', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const sent: NappletMessage[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.unregisterAction',
        actionId: 'a',
      } as NappletMessage,
      () => {},
    );
    dispatchChord(target, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(received).toHaveLength(0);
    expect(
      sent.filter((m) => (m as NappletMessage & { type: string }).type === 'keys.action'),
    ).toHaveLength(0);

    service.destroy();
  });

  it('pushes an updated empty keys.bindings list after unregisterAction removes the window binding', () => {
    const sent: NappletMessage[] = [];
    const service = createKeysService();

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.unregisterAction',
        actionId: 'a',
      } as NappletMessage,
      (m) => sent.push(m),
    );

    expect(keysBindingsEnvelopes(sent)).toEqual([
      {
        type: 'keys.bindings',
        bindings: [{ actionId: 'a', key: 'Ctrl+K' }],
      },
      {
        type: 'keys.bindings',
        bindings: [],
      },
    ]);
  });
});

describe('onWindowDestroyed cleans up subscriptions for that window only', () => {
  it("removes only the destroyed window's actions + send handle; other windows continue firing + receiving keys.action", () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const sentA: NappletMessage[] = [];
    const sentB: NappletMessage[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });
    service.handleMessage(
      'win-A',
      {
        type: 'keys.registerAction',
        id: 'rA',
        action: { id: 'a-action', label: 'A', defaultKey: 'Ctrl+A' },
      } as NappletMessage,
      (m) => sentA.push(m),
    );
    service.handleMessage(
      'win-B',
      {
        type: 'keys.registerAction',
        id: 'rB',
        action: { id: 'b-action', label: 'B', defaultKey: 'Ctrl+B' },
      } as NappletMessage,
      (m) => sentB.push(m),
    );

    service.onWindowDestroyed!('win-A');

    dispatchChord(target, { key: 'a', code: 'KeyA', ctrlKey: true });
    expect(received).toHaveLength(0); // win-A's action gone
    expect(
      sentA.filter((m) => (m as NappletMessage & { type: string }).type === 'keys.action'),
    ).toHaveLength(0);

    dispatchChord(target, { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(received).toHaveLength(1); // win-B still active
    expect(
      sentB.filter((m) => (m as NappletMessage & { type: string }).type === 'keys.action'),
    ).toHaveLength(1);

    service.destroy();
  });
});

describe('destroy() detaches the listener', () => {
  it('removeEventListener is called and onForward stops firing after destroy', () => {
    const target = createMockTarget();
    const received: unknown[] = [];
    const service = createKeysService({
      listenerTarget: target,
      onForward: (e) => received.push(e),
    });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      () => {},
    );

    service.destroy();

    dispatchChord(target, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(received).toHaveLength(0);
    // Verify listener was removed via the mock target's counter.
    expect((target as unknown as { _removedCount: number })._removedCount).toBeGreaterThanOrEqual(
      1,
    );
  });
});

describe('invalid chord handling', () => {
  it('emits keys.registerAction.error when defaultKey has an unknown modifier', () => {
    const target = createMockTarget();
    const sent: NappletMessage[] = [];
    const service = createKeysService({ listenerTarget: target });
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-bad',
        action: { id: 'bad.action', label: 'Bad', defaultKey: 'Bogus+X' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    expect(sent).toHaveLength(1);
    const reply = sent[0] as NappletMessage & { error?: string };
    expect(reply.type).toBe('keys.registerAction.error');
    expect(reply.error).toMatch(/invalid chord|unknown modifier/i);

    service.destroy();
  });
});

// ─── Plan 26-02 additions: HostKeysBridge delegation path ───────────────────

describe('HostKeysBridge integration', () => {
  // Fake bridge helper that records every subscribe call and lets tests invoke callbacks.
  function createFakeBridge() {
    const subscriptions: Array<{
      chord: string;
      callback: (ev: HostKeyEvent) => void;
      unsubscribed: boolean;
    }> = [];
    const bridge: HostKeysBridge = {
      subscribe(chord, callback) {
        const entry = {
          chord,
          callback: callback as (ev: HostKeyEvent) => void,
          unsubscribed: false,
        };
        subscriptions.push(entry);
        return () => {
          entry.unsubscribed = true;
        };
      },
      // registerGlobalHotkey / onGlobalHotkey intentionally omitted — matches the
      // "optional fields absent in browser impl" contract from CONTEXT.md Area 2.
    };
    return { bridge, subscriptions };
  }

  it('bridge.subscribe is called with the chord string on keys.registerAction', () => {
    const { bridge, subscriptions } = createFakeBridge();
    const sent: NappletMessage[] = [];
    const service = createKeysService({ hostBridge: bridge });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'b-1',
        action: { id: 'editor.save', label: 'Save', defaultKey: 'Ctrl+S' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].chord).toBe('Ctrl+S');
    expect(sent).toHaveLength(2);
    expect((sent[0] as NappletMessage & { type: string }).type).toBe('keys.registerAction.result');
    expect((sent[1] as NappletMessage & { type: string }).type).toBe('keys.bindings');
  });

  it('hostBridge path dispatches keys.action when a forwarded chord matches a registered action', () => {
    const { bridge } = createFakeBridge();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      hostBridge: bridge,
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'b-forward',
        action: { id: 'editor.find', label: 'Find', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.forward',
        key: 'k',
        code: 'KeyK',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage,
      (m) => sent.push(m),
    );

    expect(received).toHaveLength(1);
    expect(keysActionEnvelopes(sent)).toEqual([
      {
        type: 'keys.action',
        actionId: 'editor.find',
        chord: { ctrl: true, alt: false, shift: false, meta: false, key: 'K' },
      },
    ]);
  });

  it('bridge callback fans into onForward with DOM-shape fields', () => {
    const { bridge, subscriptions } = createFakeBridge();
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      hostBridge: bridge,
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'b-2',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      () => {},
    );

    subscriptions[0].callback({
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ key: 'k', code: 'KeyK', ctrlKey: true });
  });

  it('unsubscribe handle is invoked on keys.unregisterAction', () => {
    const { bridge, subscriptions } = createFakeBridge();
    const service = createKeysService({ hostBridge: bridge });

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'b-3',
        action: { id: 'a', label: 'A', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      () => {},
    );

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.unregisterAction',
        actionId: 'a',
      } as NappletMessage,
      () => {},
    );

    expect(subscriptions[0].unsubscribed).toBe(true);
  });

  it('hostBridge path bypasses the default document listener', () => {
    // Mock target that records every addEventListener call.
    const target = new EventTarget();
    let attachCount = 0;
    const origAdd = target.addEventListener.bind(target);
    target.addEventListener = ((ev: string, fn: EventListenerOrEventListenerObject) => {
      if (ev === 'keydown') attachCount++;
      origAdd(ev, fn);
    }) as EventTarget['addEventListener'];

    const { bridge } = createFakeBridge();
    createKeysService({ hostBridge: bridge, listenerTarget: target });

    expect(attachCount).toBe(0); // Zero keydown listeners attached when hostBridge is provided
  });

  it('onWindowDestroyed invokes every stored unsubscribe for that window only', () => {
    const { bridge, subscriptions } = createFakeBridge();
    const service = createKeysService({ hostBridge: bridge });

    service.handleMessage(
      'win-A',
      {
        type: 'keys.registerAction',
        id: 'bA',
        action: { id: 'aA', label: 'A', defaultKey: 'Ctrl+A' },
      } as NappletMessage,
      () => {},
    );
    service.handleMessage(
      'win-B',
      {
        type: 'keys.registerAction',
        id: 'bB',
        action: { id: 'aB', label: 'B', defaultKey: 'Ctrl+B' },
      } as NappletMessage,
      () => {},
    );

    service.onWindowDestroyed!('win-A');

    expect(subscriptions[0].unsubscribed).toBe(true); // win-A's subscription unsubscribed
    expect(subscriptions[1].unsubscribed).toBe(false); // win-B's subscription still live
  });
});

// ─── Plan 33-01 additions: reserved-chord surface (KEYS-04, KEYS-05) ────────

describe('reserved chords', () => {
  // Local helper: re-create the createFakeBridge pattern from the
  // HostKeysBridge integration block above (line 568). Kept inline to avoid
  // cross-block helper plumbing — mirrors the existing style where each
  // describe block localizes its fixtures.
  function createFakeBridge() {
    const subscriptions: Array<{
      chord: string;
      callback: (ev: HostKeyEvent) => void;
      unsubscribed: boolean;
    }> = [];
    const bridge: HostKeysBridge = {
      subscribe(chord, callback) {
        const entry = {
          chord,
          callback: callback as (ev: HostKeyEvent) => void,
          unsubscribed: false,
        };
        subscriptions.push(entry);
        return () => {
          entry.unsubscribed = true;
        };
      },
    };
    return { bridge, subscriptions };
  }

  it('Test 1 (Branch B, reserved path on keys.forward): onForward fires; zero keys.action envelopes even when a napplet registered the same chord', () => {
    const target = createMockTarget();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      listenerTarget: target,
      reservedChords: ['Ctrl+Shift+R'],
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    } as Parameters<typeof createKeysService>[0]);

    // Reservation landed with a minor version bump — pin the contract at the test layer.
    expect(service.descriptor.version).toBe('1.3.0');

    // Napplet claims the same chord — reservation should NOT block registration.
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-1',
        action: { id: 'conflict', label: 'C', defaultKey: 'Ctrl+Shift+R' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    // Sanity: registerAction.result still fires (reservation doesn't reject registration).
    expect(sent).toHaveLength(2);
    expect((sent[0] as NappletMessage & { type: string }).type).toBe('keys.registerAction.result');
    expect((sent[1] as NappletMessage & { type: string }).type).toBe('keys.bindings');

    // Napplet forwards the reserved chord via keys.forward.
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.forward',
        key: 'R',
        code: 'KeyR',
        ctrl: true,
        alt: false,
        shift: true,
        meta: false,
      } as NappletMessage,
      (m) => sent.push(m),
    );

    // onForward fires once with DOM-shape payload.
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      key: 'R',
      code: 'KeyR',
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    });
    // Zero keys.action envelopes (reservation suppresses napplet fan-out).
    expect(keysActionEnvelopes(sent)).toHaveLength(0);

    service.destroy();
  });

  it('Test 2 (Branch B, non-reserved registered forward): onForward fires and keys.action is dispatched', () => {
    const target = createMockTarget();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      listenerTarget: target,
      reservedChords: ['Ctrl+Shift+R'],
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    } as Parameters<typeof createKeysService>[0]);
    expect(service.descriptor.version).toBe('1.3.0');

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-2',
        action: { id: 'editor.find', label: 'Find', defaultKey: 'Ctrl+K' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    // Forward a registered, non-reserved chord (Ctrl+K, not in reservedChords).
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.forward',
        key: 'K',
        code: 'KeyK',
        ctrl: true,
        alt: false,
        shift: false,
        meta: false,
      } as NappletMessage,
      (m) => sent.push(m),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ key: 'K', ctrlKey: true, shiftKey: false });
    expect(keysActionEnvelopes(sent)).toEqual([
      {
        type: 'keys.action',
        actionId: 'editor.find',
        chord: { ctrl: true, alt: false, shift: false, meta: false, key: 'K' },
      },
    ]);

    service.destroy();
  });

  it('Test 3 (Branch B, document keydown on reserved chord suppresses keys.action to napplet)', () => {
    const target = createMockTarget();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      listenerTarget: target,
      reservedChords: ['Ctrl+Shift+R'],
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    } as Parameters<typeof createKeysService>[0]);
    expect(service.descriptor.version).toBe('1.3.0');

    // Napplet registers the same chord via keys.registerAction.
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-3',
        action: { id: 'conflict', label: 'C', defaultKey: 'Ctrl+Shift+R' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    // Dispatch synthetic keydown matching Ctrl+Shift+R via the document listener.
    dispatchChord(target, { key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true });

    // onForward fires once (shell WANTS the forward — that's why it reserved).
    expect(received).toHaveLength(1);
    // Zero keys.action envelopes — reservation gate short-circuited napplet dispatch.
    expect(keysActionEnvelopes(sent)).toHaveLength(0);

    service.destroy();
  });

  it('Test 4 (Branch A / hostBridge, reserved chord on keys.forward): onForward fires, zero keys.action; bridge.subscribe still invoked on registration', () => {
    const { bridge, subscriptions } = createFakeBridge();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      hostBridge: bridge,
      reservedChords: ['Ctrl+Shift+R'],
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    } as Parameters<typeof createKeysService>[0]);
    expect(service.descriptor.version).toBe('1.3.0');

    // Napplet registers the reserved chord — reservation should not block registration.
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-4',
        action: { id: 'conflict', label: 'C', defaultKey: 'Ctrl+Shift+R' },
      } as NappletMessage,
      (m) => sent.push(m),
    );
    // bridge.subscribe was called for this chord.
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].chord).toBe('Ctrl+Shift+R');

    // Napplet forwards the reserved chord via keys.forward.
    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.forward',
        key: 'R',
        code: 'KeyR',
        ctrl: true,
        alt: false,
        shift: true,
        meta: false,
      } as NappletMessage,
      (m) => sent.push(m),
    );

    // onForward fires once with DOM-shape payload.
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      key: 'R',
      code: 'KeyR',
      ctrlKey: true,
      shiftKey: true,
    });
    // Zero keys.action envelopes — Branch A reservation gate documented + enforced.
    expect(keysActionEnvelopes(sent)).toHaveLength(0);
  });

  it('Test 5 (normalization parity): case-insensitive + Cmd alias match reserved set', () => {
    // Sub-case A: lowercase reservation matches uppercase forward.
    {
      const target = createMockTarget();
      const received: Array<Record<string, unknown>> = [];
      const service = createKeysService({
        listenerTarget: target,
        reservedChords: ['ctrl+k'],
        onForward: (e) => received.push(e as unknown as Record<string, unknown>),
      } as Parameters<typeof createKeysService>[0]);
      expect(service.descriptor.version).toBe('1.3.0');

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'keys.forward',
          key: 'K',
          code: 'KeyK',
          ctrl: true,
          alt: false,
          shift: false,
          meta: false,
        } as NappletMessage,
        () => {},
      );
      expect(received).toHaveLength(1);
      service.destroy();
    }

    // Sub-case B: Cmd alias maps to meta on forward payload.
    {
      const target = createMockTarget();
      const received: Array<Record<string, unknown>> = [];
      const service = createKeysService({
        listenerTarget: target,
        reservedChords: ['Cmd+K'],
        onForward: (e) => received.push(e as unknown as Record<string, unknown>),
      } as Parameters<typeof createKeysService>[0]);

      service.handleMessage(
        WINDOW_ID,
        {
          type: 'keys.forward',
          key: 'K',
          code: 'KeyK',
          ctrl: false,
          alt: false,
          shift: false,
          meta: true,
        } as NappletMessage,
        () => {},
      );
      expect(received).toHaveLength(1);
      service.destroy();
    }
  });

  it('Test 6 (empty reservedChords): legacy behavior preserved — registered napplet still receives keys.action on document keydown', () => {
    const target = createMockTarget();
    const sent: NappletMessage[] = [];
    const received: Array<Record<string, unknown>> = [];
    const service = createKeysService({
      listenerTarget: target,
      reservedChords: [],
      onForward: (e) => received.push(e as unknown as Record<string, unknown>),
    } as Parameters<typeof createKeysService>[0]);
    expect(service.descriptor.version).toBe('1.3.0');

    service.handleMessage(
      WINDOW_ID,
      {
        type: 'keys.registerAction',
        id: 'r-6',
        action: { id: 'legacy', label: 'L', defaultKey: 'Ctrl+Shift+R' },
      } as NappletMessage,
      (m) => sent.push(m),
    );

    dispatchChord(target, { key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true });

    // Legacy behavior: onForward fires AND napplet receives keys.action.
    expect(received).toHaveLength(1);
    expect(keysActionEnvelopes(sent)).toHaveLength(1);
    const action = keysActionEnvelopes(sent)[0] as NappletMessage & { actionId: string };
    expect(action.actionId).toBe('legacy');

    service.destroy();
  });
});
