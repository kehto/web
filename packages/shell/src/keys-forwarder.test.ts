/**
 * keys-forwarder.test.ts — Coverage for the shell-side host-keydown forwarder
 * established by Plan 12-11 (NUB-05 shell-side half).
 *
 * Verifies three behaviours:
 *   1. A keydown on the attached EventTarget posts a `keys.forward` envelope
 *      into every registered napplet whose ACL grants `keys:forward`.
 *   2. Napplets without the `keys:forward` cap receive NOTHING.
 *   3. After `destroy()`, further keydowns invoke nothing.
 */

import { describe, it, expect, vi } from 'vitest';
import { createKeysForwarder } from './keys-forwarder.js';
import type { SessionEntry } from './types.js';

// ─── Stubs ───────────────────────────────────────────────────────────────────

function makeSessionEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    pubkey: 'pk1',
    windowId: 'win-1',
    origin: '*',
    type: 'chat',
    dTag: 'd1',
    aggregateHash: 'h1',
    registeredAt: 0,
    instanceId: 'inst-1',
    provenance: 'nip-5d',
    class: null, // CLASS-02: permissive default for test fixtures
    ...overrides,
  };
}

/** Minimal EventTarget implementation — Node's built-in EventTarget is fine. */
function makeTarget(): EventTarget {
  return new EventTarget();
}

/** Dispatch a synthetic keydown event on the given target. */
function dispatchKeydown(
  target: EventTarget,
  init: {
    key: string;
    code: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  },
): void {
  // Node's Event class doesn't carry key fields; we fabricate a KeyboardEvent-
  // shaped object on top of a plain Event and dispatch it. The forwarder reads
  // fields off the event object directly.
  const ev = new Event('keydown') as Event & {
    key: string; code: string;
    ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean;
  };
  ev.key = init.key;
  ev.code = init.code;
  ev.ctrlKey = init.ctrlKey ?? false;
  ev.altKey = init.altKey ?? false;
  ev.shiftKey = init.shiftKey ?? false;
  ev.metaKey = init.metaKey ?? false;
  target.dispatchEvent(ev);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('keys-forwarder (Plan 12-11, NUB-05 shell-side)', () => {
  it('posts keys.forward envelopes to napplets that hold the keys:forward cap', () => {
    const target = makeTarget();
    const iframe = { postMessage: vi.fn() };
    const forwarder = createKeysForwarder({
      target,
      originRegistry: { getIframeWindow: () => iframe as unknown as Window },
      sessionRegistry: { getAllEntries: () => [makeSessionEntry()] },
      hasKeysForwardCap: () => true,
    });

    dispatchKeydown(target, { key: 's', code: 'KeyS', ctrlKey: true });

    expect(iframe.postMessage).toHaveBeenCalledTimes(1);
    const [envelope, targetOrigin] = iframe.postMessage.mock.calls[0];
    expect(targetOrigin).toBe('*');
    expect(envelope).toMatchObject({
      type: 'keys.forward',
      key: 's',
      code: 'KeyS',
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    });

    forwarder.destroy();
  });

  it('does NOT forward to napplets without the keys:forward cap', () => {
    const target = makeTarget();
    const iframe = { postMessage: vi.fn() };
    const forwarder = createKeysForwarder({
      target,
      originRegistry: { getIframeWindow: () => iframe as unknown as Window },
      sessionRegistry: { getAllEntries: () => [makeSessionEntry()] },
      hasKeysForwardCap: () => false,
    });

    dispatchKeydown(target, { key: 'a', code: 'KeyA' });

    expect(iframe.postMessage).not.toHaveBeenCalled();

    forwarder.destroy();
  });

  it('destroy() removes the keydown listener so later events are ignored', () => {
    const target = makeTarget();
    const iframe = { postMessage: vi.fn() };
    const forwarder = createKeysForwarder({
      target,
      originRegistry: { getIframeWindow: () => iframe as unknown as Window },
      sessionRegistry: { getAllEntries: () => [makeSessionEntry()] },
      hasKeysForwardCap: () => true,
    });

    forwarder.destroy();
    dispatchKeydown(target, { key: 'z', code: 'KeyZ' });

    expect(iframe.postMessage).not.toHaveBeenCalled();
  });

  it('skips napplets whose windowId does not resolve to an iframe Window', () => {
    const target = makeTarget();
    const forwarder = createKeysForwarder({
      target,
      originRegistry: { getIframeWindow: () => null },
      sessionRegistry: { getAllEntries: () => [makeSessionEntry()] },
      hasKeysForwardCap: () => true,
    });

    // Must not throw — the forwarder silently skips unresolved windows.
    expect(() => dispatchKeydown(target, { key: 'q', code: 'KeyQ' })).not.toThrow();

    forwarder.destroy();
  });
});
