/**
 * notify-proxy.ts — Shell-side per-domain proxy for notify.* envelopes.
 *
 * Establishes the shell-side composition seam for `@napplet/nub-notify`
 * notification envelopes. Shape mirrors identity-proxy (Plan 12-11 /
 * DRIFT-SHELL-08):
 *
 *   - `dispatch(windowId, envelope)` routes napplet→shell notify requests
 *     (`notify.send`, `notify.dismiss`, `notify.badge`,
 *     `notify.channel.register`, `notify.permission.request`) into the
 *     runtime (Plan 12-07).
 *   - `emit(windowId, envelope)` posts shell→napplet pushes
 *     (`notify.send.result`, `notify.permission.result`, `notify.action`,
 *     `notify.clicked`, `notify.dismissed`, `notify.controls`) through the
 *     origin registry.
 *
 * By default `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime owns notify.* dispatch. This module is an
 * optional composition point for host apps (e.g. custom notification UIs
 * that need to emit `notify.clicked` / `notify.action` pushes).
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import type { ProxyOriginRegistry } from './identity-proxy.js';

/**
 * Dependencies for `createNotifyProxy`.
 *
 * @example
 * ```ts
 * const proxy = createNotifyProxy({
 *   runtime: shellBridge.runtime,
 *   originRegistry,
 * });
 * ```
 */
export interface NotifyProxyDeps {
  /** The runtime engine that owns notify.* dispatch (Plan 12-07). */
  runtime: Runtime;
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: ProxyOriginRegistry;
}

/**
 * Per-domain proxy for `notify.*` envelopes.
 *
 * Shape: `dispatch` routes napplet→shell requests into the runtime; `emit`
 * pushes shell→napplet envelopes through the iframe's Window.
 */
export interface NotifyProxy {
  /**
   * Route a napplet-originated notify.* envelope into the runtime.
   *
   * @param windowId - The source napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope
   */
  dispatch(windowId: string, envelope: NappletMessage): void;
  /**
   * Push a shell-initiated notify-domain envelope (e.g. `notify.action`,
   * `notify.clicked`) into a napplet iframe.
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
 * Factory for the canonical notify-domain proxy.
 *
 * @param deps - Runtime + origin registry
 * @returns A {@link NotifyProxy} ready to route notify.* envelopes
 * @example
 * ```ts
 * import { createNotifyProxy, originRegistry, createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * const notifyProxy = createNotifyProxy({
 *   runtime: bridge.runtime,
 *   originRegistry,
 * });
 *
 * // Shell-UI notifies napplet that user clicked its toast:
 * notifyProxy.emit('win-chat', {
 *   type: 'notify.clicked',
 *   notificationId: 'shell-42',
 * });
 * ```
 */
export function createNotifyProxy(deps: NotifyProxyDeps): NotifyProxy {
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
