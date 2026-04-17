/**
 * keys-proxy.ts — Shell-side per-domain proxy for keys.* envelopes.
 *
 * Per Plan 12-05, the runtime already dispatches `keys.*` (forward,
 * registerAction, unregisterAction) to the keys-service. This proxy is the
 * shell-side composition point for host apps that want to observe or
 * inject keys envelopes — it pairs with `keys-forwarder.ts` (DRIFT-SHELL-06)
 * which covers the shell→napplet `keys.forward` push path.
 *
 * Shape mirrors identity-proxy (Plan 12-11 / DRIFT-SHELL-08):
 *
 *   - `dispatch(windowId, envelope)` routes napplet→shell keys requests
 *     into the runtime.
 *   - `emit(windowId, envelope)` posts shell→napplet pushes (`keys.action`,
 *     `keys.bindings`, `keys.registerAction.result`) through the origin
 *     registry.
 *
 * By default `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime owns keys.* dispatch. This module is an
 * optional composition point for host apps (e.g. global hotkey UIs).
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import type { ProxyOriginRegistry } from './identity-proxy.js';

/**
 * Dependencies for `createKeysProxy`.
 *
 * @example
 * ```ts
 * const proxy = createKeysProxy({
 *   runtime: shellBridge.runtime,
 *   originRegistry,
 * });
 * ```
 */
export interface KeysProxyDeps {
  /** The runtime engine that owns keys.* dispatch (Plan 12-05). */
  runtime: Runtime;
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: ProxyOriginRegistry;
}

/**
 * Per-domain proxy for `keys.*` envelopes.
 *
 * Shape: `dispatch` routes napplet→shell requests into the runtime; `emit`
 * pushes shell→napplet envelopes through the iframe's Window.
 */
export interface KeysProxy {
  /**
   * Route a napplet-originated keys.* envelope (e.g. `keys.forward`,
   * `keys.registerAction`) into the runtime.
   *
   * @param windowId - The source napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope
   */
  dispatch(windowId: string, envelope: NappletMessage): void;
  /**
   * Push a shell-initiated keys-domain envelope (e.g. `keys.action`,
   * `keys.bindings`) into a napplet iframe.
   *
   * Paired with `keys-forwarder.ts`: the forwarder targets the DOM
   * `keydown` → `keys.forward` path; this `emit` covers the complementary
   * host-initiated pushes (binding updates, action triggers).
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
 * Factory for the canonical keys-domain proxy.
 *
 * @param deps - Runtime + origin registry
 * @returns A {@link KeysProxy} ready to route keys.* envelopes
 * @example
 * ```ts
 * import { createKeysProxy, originRegistry, createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * const keysProxy = createKeysProxy({
 *   runtime: bridge.runtime,
 *   originRegistry,
 * });
 *
 * // Host-app-initiated action trigger:
 * keysProxy.emit('win-editor', { type: 'keys.action', actionId: 'editor.save' });
 * ```
 */
export function createKeysProxy(deps: KeysProxyDeps): KeysProxy {
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
