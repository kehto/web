import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createKeysService } from './keys-service.js';
import type { HostKeyEvent, HostKeysBridge } from './keys-service.js';

function createHarness(backend: 'document' | 'hostBridge') {
  const target = new EventTarget();
  const subscriptions = new Set<{
    chord: string;
    callback: (event: KeyboardEvent | HostKeyEvent) => void;
  }>();
  const unsubscribed = vi.fn();
  const bridge: HostKeysBridge = {
    subscribe(chord, callback) {
      const subscription = { chord, callback };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
        unsubscribed(chord);
      };
    },
  };
  const onForward = vi.fn();
  const service = createKeysService({
    listenerTarget: target,
    ...(backend === 'hostBridge' ? { hostBridge: bridge } : {}),
    reservedChords: ['Ctrl+R'],
    onForward,
  });
  const sent = new Map<string, NappletMessage[]>();
  function messages(windowId: string) {
    let result = sent.get(windowId);
    if (!result) {
      result = [];
      sent.set(windowId, result);
    }
    return result;
  }
  function send(windowId: string, message: NappletMessage) {
    service.handleMessage(windowId, message, (reply) => messages(windowId).push(reply));
  }
  function register(windowId: string, actionId = 'editor.save', defaultKey = 'Ctrl+S') {
    send(windowId, {
      type: 'keys.registerAction',
      id: `request-${actionId}`,
      action: { id: actionId, label: 'Save', defaultKey },
    } as NappletMessage);
  }
  function unregister(windowId: string, actionId = 'editor.save', claimedWindowId?: string) {
    send(windowId, {
      type: 'keys.unregisterAction',
      actionId,
      ...(claimedWindowId ? { windowId: claimedWindowId } : {}),
    } as NappletMessage);
  }
  function press(key = 's', repeat = false) {
    const event = {
      key, code: `Key${key.toUpperCase()}`, ctrlKey: true,
      altKey: false, shiftKey: false, metaKey: false, repeat,
    };
    if (backend === 'document') {
      target.dispatchEvent(Object.assign(new Event('keydown'), event));
    } else {
      for (const subscription of subscriptions) {
        if (subscription.chord === `Ctrl+${key.toUpperCase()}`) subscription.callback(event);
      }
    }
  }
  function clear() {
    for (const replies of sent.values()) replies.length = 0;
    onForward.mockClear();
  }
  return { service, register, unregister, press, clear, messages, onForward, subscriptions, unsubscribed, send, bridge };
}

