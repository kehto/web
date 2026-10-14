
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
