/**
 * NIP-5D port-bound transport for ShellBridge (nostr-protocol/nips#2303 at
 * 51ef0cd33a5694784306f3260d90b1872545fdee, packaged by napplet/web#302).
 *
 * A napplet's injected bootstrap transfers one MessagePort in a single
 * window-level `napplet.hello`. The shell binds the registered identity to
 * that port, dispatches NAP only from it, and revokes the binding on any
 * evidence that the verified document was replaced.
 *
 * @module
 */

import type { Runtime } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { originRegistry } from './origin-registry.js';
import { handleShellReady, registerSourceSession, type ShellReadyState } from './shell-ready.js';
import type { NappletRevocationReason, ShellAdapter, UnroutedMessageInfo } from './types.js';

/** The NIP-5D port handoff message type (nostr-protocol/nips#2303). */
export const NAPPLET_HELLO = 'napplet.hello';

/** Dependencies of {@link createNip5dTransport}. */
export interface Nip5dTransportOptions {
  readonly hooks: ShellAdapter;
  readonly runtime: Runtime;
  readonly state: ShellReadyState;
}

/** The transport surface ShellBridge exposes. */
export interface Nip5dTransport {
  handleMessage(event: MessageEvent): void;
  revokeNapplet(windowId: string, reason?: NappletRevocationReason): void;
  observeFrame(frame: Pick<HTMLIFrameElement, 'addEventListener' | 'removeEventListener'>, windowId: string): () => void;
  destroy(): void;
}

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

/**
 * Create the port-bound transport for one bridge/runtime pair.
 *
 * @param options - Host hooks, runtime and NAP-SHELL readiness state
 * @returns The transport surface
 * @example
 * ```ts
 * const transport = createNip5dTransport({ hooks, runtime, state });
 * window.addEventListener('message', transport.handleMessage);
 * ```
 */
export function createNip5dTransport({ hooks, runtime, state: shellReadyState }: Nip5dTransportOptions): Nip5dTransport {
  const bindings = new Map<string, PortBinding>();

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
    try {
      hooks.onNappletMessage?.(windowId, envelope);
    } catch {
      // Observability must never break routing — swallow host hook errors.
    }
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

  function handleMessage(event: MessageEvent): void {
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
  }

  function observeFrame(frame: Pick<HTMLIFrameElement, 'addEventListener' | 'removeEventListener'>, windowId: string): () => void {
    let loads = 0;
    const onLoad = (): void => {
      loads += 1;
      if (loads > 1) revokeNapplet(windowId, 'second-load');
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }

  function destroy(): void {
    // Shutdown closes every bound port; those frames can never be re-bound.
    for (const [windowId, binding] of bindings) {
      binding.port.onmessage = null;
      if (originRegistry.getPort(windowId) === binding.port) originRegistry.unregister(windowId);
    }
    bindings.clear();
  }

  return { handleMessage, revokeNapplet, observeFrame, destroy };
}
