
import { createRuntime, type ConsentRequest, type Runtime } from '@kehto/runtime';
import { adaptHooks } from './hooks-adapter.js';
import { originRegistry } from './origin-registry.js';
import { nappKeyRegistry } from './session-registry.js';
import { aclStore } from './acl-store.js';
import { manifestCache } from './manifest-cache.js';
import { audioManager } from './audio-manager.js';
import type { NappletRevocationReason, ShellAdapter } from './types.js';
import type { NappletMessage } from '@napplet/core';
import type { Theme } from '@napplet/nap/theme/types';
import { createShellReadyState } from './shell-ready.js';
import { createNip5dTransport } from './nip5d-transport.js';

export { MAX_DEFERRED_MESSAGES, NAPPLET_HELLO } from './nip5d-transport.js';

/**
 * Shell-side message bridge that handles NIP-5D communication with napplet iframes.
 *
 * NIP-5D binds napplet identity to a `MessagePort`, not to the iframe Window:
 * the injected bootstrap transfers one port to the shell in a single
 * window-level `napplet.hello`. The bridge accepts that hello only from the
 * `contentWindow` of a registered iframe carrying exactly one port, binds the
 * frame's verified `(dTag, aggregateHash)` to the port, and then processes NAP
 * envelopes only from that port and replies only over it. A second hello, any
 * other window-level message, an invalid hello, a second iframe `load`
 * ({@link ShellBridge.observeFrame}) or the port closing revokes the binding,
 * its sessions and grants, and asks the host to remove the frame through
 * `ShellAdapter.onNappletRevoked`. The shell.ready/shell.init capability
 * handshake is handled locally within the bridge and never forwarded to the
 * runtime.
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
   * Handle a window-level message from a napplet iframe.
   *
   * The only window-level message a napplet may send is its single
   * `napplet.hello` carrying exactly one `MessagePort`. The bridge binds that
   * port and receives every later NAP envelope from it. Any other window-level
   * message from a registered iframe, a second hello, or a hello without
   * exactly one port revokes the frame. Messages from unregistered sources are
   * dropped.
   *
   * On the bound port, only NIP-5D envelope objects (plain objects with a
   * `.type` string) are accepted. shell.ready is handled locally (the bridge
   * answers with shell.init over the port); all other envelopes are delegated
   * to the runtime's NAP domain dispatch.
   *
   * @param event - The raw MessageEvent from window.addEventListener('message', ...)
   * @example
   * ```ts
   * window.addEventListener('message', bridge.handleMessage);
   * ```
   */
  handleMessage(event: MessageEvent): void;

  /**
   * Inject a shell-originated event into subscription delivery. Under NIP-5D,
   * shell-originated events are forwarded to napplets as inc.event envelope
   * messages. The runtime's injectEvent() handles the per-session routing.
   *
   * v1.10 hard-removed the v1.8 soft-rename compatibility branch for the
   * old `auth:identity-changed` topic. Use the canonical `identity:changed`
   * topic for identity-change pushes.
   *
   * @param topic - The event topic tag value. Forwarded exactly once.
   * @param payload - The event content
   * @example
   * ```ts
   * bridge.injectEvent('identity:changed', { pubkey: userPubkey });
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
   * Publish a theme update to each eligible napplet.
   *
   * Posts a `theme.changed` envelope (shell → napplet push) to every
   * live authenticated session whose frozen environment grants `theme` and
   * whose current ACL grants `theme:read`. Stale or ineligible sessions are
   * skipped before origin-registry delivery; recipient code is not trusted
   * to enforce host authorization.
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
   * Publish the current shell-user identity to every loaded napplet.
   *
   * Posts an `identity.changed` envelope (shell → napplet push) with the
   * current user pubkey. An empty pubkey means no signer/user identity is
   * currently connected. This is distinct from NIP-5D napplet session identity,
   * which remains source-bound at iframe creation.
   *
   * @param pubkey - Current user's hex pubkey, or empty string when signed out.
   */
  publishIdentityChanged(pubkey: string): void;

  /**
   * Watch a napplet iframe for a second `load`, which NIP-5D treats as
   * evidence that the verified document was replaced. Call after the frame is
   * in the DOM and before assigning its `srcdoc`/`src`.
   *
   * @param frame - The shell-created napplet iframe
   * @param windowId - The windowId registered for this frame
   * @returns A function that stops watching
   * @example
   * ```ts
   * document.body.append(frame);
   * originRegistry.register(frame.contentWindow!, windowId, identity);
   * const stop = bridge.observeFrame(frame, windowId);
   * frame.srcdoc = verifiedSrcdoc;
   * ```
   */
  observeFrame(frame: Pick<HTMLIFrameElement, 'addEventListener' | 'removeEventListener'>, windowId: string): () => void;

  /**
   * Revoke one napplet binding: close its port, unregister it, destroy its
   * sessions and subscriptions, and call `ShellAdapter.onNappletRevoked` so
   * the host removes the frame. No-op for unknown windows.
   *
   * @param windowId - The window to revoke
   * @param reason - Why the binding is revoked (defaults to `host`)
   * @example
   * ```ts
   * bridge.revokeNapplet(windowId);
   * ```
   */
  revokeNapplet(windowId: string, reason?: NappletRevocationReason): void;

  /**
   * Dispatch the envelopes `ShellAdapter.filterNappletMessage` deferred for a
   * window, in arrival order and without asking the filter again. ACL, firewall
   * approvals and budgets run at release, so held requests can prompt or be refused
   * then, and a source retired meanwhile runs nothing. Revoking a binding discards
   * what it held.
   *
   * @param windowId - The napplet window to release
   * @returns How many envelopes were dispatched
   * @example
   * ```ts
   * bridge.releaseDeferred(windowId);
   * ```
   */
  releaseDeferred(windowId: string): number;

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
  const shellReadyState = createShellReadyState();
  const runtimeHooks = adaptHooks(hooks, {
    originRegistry,
    manifestCache,
    aclStore,
    audioManager,
    nappKeyRegistry,
  });

  const runtime: Runtime = createRuntime({
    ...runtimeHooks,
    isDomainAllowed: shellReadyState.isDomainAllowed,
  });

  function publishToEligibleNapplets(
    envelope: NappletMessage,
    domain: 'identity' | 'theme',
    capability: 'identity:read' | 'theme:read',
  ): void {
    // A session exists only after shell.ready. Iterate entries, not a pubkey
    // lookup, because different live windows may legitimately share pubkey ''.
    for (const entry of runtime.sessionRegistry.getAllEntries()) {
      const environment = shellReadyState.environments.get(entry.windowId);
      if (!environment?.capabilities.domains.includes(domain)) continue;
      if (!runtime.aclState.check(entry.pubkey, entry.dTag, entry.aggregateHash, capability)) continue;
      originRegistry.postToNapplet(entry.windowId, envelope);
    }
  }

  const transport = createNip5dTransport({ hooks, runtime, state: shellReadyState });

  return {
    handleMessage: transport.handleMessage,

    injectEvent(topic: string, payload: unknown): void {
      runtime.injectEvent(topic, payload);
    },

    destroy(): void {
      transport.destroy();
      runtime.destroy();
      shellReadyState.clear();
    },

    registerConsentHandler(handler: (request: ConsentRequest) => void): void {
      runtime.registerConsentHandler(handler);
    },

    publishTheme(theme: Theme): void {
      const envelope: NappletMessage = { type: 'theme.changed', theme } as NappletMessage;
      publishToEligibleNapplets(envelope, 'theme', 'theme:read');
    },

    publishIdentityChanged(pubkey: string): void {
      const envelope: NappletMessage = { type: 'identity.changed', pubkey } as NappletMessage;
      publishToEligibleNapplets(envelope, 'identity', 'identity:read');
    },

    observeFrame: transport.observeFrame,

    revokeNapplet: transport.revokeNapplet,
    releaseDeferred: transport.releaseDeferred,

    get runtime() {
      return runtime;
    },
  };
}
