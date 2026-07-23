/**
 * theme-proxy.ts — Shell-side per-domain proxy for theme.* envelopes.
 *
 * Establishes the shell-side shape that Phase 13 composes into. Phase 13 is
 * expected to add `theme-service.ts` (runtime) + the shell-side `theme.set`
 * API that emits `theme.changed` push envelopes to registered napplets;
 * this proxy is the canonical seam those pieces plug into.
 *
 * `dispatch(windowId, envelope)` routes napplet→shell `theme.get` into the
 * runtime. Theme changes must use `ShellBridge.publishTheme()` so the host
 * projection enforces live-session, granted-domain, and current-ACL checks.
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
 * `dispatch` routes napplet→shell requests into the runtime. The deprecated
 * `emit` member remains only as a fail-closed compatibility trap.
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
   * Direct theme delivery is prohibited.
   *
   * @deprecated Use `ShellBridge.publishTheme()` so delivery is filtered by
   * live session, granted domain, and current ACL.
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
 * import { createThemeProxy, originRegistry } from '@kehto/shell';
 *
 * const themeProxy = createThemeProxy({
 *   runtime,
 *   originRegistry,
 * });
 * themeProxy.dispatch(windowId, { type: 'theme.get', id: requestId });
 * ```
 */
export function createThemeProxy(deps: ThemeProxyDeps): ThemeProxy {
  return {
    dispatch(windowId: string, envelope: NappletMessage): void {
      deps.runtime.handleMessage(windowId, envelope);
    },
    emit(_windowId: string, _envelope: NappletMessage): void {
      throw new Error(
        'Direct theme proxy emit is prohibited; use ShellBridge.publishTheme()',
      );
    },
  };
}
