/**
 * shell-bridge.ts — Browser adapter over @kehto/runtime.
 *
 * Thin shell that converts browser MessageEvents into windowId-based
 * NIP-5D envelope messages for the runtime engine. All protocol logic
 * (NUB dispatch, ACL enforcement, subscription lifecycle, signer proxying)
 * lives in @kehto/runtime.
 *
 * The only browser-specific concern here is extracting the source Window
 * from a MessageEvent, mapping it to a windowId via originRegistry, and
 * routing shell.ready/shell.init handshake locally.
 */

import { createRuntime } from '@kehto/runtime';
import type { Runtime, ConsentHandler, ConsentRequest } from '@kehto/runtime';
import { adaptHooks } from './hooks-adapter.js';
import { originRegistry } from './origin-registry.js';
import { sessionRegistry, nappKeyRegistry } from './session-registry.js';
import { aclStore } from './acl-store.js';
import { manifestCache } from './manifest-cache.js';
import { audioManager } from './audio-manager.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';
import type { NappletMessage } from '@napplet/core';
import { buildShellCapabilities } from './shell-init.js';

// ─── Public interface ────────────────────────────────────────────────────────

/**
 * Shell-side message bridge that handles NIP-5D communication with napplet iframes.
 *
 * The bridge acts as a browser adapter: it receives raw MessageEvents from
 * window.addEventListener('message', ...), extracts the source Window, resolves
 * it to a windowId via originRegistry, and delegates NIP-5D envelope messages
 * to the runtime engine. The shell.ready/shell.init capability handshake is
 * handled locally within the bridge and never forwarded to the runtime.
 *
 * @example
 * ```ts
 * import { createShellBridge } from '@kehto/shell';
 *
 * const bridge = createShellBridge(hooks);
 * window.addEventListener('message', bridge.handleMessage);
 * ```
 */
export interface ShellBridge {
  /**
   * Handle an incoming postMessage from a napplet iframe.
   *
   * Only NIP-5D envelope objects (plain objects with a `.type` string) are
   * accepted. NIP-01 arrays and all other message shapes are silently dropped
   * (clean break — no legacy array fallback).
   *
   * shell.ready messages are handled locally: the bridge responds with shell.init
   * containing the capability set and registered service list. All other envelopes
   * are delegated to the runtime's NUB domain dispatch.
   *
   * @param event - The raw MessageEvent from window.addEventListener('message', ...)
   * @example
   * ```ts
   * window.addEventListener('message', bridge.handleMessage);
   * ```
   */
  handleMessage(event: MessageEvent): void;

  /**
   * Inject a shell-originated event into subscription delivery.
   *
   * Under NIP-5D, shell-originated events are forwarded to napplets as
   * ifc.event envelope messages. The runtime's injectEvent() handles
   * the per-session routing.
   *
   * @param topic - The event topic tag value (e.g., 'auth:identity-changed')
   * @param payload - The event content
   * @example
   * ```ts
   * bridge.injectEvent('auth:identity-changed', { pubkey: userPubkey });
   * ```
   */
  injectEvent(topic: string, payload: unknown): void;

  /**
   * Destroy the bridge instance, cleaning up all internal state.
   * Persists manifest cache and clears all subscriptions, buffers, and registries.
   * Call when the shell is shutting down or the bridge is no longer needed.
   *
   * @example
   * ```ts
   * bridge.destroy();
   * ```
   */
  destroy(): void;

  /**
   * Register a handler for consent requests on destructive signing kinds.
   * Called when a napplet requests signing for kinds 0, 3, 5, or 10002.
   *
   * @param handler - Callback receiving the consent request with a resolve function
   * @example
   * ```ts
   * bridge.registerConsentHandler((request) => {
   *   const allowed = confirm(`Allow signing kind ${request.event.kind}?`);
   *   request.resolve(allowed);
   * });
   * ```
   */
  registerConsentHandler(handler: (request: ConsentRequest) => void): void;

  /**
   * Access the underlying runtime instance for advanced use cases.
   * Provides direct access to the runtime's sessionRegistry, aclState,
   * and manifestCache.
   */
  readonly runtime: Runtime;
}

/**
 * Create a ShellBridge instance with dependency injection via hooks.
 *
 * Internally creates a Runtime from @kehto/runtime and adapts the
 * browser-oriented ShellAdapter into environment-agnostic RuntimeAdapter.
 *
 * @param hooks - Host application provides relay pool, auth, config, etc.
 * @returns A ShellBridge instance ready to handle napplet messages
 * @example
 * ```ts
 * import { createShellBridge, type ShellAdapter } from '@kehto/shell';
 *
 * const hooks: ShellAdapter = {
 *   relayPool: myRelayPoolHooks,
 *   relayConfig: myRelayConfigHooks,
 *   windowManager: myWindowManagerHooks,
 *   auth: myAuthHooks,
 *   config: myConfigHooks,
 *   hotkeys: myHotkeyHooks,
 *   workerRelay: myWorkerRelayHooks,
 *   crypto: myCryptoHooks,
 * };
 * const bridge = createShellBridge(hooks);
 * ```
 */
export function createShellBridge(hooks: ShellAdapter): ShellBridge {
  const runtimeHooks = adaptHooks(hooks, {
    originRegistry,
    manifestCache,
    aclStore,
    audioManager,
    nappKeyRegistry,
  });

  const runtime: Runtime = createRuntime(runtimeHooks);

  return {
    handleMessage(event: MessageEvent): void {
      const sourceWindow = event.source as Window | null;
      if (!sourceWindow) return;
      const windowId = originRegistry.getWindowId(sourceWindow);
      if (!windowId) return;
      const msg = event.data;

      // NIP-5D envelope-only guard (clean break — no legacy array support)
      if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return;

      // Handle shell.ready handshake locally (not forwarded to runtime)
      if (msg.type === 'shell.ready') {
        const capabilities = buildShellCapabilities(hooks);
        const initMsg: NappletMessage & { capabilities: ShellCapabilities; services: string[] } = {
          type: 'shell.init',
          capabilities,
          services: Object.keys(hooks.services ?? {}),
        };
        const win = originRegistry.getIframeWindow(windowId);
        if (win) win.postMessage(initMsg, '*');
        return;
      }

      // Delegate to runtime — runtime handles NUB domain dispatch
      runtime.handleMessage(windowId, msg);
    },

    injectEvent(topic: string, payload: unknown): void {
      runtime.injectEvent(topic, payload);
    },

    destroy(): void {
      runtime.destroy();
    },

    registerConsentHandler(handler: (request: ConsentRequest) => void): void {
      runtime.registerConsentHandler(handler);
    },

    get runtime() {
      return runtime;
    },
  };
}
