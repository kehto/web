/**
 * identity-proxy.ts — Shell-side per-domain proxy for identity.* envelopes.
 *
 * Establishes the canonical proxy shape for @kehto/shell (Plan 12-11): each
 * per-domain proxy exposes a `dispatch` method that delegates napplet→shell
 * requests to the runtime.
 *
 * By default, `createShellBridge()` does NOT compose this proxy into its
 * dispatch path — the runtime already owns identity.* dispatch per Plan
 * 12-03 (see @kehto/services identity-service). This module exists as an
 * optional composition point for host apps that want to intercept or
 * augment identity dispatch (e.g. custom logging, sandboxed rewrites, test
 * doubles).
 *
 * Identity changes are deliberately not emitted through this proxy. Hosts
 * must use `ShellBridge.publishIdentityChanged()`, which enforces the live
 * session, granted-domain, and current recipient-capability checks.
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
 * `dispatch` routes napplet→shell requests into the runtime. The deprecated
 * `emit` member remains only as a fail-closed compatibility trap.
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
   * Direct identity delivery is prohibited.
   *
   * @deprecated Use `ShellBridge.publishIdentityChanged()` so delivery is
   * filtered by live session, granted domain, and current ACL.
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
    emit(_windowId: string, _envelope: NappletMessage): void {
      throw new Error(
        'Direct identity proxy emit is prohibited; use ShellBridge.publishIdentityChanged()',
      );
    },
  };
}
