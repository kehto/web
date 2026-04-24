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
import type { Theme } from '@napplet/nub/theme/types';
import type { NappletClass } from './types/provisional-class.js';
import { buildShellCapabilities } from './shell-init.js';
import { createKeysForwarder } from './keys-forwarder.js';
import type { KeysForwarder } from './keys-forwarder.js';

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
   * Publish a theme update to every registered napplet.
   *
   * Posts a `theme.changed` envelope (shell → napplet push) to every
   * window currently tracked by the runtime's sessionRegistry, using
   * the browser-adapter originRegistry to resolve windowId → iframe.
   * Napplets whose window cannot be resolved (stale sessions) are
   * silently skipped; this method never throws.
   *
   * ACL is enforced BY THE RECIPIENT NAPPLET — the runtime's
   * `themeMap` in @kehto/acl assigns `recipientCap: 'theme:read'` for
   * `theme.changed`, and @napplet/shim drops pushes the napplet lacks
   * the capability for. Hosts should not self-filter here.
   *
   * @param theme - The new theme payload to broadcast.
   * @example
   * ```ts
   * bridge.publishTheme({
   *   colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
   *   title: 'Dark',
   * });
   * ```
   */
  publishTheme(theme: Theme): void;

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

  // Attach the host-keydown forwarder (Plan 12-11 / NUB-05 shell half).
  // Skips construction in DOM-less environments (SSR / early Node tests);
  // any failure is swallowed so a malformed DOM never blocks bridge creation.
  let keysForwarder: KeysForwarder | null = null;
  if (typeof window !== 'undefined') {
    try {
      keysForwarder = createKeysForwarder({
        originRegistry,
        sessionRegistry,
        hasKeysForwardCap: (pubkey: string) => {
          const entry = sessionRegistry.getEntry(pubkey);
          if (!entry) return false;
          const acl = aclStore.getEntry(entry.pubkey, entry.dTag, entry.aggregateHash);
          return acl?.capabilities.includes('keys:forward') ?? false;
        },
      });
    } catch {
      // DOM present but addEventListener failed — proceed without the forwarder.
      keysForwarder = null;
    }
  }

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
        // CLASS-02: read resolved class from session entry (populated synchronously
        // at iframe creation by onNip5dIframeCreate's extended return type).
        // Fallback to null (permissive default, D2) for defensive safety — under
        // correct operation the session entry is always present by the time
        // shell.ready arrives (registration happens at iframe creation time).
        // No async class.assigned envelope is ever emitted (C-01 prevention).
        const sessionEntry = runtime.sessionRegistry.getEntryByWindowId(windowId);
        const resolvedClass: NappletClass = sessionEntry?.class ?? null;
        const initMsg: NappletMessage & {
          capabilities: ShellCapabilities;
          services: string[];
          class: NappletClass;
        } = {
          type: 'shell.init',
          capabilities,
          services: Object.keys(hooks.services ?? {}),
          class: resolvedClass,
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
      keysForwarder?.destroy();
      runtime.destroy();
    },

    registerConsentHandler(handler: (request: ConsentRequest) => void): void {
      runtime.registerConsentHandler(handler);
    },

    publishTheme(theme: Theme): void {
      const envelope: NappletMessage = { type: 'theme.changed', theme } as NappletMessage;
      // Use originRegistry.getAllWindowIds() rather than sessionRegistry.getAllEntries()
      // because demo napplets share pubkey:'' — the byPubkey map only retains one entry
      // per pubkey key, so getAllEntries() would return only the last-registered napplet
      // when multiple napplets have the same (empty) pubkey. originRegistry is keyed by
      // Window reference so it has one entry per distinct iframe regardless of pubkey.
      const windowIds = originRegistry.getAllWindowIds();
      for (const windowId of windowIds) {
        const win = originRegistry.getIframeWindow(windowId);
        if (!win) continue;
        win.postMessage(envelope, '*');
      }
    },

    get runtime() {
      return runtime;
    },
  };
}
