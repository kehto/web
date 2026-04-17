/**
 * notification-service.ts — Notification state registry as a ServiceHandler.
 *
 * Tracks notifications created by napplet windows. Shell hosts wire this
 * into the runtime via registerService('notifications', createNotificationService(opts)).
 * The shell host decides presentation (toast, badge, OS notification, etc.)
 * through the onChange callback. Browser-agnostic — no DOM, no window.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime's core-compat shim.
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type { Notification, NotificationServiceOptions } from './types.js';

/** Notification service version — follows semver. */
const NOTIFICATION_SERVICE_VERSION = '1.0.0';

/** Default maximum notifications per window. */
const DEFAULT_MAX_PER_WINDOW = 100;

/** Counter for generating unique notification IDs. */
let idCounter = 0;

/**
 * Generate a unique notification ID.
 */
function generateId(): string {
  idCounter++;
  return `notif-${Date.now()}-${idCounter}`;
}

/**
 * Create a notification service handler.
 *
 * The notification service is a state registry that tracks notifications
 * per napplet window. Napplets create and manage notifications via
 * `notifications:*` topic events; the shell host controls presentation
 * via the onChange callback.
 *
 * @param options - Optional configuration (onChange callback, maxPerWindow limit)
 * @returns A ServiceHandler to register with the runtime
 *
 * @example
 * ```ts
 * import { createNotificationService } from '@kehto/services';
 *
 * const notifications = createNotificationService({
 *   onChange: (list) => {
 *     const unread = list.filter(n => !n.read);
 *     updateBadge(unread.length);
 *   },
 *   maxPerWindow: 50,
 * });
 *
 * runtime.registerService('notifications', notifications);
 * ```
 */
export function createNotificationService(options?: NotificationServiceOptions): ServiceHandler {
  const notifications = new Map<string, Notification[]>();
  const onChange = options?.onChange;
  const maxPerWindow = options?.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW;

  /**
   * Get a flat list of all notifications across all windows.
   */
  function getAllNotifications(): Notification[] {
    const all: Notification[] = [];
    for (const windowNotifs of notifications.values()) {
      all.push(...windowNotifs);
    }
    return all;
  }

  function notify(): void {
    onChange?.(getAllNotifications());
  }

  /**
   * Ensure a window's notification list exists.
   */
  function getWindowNotifications(windowId: string): Notification[] {
    let list = notifications.get(windowId);
    if (!list) {
      list = [];
      notifications.set(windowId, list);
    }
    return list;
  }

  /**
   * Enforce maxPerWindow limit by evicting oldest notifications.
   */
  function enforceLimit(list: Notification[]): void {
    while (list.length > maxPerWindow) {
      list.shift(); // Remove oldest (FIFO eviction)
    }
  }

  /**
   * Find a notification by ID across all windows.
   * Returns [windowId, notification, index] or undefined.
   */
  function findById(id: string): [string, Notification, number] | undefined {
    for (const [windowId, list] of notifications) {
      const index = list.findIndex((n) => n.id === id);
      if (index !== -1) {
        return [windowId, list[index], index];
      }
    }
    return undefined;
  }

  const descriptor: ServiceDescriptor = {
    name: 'notifications',
    version: NOTIFICATION_SERVICE_VERSION,
    description: 'Notification state registry — tracks notifications per napplet window',
  };

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type !== 'ifc.emit') return;
      const topic = (message as any).topic as string | undefined;
      if (!topic?.startsWith('notifications:')) return;

      const action = topic.slice(14); // 'notifications:'.length === 14
      const payload = ((message as any).payload ?? {}) as Record<string, unknown>;

      switch (action) {
        case 'create': {
          const title = typeof payload.title === 'string' ? payload.title : '';
          const body = typeof payload.body === 'string' ? payload.body : '';

          const id = generateId();
          const notification: Notification = {
            id,
            windowId,
            title,
            body,
            read: false,
            createdAt: Math.floor(Date.now() / 1000),
          };

          const list = getWindowNotifications(windowId);
          list.push(notification);
          enforceLimit(list);
          notify();

          send({ type: 'ifc.event', topic: 'notifications:created', payload: { id } } as NappletMessage);
          break;
        }

        case 'dismiss': {
          const id = typeof payload.id === 'string' ? payload.id : '';
          if (!id) return;

          const found = findById(id);
          if (found) {
            const [foundWindowId, , index] = found;
            const list = notifications.get(foundWindowId);
            if (list) {
              list.splice(index, 1);
              // Clean up empty lists
              if (list.length === 0) {
                notifications.delete(foundWindowId);
              }
              notify();
            }
          }
          break;
        }

        case 'read': {
          const id = typeof payload.id === 'string' ? payload.id : '';
          if (!id) return;

          const found = findById(id);
          if (found) {
            const [, notification] = found;
            if (!notification.read) {
              notification.read = true;
              notify();
            }
          }
          break;
        }

        case 'list': {
          const windowNotifs = notifications.get(windowId) ?? [];
          send({ type: 'ifc.event', topic: 'notifications:listed', payload: { notifications: windowNotifs } } as NappletMessage);
          break;
        }

        default:
          // Unknown notification action — ignore
          break;
      }
    },

    onWindowDestroyed(windowId: string): void {
      if (notifications.delete(windowId)) {
        notify();
      }
    },
  };
}
