
import { createRuntime, type ConsentRequest, type Runtime } from '@kehto/runtime';
import { adaptHooks } from './hooks-adapter.js';
import { originRegistry } from './origin-registry.js';
import { nappKeyRegistry } from './session-registry.js';
import { aclStore } from './acl-store.js';
import { manifestCache } from './manifest-cache.js';
import { audioManager } from './audio-manager.js';
import type { NappletRevocationReason, ShellAdapter, UnroutedMessageInfo } from './types.js';
import type { NappletMessage } from '@napplet/core';
import type { Theme } from '@napplet/nap/theme/types';
import { createShellReadyState, handleShellReady, registerSourceSession } from './shell-ready.js';

/** The NIP-5D port handoff message type (nostr-protocol/nips#2303). */
export const NAPPLET_HELLO = 'napplet.hello';

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
/**
 * Fire the optional {@link ShellAdapter.onUnroutedMessage} diagnostic hook for a
 * message the bridge is about to drop. Extracts the envelope `type` defensively
 * (the message-shape guard hasn't run yet at the drop points) and never throws —
 * a misbehaving host hook must not break message handling.
 */
function reportUnrouted(
  hooks: ShellAdapter,
  event: MessageEvent,
  reason: UnroutedMessageInfo['reason'],
): void {
  if (!hooks.onUnroutedMessage) return;
  const data = event.data as { type?: unknown } | null | undefined;
  const type = typeof data === 'object' && data !== null && typeof data.type === 'string'
    ? data.type
    : undefined;
  try {
    hooks.onUnroutedMessage({ type, origin: event.origin, reason });
  } catch {
    // Observability must never break routing — swallow host hook errors.
  }
}

interface PortBinding {
  readonly port: MessagePort;
  readonly sourceWindow: Window;
  readonly origin: string;
  readonly registrationId: number;
}

const REVOCATION_DETAIL: Readonly<Record<NappletRevocationReason, string>> = {
  'window-message': 'A window-level message other than the single napplet.hello arrived from the frame',
  'second-hello': 'A second napplet.hello arrived from the frame',
  'invalid-hello': 'napplet.hello did not carry exactly one MessagePort',
  'second-load': 'The frame loaded a second document (navigation or reload)',
  'port-closed': 'The bound NIP-5D port closed or failed',
  host: 'The host revoked the napplet binding',
};

function isHello(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === NAPPLET_HELLO;
}

export function createShellBridge(hooks: ShellAdapter): ShellBridge {
  const shellReadyState = createShellReadyState();
  const bindings = new Map<string, PortBinding>();
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

  /** The live binding for a window; drops bindings whose port the host already unregistered. */
  function currentBinding(windowId: string): PortBinding | undefined {
    const binding = bindings.get(windowId);
    if (binding && originRegistry.getPort(windowId) !== binding.port) {
      binding.port.onmessage = null;
      bindings.delete(windowId);
      return undefined;
    }
    return binding;
  }

  function revokeNapplet(windowId: string, reason: NappletRevocationReason = 'host'): void {
    const binding = currentBinding(windowId);
    const registered = originRegistry.getIframeWindow(windowId) !== null;
    if (!binding && !registered) return;
    bindings.delete(windowId);
    if (binding) binding.port.onmessage = null;
    // Closes the port and marks the Window spent so it can never be re-bound.
    originRegistry.unregister(windowId);
    runtime.destroyWindow(windowId);
    runtime.sessionRegistry.unregister(windowId);
    shellReadyState.environments.delete(windowId);
    shellReadyState.sessionRegistration.delete(windowId);
    try {
      hooks.onNappletRevoked?.({ windowId, reason, detail: REVOCATION_DETAIL[reason] });
    } catch {
      // A misbehaving host hook must not keep a revoked binding alive.
    }
  }

  function dispatchEnvelope(windowId: string, binding: PortBinding, msg: unknown): void {
    // NIP-5D envelope-only guard (clean break — no legacy array support)
    if (typeof msg !== 'object' || msg === null || typeof (msg as { type?: unknown }).type !== 'string') return;
    const envelope = msg as NappletMessage;
    const context = {
      hooks,
      origin: binding.origin,
      runtime,
      state: shellReadyState,
      sourceRegistrationId: binding.registrationId,
      sourceWindow: binding.sourceWindow,
      windowId,
    };

    // Bind a known iframe to its verified creation identity before domain dispatch.
    if (!registerSourceSession(context)) return;

    // NAP-SHELL's optional readiness exchange is handled locally.
    if (envelope.type === 'shell.ready') {
      handleShellReady(context);
      return;
    }

    // Delegate to runtime — runtime handles NAP domain dispatch
    runtime.handleMessage(windowId, envelope);
  }

  function bindPort(windowId: string, sourceWindow: Window, origin: string, port: MessagePort): void {
    if (!originRegistry.bindPort(windowId, port)) {
      port.close();
      revokeNapplet(windowId, 'second-hello');
      return;
    }
    const binding: PortBinding = {
      port,
      sourceWindow,
      origin,
      registrationId: originRegistry.getRegistrationId(sourceWindow) ?? 0,
    };
    bindings.set(windowId, binding);
    const isCurrent = (): boolean => currentBinding(windowId) === binding;
    port.onmessage = (portEvent: MessageEvent) => {
      if (isCurrent()) dispatchEnvelope(windowId, binding, portEvent.data);
    };
    // A host that already unregistered the window closed this port itself;
    // isCurrent() is then false and the stale binding was dropped.
    const onPortFailure = (): void => {
      if (isCurrent()) revokeNapplet(windowId, 'port-closed');
    };
    port.addEventListener('close', onPortFailure);
    port.addEventListener('messageerror', onPortFailure);
    port.start();
  }

  return {
    handleMessage(event: MessageEvent): void {
      const sourceWindow = event.source as Window | null;
      if (!sourceWindow) {
        reportUnrouted(hooks, event, 'no-source-window');
        return;
      }
      const windowId = originRegistry.getWindowId(sourceWindow);
      if (!windowId) {
        reportUnrouted(hooks, event, 'unregistered-window');
        return;
      }

      // NIP-5D: napplet.hello is the only window-level message a napplet sends.
      if (currentBinding(windowId) || originRegistry.getPort(windowId)) {
        revokeNapplet(windowId, isHello(event.data) ? 'second-hello' : 'window-message');
        return;
      }
      if (!isHello(event.data)) {
        revokeNapplet(windowId, 'window-message');
        return;
      }
      const ports = event.ports ?? [];
      if (ports.length !== 1) {
        for (const port of ports) port.close();
        revokeNapplet(windowId, 'invalid-hello');
        return;
      }
      bindPort(windowId, sourceWindow, event.origin, ports[0]);
    },

    injectEvent(topic: string, payload: unknown): void {
      runtime.injectEvent(topic, payload);
    },

    destroy(): void {
      // Shutdown closes every bound port; those frames can never be re-bound.
      for (const [windowId, binding] of bindings) {
        binding.port.onmessage = null;
        if (originRegistry.getPort(windowId) === binding.port) originRegistry.unregister(windowId);
      }
      bindings.clear();
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

    observeFrame(frame, windowId): () => void {
      let loads = 0;
      const onLoad = (): void => {
        loads += 1;
        if (loads > 1) revokeNapplet(windowId, 'second-load');
      };
      frame.addEventListener('load', onLoad);
      return () => frame.removeEventListener('load', onLoad);
    },

    revokeNapplet,

    get runtime() {
      return runtime;
    },
  };
}
