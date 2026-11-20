
import type { NappletMessage } from '@napplet/core';
import type { ServiceRegistry, SendToNapplet } from './types.js';

/**
 * Route a NappletMessage envelope to the matching service handler.
 *
 * Direct NAP-domain services are routed by the domain in their wire
 * message.type (e.g., 'notify.send' -> 'notify' service). INC messages
 * are owned by the INC runtime; their topic values are opaque here.
 *
 * This low-level selection primitive performs no source, domain, ACL,
 * messageCapabilities, or firewall checks. Never call it as a fallback for
 * untrusted input; host ingress must use Runtime.handleMessage.
 * Returns true if a service handled the message, false otherwise.
 *
 * @param windowId - The napplet window that sent the message
 * @param message - The NappletMessage envelope to route
 * @param services - The service registry to look up handlers
 * @param sendToNapplet - Callback to send messages back to the napplet
 * @returns true if a service handled the message, false if no matching service
 *
 * @example
 * ```ts
 * const handled = routeServiceMessage(windowId, msg, services, sendToNapplet);
 * if (!handled) { // fallback handling }
 * ```
 */
export function routeServiceMessage(
  windowId: string,
  message: NappletMessage,
  services: ServiceRegistry,
  sendToNapplet: SendToNapplet,
): boolean {
  // INC emissions belong exclusively to the INC runtime.
  if (message.type === 'inc.emit') return false;

  // Direct services route by their exact wire type domain.
  const domain = message.type.split('.')[0];
  const handler = Object.hasOwn(services, domain) ? services[domain] : undefined;
  if (handler) {
    handler.handleMessage(windowId, message, (msg) => sendToNapplet(windowId, msg));
    return true;
  }

  return false;
}

/**
 * Notify all registered service handlers that a napplet window was destroyed.
 * Calls onWindowDestroyed() on every handler that implements it.
 * This is a raw broadcaster with no deduplication; `Runtime` itself notifies
 * through a per-registration tracker so services hear one destroy per session
 * registration (kehto/web#498).
 * Errors in individual handlers are caught and silently ignored to prevent
 * one service's cleanup failure from blocking others.
 *
 * @param windowId - The destroyed napplet's window identifier
 * @param services - The service registry containing all handlers
 *
 * @example
 * ```ts
 * notifyServiceWindowDestroyed('window-1', services);
 * ```
 */
export function notifyServiceWindowDestroyed(
  windowId: string,
  services: ServiceRegistry,
): void {
  for (const handler of Object.values(services)) {
    try {
      handler.onWindowDestroyed?.(windowId);
    } catch {
      /* Service cleanup is best-effort — don't let one service block others */
    }
  }
}

/** Internal revocation cleanup preserves live-source semantics when supported. */
export function notifyServicePermissionRevoked(windowId: string, services: ServiceRegistry): void {
  for (const handler of Object.values(services)) {
    try {
      if (handler.onPermissionRevoked) handler.onPermissionRevoked(windowId);
      else handler.onWindowDestroyed?.(windowId);
    } catch { /* Each remaining service must still receive cleanup. */ }
  }
}

/** Retired windowIds remembered to absorb late duplicate teardown calls. */
const SPENT_WINDOW_LIMIT = 1024;

/** Per-registration window destroy notifications owned by one runtime. */
export interface WindowDestroyTracker {
  /** A session registration began; a still-live replaced registration is retired first. */
  registered(windowId: string): void;
  /** Notify services unless this window's last registration was already destroyed. */
  destroyed(windowId: string): void;
  /** A registered source dispatched again after a cleanup destroy; its next destroy must notify. */
  dispatching(windowId: string): void;
}

/**
 * Track session registrations so one retirement reaching several teardown
 * entry points (`destroyWindow`, `sessionRegistry.unregister`, a bridge revoke
 * that calls both again) notifies services at most once (kehto/web#498).
 * A later registration of the same windowId is a new lifetime with its own
 * destroy. A windowId this runtime never registered keeps the previous
 * notify-on-every-call behavior. Permission revocation is a separate
 * callback and is not tracked here. A source that keeps dispatching after a
 * cleanup `destroyWindow` (legacy hosts without the permission runtime, which
 * otherwise retires the source) is live again, so its next destroy notifies. The most recent retired windowIds
 * (bounded by `SPENT_WINDOW_LIMIT`) are remembered to absorb late duplicates.
 *
 * @param services - The live service registry to notify
 * @param retireReplaced - Whether replacing a live registration notifies a destroy for the old one
 * @returns The runtime's tracker
 */
export function createWindowDestroyTracker(services: ServiceRegistry, retireReplaced: boolean): WindowDestroyTracker {
  const live = new Set<string>();
  const spent = new Set<string>();
  return {
    registered(windowId: string): void {
      spent.delete(windowId);
      if (live.has(windowId) && retireReplaced) notifyServiceWindowDestroyed(windowId, services);
      live.add(windowId);
    },
    destroyed(windowId: string): void {
      if (live.delete(windowId)) {
        spent.add(windowId);
        if (spent.size > SPENT_WINDOW_LIMIT) spent.delete(spent.values().next().value as string);
      } else if (spent.has(windowId)) return;
      notifyServiceWindowDestroyed(windowId, services);
    },
    dispatching(windowId: string): void {
      if (live.has(windowId)) return;
      spent.delete(windowId);
      live.add(windowId);
    },
  };
}
