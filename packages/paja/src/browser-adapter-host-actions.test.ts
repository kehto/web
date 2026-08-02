import { afterEach, describe, expect, it, vi } from 'vitest';

import { forwardPajaHotkey, openPajaExternalLink } from './browser-adapter.js';

describe('Paja host actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens only web URLs in an opener-isolated browser context', () => {
    const open = vi.fn(() => ({ closed: false }));
    vi.stubGlobal('window', { open });

    expect(openPajaExternalLink(new URL('https://example.test/article'))).toBe(true);
    expect(open).toHaveBeenCalledWith(
      'https://example.test/article',
      '_blank',
      'noopener,noreferrer',
    );

    expect(openPajaExternalLink(new URL('file:///etc/passwd'))).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('reports a failed browser navigation handoff', () => {
    vi.stubGlobal('window', {
      open: vi.fn(() => {
        throw new Error('blocked');
      }),
    });

    expect(openPajaExternalLink(new URL('https://example.test/blocked'))).toBe(false);
  });

  it('reports an accepted handoff even when opener isolation hides the new context', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });

    expect(openPajaExternalLink(new URL('https://example.test/article'))).toBe(true);
  });

  it('dispatches forwarded NAP-KEYS events in the host context', () => {
    const dispatchEvent = vi.fn();
    class TestKeyboardEvent {
      constructor(
        readonly type: string,
        readonly init: KeyboardEventInit,
      ) {}
    }
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('KeyboardEvent', TestKeyboardEvent);

    forwardPajaHotkey({
      key: 'j',
      code: 'KeyJ',
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'keydown',
      init: {
        key: 'j',
        code: 'KeyJ',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
      },
    });
  });
});
