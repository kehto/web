/**
 * media-proxy.ts — Shell-side per-domain proxy for media.* envelopes.
 *
 * Establishes the shell-side composition seam for `@napplet/nub-media`
 * session-control envelopes. Shape mirrors identity-proxy (Plan 12-11):
 *
 *   - `dispatch(windowId, envelope)` routes napplet→shell media requests
 *     (`media.session.create`, `media.session.update`, `media.session.destroy`,
 *     `media.state`, `media.capabilities`) into the runtime (Plan 12-06).
 *   - `emit(windowId, envelope)` posts shell→napplet pushes (`media.command`,
 *     `media.controls`, `media.session.create.result`) through the origin
 *     registry.
 *
 * By default `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime owns media.* dispatch. This module is an
 * optional composition point for host apps (e.g. shell-rendered playback
 * UIs that want to send `media.command` pushes).
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import type { ProxyOriginRegistry } from './identity-proxy.js';

/**
 * Dependencies for `createMediaProxy`.
 *
 * @example
 * ```ts
 * const proxy = createMediaProxy({
 *   runtime: shellBridge.runtime,
 *   originRegistry,
 * });
 * ```
 */
export interface MediaProxyDeps {
  /** The runtime engine that owns media.* dispatch (Plan 12-06). */
  runtime: Runtime;
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: ProxyOriginRegistry;
}

/**
 * Per-domain proxy for `media.*` envelopes.
 *
 * Shape: `dispatch` routes napplet→shell requests into the runtime; `emit`
 * pushes shell→napplet envelopes through the iframe's Window.
 */
export interface MediaProxy {
  /**
   * Route a napplet-originated media.* envelope into the runtime.
   *
   * @param windowId - The source napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope
   */
  dispatch(windowId: string, envelope: NappletMessage): void;
  /**
   * Push a shell-initiated media-domain envelope (e.g. `media.command`,
   * `media.controls`) into a napplet iframe.
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
 * Factory for the canonical media-domain proxy.
 *
 * @param deps - Runtime + origin registry
 * @returns A {@link MediaProxy} ready to route media.* envelopes
 * @example
 * ```ts
 * import { createMediaProxy, originRegistry, createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * const mediaProxy = createMediaProxy({
 *   runtime: bridge.runtime,
 *   originRegistry,
 * });
 *
 * // Shell-UI-initiated media command:
 * mediaProxy.emit('win-player', {
 *   type: 'media.command',
 *   sessionId: 's1',
 *   action: 'seek',
 *   value: 120,
 * });
 * ```
 */
export function createMediaProxy(deps: MediaProxyDeps): MediaProxy {
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
