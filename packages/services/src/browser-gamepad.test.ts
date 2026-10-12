import { describe, expect, it, vi } from 'vitest';
import { browserGamepadOptions } from './browser-gamepad.js';

describe('browser controller lifecycle hooks', () => {
  it('uses native receiver, trusted iframe identity, host visibility and focus', () => {
    const target = {} as Window;
    const navigator = { getGamepads() { expect(this).toBe(navigator); return []; } };
    const document = { activeElement: { tagName: 'IFRAME', contentWindow: target }, visibilityState: 'visible', hasFocus: vi.fn(() => true) };
    const host = { navigator, document } as unknown as Window;
    const resolve = vi.fn(() => 'registered');
    const options = browserGamepadOptions(host, resolve);
    expect(options.readGamepads!()).toEqual([]);
    expect(options.getFocusedWindow!()).toBe('registered');
    expect(resolve).toHaveBeenCalledWith(target);
    expect(options.isHostActive!()).toBe(true);
    document.visibilityState = 'hidden'; expect(options.isHostActive!()).toBe(false);
    document.visibilityState = 'visible'; document.hasFocus.mockReturnValue(false); expect(options.isHostActive!()).toBe(false);
    document.activeElement.tagName = 'BUTTON'; expect(options.getFocusedWindow!()).toBeNull();
    expect(browserGamepadOptions()).toEqual({});
  });
  it('observes focus, visibility and connection changes and detaches every listener', () => {
    const windowListeners = new Map<string, () => void>(); const documentListeners = new Map<string, () => void>();
    const host = { navigator: {}, document: { addEventListener: (type: string, handler: () => void) => documentListeners.set(type, handler), removeEventListener: (type: string) => documentListeners.delete(type) }, addEventListener: (type: string, handler: () => void) => windowListeners.set(type, handler), removeEventListener: (type: string) => windowListeners.delete(type) } as unknown as Window;
    const options = browserGamepadOptions(host);
    expect(options.readGamepads).toBeUndefined();
    const refresh = vi.fn(); const detach = options.subscribeChanges!(refresh);
    for (const type of ['focus', 'blur', 'gamepadconnected', 'gamepaddisconnected']) windowListeners.get(type)!();
    for (const type of ['focusin', 'focusout', 'visibilitychange']) documentListeners.get(type)!();
    expect(refresh).toHaveBeenCalledTimes(7);
    detach(); expect(windowListeners.size + documentListeners.size).toBe(0);
  });
});
