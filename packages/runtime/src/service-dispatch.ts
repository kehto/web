
import type { NappletMessage } from '@napplet/core';
import type { ServiceRegistry, SendToNapplet } from './types.js';

/**
 * Route a NappletMessage envelope to the matching service handler.
 *
 * NUB-domain services are routed by the domain prefix of message.type
 * (e.g., 'signer.signEvent' -> 'signer' service).
 *
 * INC-routed services receive inc.emit messages and are routed by the
 * topic prefix before ':' (e.g., topic 'audio:play' -> 'audio' service).
 *
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
  // NUB-domain services: signer.*, relay.*, storage.* route by type prefix
  const domain = message.type.split('.')[0];
  const handler = services[domain];
  if (handler) {
    handler.handleMessage(windowId, message, (msg) => sendToNapplet(windowId, msg));
    return true;
  }

  // INC-routed services: audio and notifications receive inc.emit with topic prefix
  const incMessage = message as NappletMessage & { topic?: unknown };
  if (message.type === 'inc.emit' && typeof incMessage.topic === 'string') {
    const prefix = incMessage.topic.split(':')[0];
    const incHandler = services[prefix];
    if (incHandler) {
      incHandler.handleMessage(windowId, message, (msg) => sendToNapplet(windowId, msg));
      return true;
    }
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
