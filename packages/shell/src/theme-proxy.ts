/**
 * theme-proxy.ts — Shell-side per-domain proxy for theme.* envelopes.
 *
 * Establishes the shell-side shape that Phase 13 composes into. Phase 13 is
 * expected to add `theme-service.ts` (runtime) + the shell-side `theme.set`
 * API that emits `theme.changed` push envelopes to registered napplets;
 * this proxy is the canonical seam those pieces plug into.
 *
 * Shape mirrors identity-proxy (Plan 12-11):
 *
 *   - `dispatch(windowId, envelope)` routes napplet→shell `theme.get` into
 *     the runtime (where Phase 13's theme-service will answer).
 *   - `emit(windowId, envelope)` posts shell→napplet `theme.changed`
 *     envelopes through the origin registry.
 *
 * By default `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime owns theme.* dispatch. This module is an
 * optional composition point for host apps or Phase 13 wiring.
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import type { ProxyOriginRegistry } from './identity-proxy.js';

/**
 * Dependencies for `createThemeProxy`.
 *
 * @example
 * ```ts
 * const proxy = createThemeProxy({
 *   runtime: shellBridge.runtime,
 *   originRegistry,
 * });
 * ```
 */
export interface ThemeProxyDeps {
  /** The runtime engine that will own theme.* dispatch (Phase 13). */
  runtime: Runtime;
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: ProxyOriginRegistry;
}

/**
 * Per-domain proxy for `theme.*` envelopes.
 *
 * Shape: `dispatch` routes napplet→shell requests into the runtime; `emit`
 * pushes shell→napplet envelopes through the iframe's Window.
 */
export interface ThemeProxy {
  /**
   * Route a napplet-originated theme.* envelope (e.g. `theme.get`) into
   * the runtime.
   *
   * @param windowId - The source napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope
   */
  dispatch(windowId: string, envelope: NappletMessage): void;
  /**
   * Push a shell-initiated theme-domain envelope (e.g. `theme.changed`)
   * into a napplet iframe.
   *
   * No-op when the originRegistry cannot resolve the windowId (unknown or
   * unregistered napplet). Never throws.
   *
   * @param windowId - The target napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope to deliver
   */
  emit(windowId: string, envelope: NappletMessage): void;
}

/**
 * Factory for the canonical theme-domain proxy.
 *
 * @param deps - Runtime + origin registry
 * @returns A {@link ThemeProxy} ready to route theme.* envelopes
 * @example
 * ```ts
 * import { createThemeProxy, originRegistry, createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * const themeProxy = createThemeProxy({
 *   runtime: bridge.runtime,
 *   originRegistry,
 * });
 *
 * // Phase 13: broadcast theme.changed to every registered napplet
 * for (const entry of bridge.runtime.sessionRegistry.getAllEntries()) {
 *   themeProxy.emit(entry.windowId, { type: 'theme.changed', theme: newTheme });
 * }
 * ```
 */
export function createThemeProxy(deps: ThemeProxyDeps): ThemeProxy {
  return {
    dispatch(windowId: string, envelope: NappletMessage): void {
      deps.runtime.handleMessage(windowId, envelope);
    },
    emit(windowId: string, envelope: NappletMessage): void {
      const win = deps.originRegistry.getIframeWindow(windowId);
      if (win) win.postMessage(envelope, '*');
    },
  };
}
