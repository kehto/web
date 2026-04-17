/**
 * identity-proxy.ts — Shell-side per-domain proxy for identity.* envelopes.
 *
 * Establishes the canonical proxy shape for @kehto/shell (Plan 12-11 /
 * DRIFT-SHELL-08): each per-domain proxy exposes a `dispatch` method that
 * delegates napplet→shell requests to the runtime and an `emit` method that
 * posts shell→napplet push envelopes through the origin registry.
 *
 * By default, `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime already owns identity.* dispatch per Plan
 * 12-03 (see @kehto/services identity-service). This module exists as an
 * optional composition point for host apps that want to intercept or
 * augment identity dispatch (e.g. custom logging, sandboxed rewrites, test
 * doubles).
 *
 * The canonical proxy shape — dispatch + emit — is mirrored verbatim by
 * theme-proxy, keys-proxy, media-proxy, and notify-proxy. Storage today is
 * served by `@kehto/runtime` state-handler directly; a storage-proxy using
 * this shape can be added later if host apps need a composition seam.
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';

/**
 * Minimal origin-registry contract used by per-domain proxies.
 *
 * Accepts the `@kehto/shell` singleton `originRegistry` as well as any test
 * double with a matching `getIframeWindow` method.
 */
export interface ProxyOriginRegistry {
  /** Resolve a registered napplet windowId to its iframe Window, or null. */
  getIframeWindow(windowId: string): Window | null;
}

/**
 * Dependencies for `createIdentityProxy`.
 *
 * @example
 * ```ts
 * const proxy = createIdentityProxy({
 *   runtime: shellBridge.runtime,
 *   originRegistry,
 * });
 * ```
 */
export interface IdentityProxyDeps {
  /** The runtime engine that owns identity.* dispatch (Plan 12-03). */
  runtime: Runtime;
  /** Origin registry for resolving windowId → iframe Window. */
  originRegistry: ProxyOriginRegistry;
}

/**
 * Per-domain proxy for `identity.*` envelopes.
 *
 * The canonical proxy shape: `dispatch` routes napplet→shell requests into
 * the runtime; `emit` pushes shell→napplet envelopes through the iframe's
 * Window.
 */
export interface IdentityProxy {
  /**
   * Route a napplet-originated identity.* envelope into the runtime.
   *
   * Delegation only — the runtime already owns identity.* dispatch after
   * Plan 12-03. Override by wrapping or replacing this method.
   *
   * @param windowId - The source napplet's windowId
   * @param envelope - The NIP-5D NappletMessage envelope
   */
  dispatch(windowId: string, envelope: NappletMessage): void;
  /**
   * Push a shell-initiated identity-domain envelope into a napplet iframe.
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
 * Factory for the canonical identity-domain proxy.
 *
 * @param deps - Runtime + origin registry
 * @returns An {@link IdentityProxy} ready to route identity.* envelopes
 * @example
 * ```ts
 * import { createIdentityProxy, originRegistry, createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * const identityProxy = createIdentityProxy({
 *   runtime: bridge.runtime,
 *   originRegistry,
 * });
 *
 * // Optional composition: intercept napplet->shell identity requests
 * const originalDispatch = identityProxy.dispatch;
 * identityProxy.dispatch = (windowId, envelope) => {
 *   console.log('identity dispatch', windowId, envelope.type);
 *   originalDispatch(windowId, envelope);
 * };
 * ```
 */
export function createIdentityProxy(deps: IdentityProxyDeps): IdentityProxy {
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