// Kehto scopes action IDs to the trusted sending window under NAP-KEYS PR #9
// at cecb64257e0ac29926bb746832a477c553ab307c. The draft leaves uniqueness
// scope implicit; same-owner updates and nonexclusive chords are host policy.
describe.each(['document', 'hostBridge'] as const)('%s keys ownership', (backend) => {
  let h: ReturnType<typeof createHarness>;
  beforeEach(() => { h = createHarness(backend); });
  afterEach(() => { h.service.destroy(); });

  it('keeps duplicate action IDs on the same chord and echoes original wire IDs', () => {
    h.register('one');
    expect(h.messages('one')).toEqual([
      { type: 'keys.registerAction.result', id: 'request-editor.save', actionId: 'editor.save', binding: 'Ctrl+S' },
      { type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }] },
    ]);
    h.clear();
    h.register('two');
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([
      { type: 'keys.registerAction.result', id: 'request-editor.save', actionId: 'editor.save', binding: 'Ctrl+S' },
      { type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+S' }] },
    ]);
    h.clear();
    h.press();
    for (const windowId of ['one', 'two']) {
      expect(h.messages(windowId)).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    }
  });

  it('routes duplicate action IDs independently on different chords', () => {
    h.register('one');
    h.register('two', 'editor.save', 'Ctrl+P');
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('two')).toEqual([]);
    h.clear();
    h.press('p');
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('ignores an unowned unregister even when the payload claims the owner window', () => {
    h.register('owner');
    h.clear();
    h.unregister('other');
    h.unregister('other', 'editor.save', 'owner');
    expect(h.messages('owner')).toEqual([]);
    expect(h.messages('other')).toEqual([]);
    h.press();
    expect(h.messages('owner')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('unregisters only the caller and publishes only its remaining bindings', () => {
    h.register('one');
    h.register('one', 'editor.print', 'Ctrl+P');
    h.register('two');
    h.clear();
    h.unregister('one');
    expect(h.messages('one')).toEqual([
      { type: 'keys.bindings', bindings: [{ actionId: 'editor.print', key: 'Ctrl+P' }] },
    ]);
    expect(h.messages('two')).toEqual([]);
    h.clear();
    h.press();
    h.press('p');
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.print' }]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    h.clear();
    h.unregister('two');
    expect(h.messages('two')).toEqual([{ type: 'keys.bindings', bindings: [] }]);
    expect(h.messages('one')).toEqual([]);
  });

  it.each(['one', 'two'])('destroys and reloads %s without revoking the other window', (destroyed) => {
    const survivor = destroyed === 'one' ? 'two' : 'one';
    h.register('one');
    h.register('two');
    h.clear();
    h.service.onWindowDestroyed?.(destroyed);
    h.service.onWindowDestroyed?.(destroyed);
    h.press();
    expect(h.messages(destroyed)).toEqual([]);
    expect(h.messages(survivor)).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    h.register(destroyed);
    h.clear();
    h.press();
    expect(h.messages(destroyed)).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages(survivor)).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('rebinds within one window without changing the other registration', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.register('one', 'editor.save', 'Ctrl+P');
    expect(h.messages('two')).toEqual([]);
    expect(h.messages('one').at(-1)).toEqual({
      type: 'keys.bindings', bindings: [{ actionId: 'editor.save', key: 'Ctrl+P' }],
    });
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    h.clear();
    h.press('p');
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('two')).toEqual([]);
  });

  it('preserves a previous binding on invalid rebind without changing another window', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.register('one', 'editor.save', 'Ctrl+');
    expect(h.messages('one')).toHaveLength(1);
    expect(h.messages('one')[0]).toMatchObject({ type: 'keys.registerAction.result', error: expect.any(String) });
    expect(h.messages('two')).toEqual([]);
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('removes only the caller binding when rebinding to a reserved chord', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.register('one', 'editor.save', 'Ctrl+R');
    expect(h.messages('one')).toEqual([
      { type: 'keys.registerAction.result', id: 'request-editor.save', actionId: 'editor.save' },
      { type: 'keys.bindings', bindings: [] },
    ]);
    expect(h.messages('two')).toEqual([]);
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('preserves existing bindings when a repeated registration omits defaultKey', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.send('one', {
      type: 'keys.registerAction', id: 'no-default',
      action: { id: 'editor.save', label: 'Save' },
    } as NappletMessage);
    expect(h.messages('one')).toEqual([
      { type: 'keys.registerAction.result', id: 'no-default', actionId: 'editor.save' },
    ]);
    expect(h.messages('two')).toEqual([]);
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
  });

  it('forwards napplet key events without triggering registered actions', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.send('one', {
      type: 'keys.forward', key: 's', code: 'KeyS',
      ctrl: true, alt: false, shift: false, meta: false,
    } as NappletMessage);
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([]);
    expect(h.onForward).toHaveBeenCalledExactlyOnceWith({
      key: 's', code: 'KeyS', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    });
  });

  it.each([':', '\u0000', '/', ','])('does not confuse window/action pairs containing %j', (separator) => {
    const first = `window${separator}part`;
    const secondAction = `part${separator}action`;
    h.register(first, 'action');
    h.register('window', secondAction);
    h.clear();
    h.press();
    expect(h.messages(first)).toEqual([{ type: 'keys.action', actionId: 'action' }]);
    expect(h.messages('window')).toEqual([{ type: 'keys.action', actionId: secondAction }]);
    h.unregister(first, 'action');
    h.clear();
    h.press();
    expect(h.messages(first)).toEqual([]);
    expect(h.messages('window')).toEqual([{ type: 'keys.action', actionId: secondAction }]);
  });

  it('filters repeats and preserves forwarding behavior for each backend', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.press('s', true);
    expect(h.onForward).not.toHaveBeenCalled();
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([]);
    h.press();
    expect(h.onForward).toHaveBeenCalledTimes(backend === 'document' ? 1 : 2);
    expect(h.onForward).toHaveBeenCalledWith({
      key: 's', code: 'KeyS', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    });
  });

  it('removes all listeners/subscriptions exactly once on service destruction', () => {
    h.register('one');
    h.register('two');
    h.clear();
    h.service.destroy();
    h.service.destroy();
    h.press();
    expect(h.messages('one')).toEqual([]);
    expect(h.messages('two')).toEqual([]);
    expect(h.onForward).not.toHaveBeenCalled();
    if (backend === 'hostBridge') {
      expect(h.subscriptions.size).toBe(0);
      expect(h.unsubscribed).toHaveBeenCalledTimes(2);
    }
  });
});

it.each(['one', 'third'])('keeps live owners when bridge subscription for %s fails', (windowId) => {
  const h = createHarness('hostBridge');
  try {
    h.register('one');
    h.register('two');
    h.clear();
    vi.spyOn(h.bridge, 'subscribe').mockImplementationOnce(() => { throw new Error('unavailable'); });
    h.register(windowId, 'editor.save', 'Ctrl+P');
    expect(h.messages(windowId)).toEqual([{
      type: 'keys.registerAction.result', id: 'request-editor.save', actionId: 'editor.save',
      error: 'bridge subscribe failed: unavailable',
    }]);
    expect(h.messages('two')).toEqual([]);
    expect(h.unsubscribed).not.toHaveBeenCalled();
    h.clear();
    h.press();
    expect(h.messages('one')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('two')).toEqual([{ type: 'keys.action', actionId: 'editor.save' }]);
    expect(h.messages('third')).toEqual([]);
  } finally {
    h.service.destroy();
  }
});
