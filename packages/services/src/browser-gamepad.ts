/** Browser-owned controller reader and focus/visibility notifications. */
import type { GamepadServiceOptions } from './gamepad-service.js';

/**
 * Bind one host document's native controllers to its registered input owner.
 * @param host Browser host window; omitted on non-browser hosts.
 * @param resolveWindow Resolve an iframe's trusted creation-time window identity.
 * @returns Native-reader and lifecycle hooks for createGamepadService.
 * @example const service = createGamepadService(browserGamepadOptions(window));
 */
export function browserGamepadOptions(host?: Window, resolveWindow: (target: Window) => string | undefined = () => undefined): GamepadServiceOptions {
  if (!host) return {};
  const doc = host.document;
  const nav = host.navigator;
  return {
    readGamepads: typeof nav.getGamepads === 'function' ? () => nav.getGamepads() : undefined,
    getFocusedWindow: () => {
      const active = doc.activeElement;
      if (!active || active.tagName !== 'IFRAME') return null;
      const target = (active as HTMLIFrameElement).contentWindow;
      return target ? resolveWindow(target) ?? null : null;
    },
    isHostActive: () => doc.visibilityState !== 'hidden' && doc.hasFocus(),
    requestFrame: typeof host.requestAnimationFrame === 'function' ? (callback) => host.requestAnimationFrame(callback) : undefined,
    cancelFrame: (frame) => host.cancelAnimationFrame(frame),
    subscribeChanges(refresh) {
      const windowEvents = ['focus', 'blur', 'gamepadconnected', 'gamepaddisconnected'];
      const documentEvents = ['focusin', 'focusout', 'visibilitychange'];
      for (const type of windowEvents) host.addEventListener(type, refresh);
      for (const type of documentEvents) doc.addEventListener(type, refresh);
      return () => {
        for (const type of windowEvents) host.removeEventListener(type, refresh);
        for (const type of documentEvents) doc.removeEventListener(type, refresh);
      };
    },
  };
}
