
import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
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

interface NotificationStore {
  notifications: Map<string, Notification[]>;
  onChange?: (notifications: Notification[]) => void;
  maxPerWindow: number;
}

function getAllNotifications(store: NotificationStore): Notification[] {
  const all: Notification[] = [];
  for (const windowNotifs of store.notifications.values()) {
    all.push(...windowNotifs);
  }
  return all;
}

function notify(store: NotificationStore): void {
  store.onChange?.(getAllNotifications(store));
}

function getWindowNotifications(store: NotificationStore, windowId: string): Notification[] {
  let list = store.notifications.get(windowId);
  if (!list) {
    list = [];
    store.notifications.set(windowId, list);
  }
  return list;
}

function enforceLimit(store: NotificationStore, list: Notification[]): void {
  while (list.length > store.maxPerWindow) {
    list.shift();
  }
}

function findById(store: NotificationStore, id: string): [string, Notification, number] | undefined {
  for (const [windowId, list] of store.notifications) {
    const index = list.findIndex((n) => n.id === id);
    if (index !== -1) {
      return [windowId, list[index], index];
    }
  }
  return undefined;
}

function createNotification(
  store: NotificationStore,
  windowId: string,
  title: string,
  body: string,
): Notification {
  const notification: Notification = {
    id: generateId(),
    windowId,
    title,
    body,
    read: false,
    createdAt: Math.floor(Date.now() / 1000),
  };
  const list = getWindowNotifications(store, windowId);
  list.push(notification);
  enforceLimit(store, list);
  notify(store);
  return notification;
}

function dismissNotification(store: NotificationStore, id: string): void {
  const found = findById(store, id);
  if (!found) return;
  const [foundWindowId, , index] = found;
  const list = store.notifications.get(foundWindowId);
  if (!list) return;
  list.splice(index, 1);
  if (list.length === 0) store.notifications.delete(foundWindowId);
  notify(store);
}

function markNotificationRead(store: NotificationStore, id: string): void {
  const found = findById(store, id);
  if (!found) return;
  const [, notification] = found;
  if (!notification.read) {
    notification.read = true;
    notify(store);
  }
}

function handleNotifyEnvelope(
  store: NotificationStore,
  windowId: string,
  action: string,
  msg: NappletMessage & Record<string, unknown>,
  send: (msg: NappletMessage) => void,
): void {
  switch (action) {
    case 'create': {
      const title = typeof msg.title === 'string' ? msg.title : '';
      const body = typeof msg.body === 'string' ? msg.body : '';
      const notification = createNotification(store, windowId, title, body);
      send({ type: 'notify.created', id: notification.id } as NappletMessage);
      break;
    }

    case 'dismiss': {
      const notifId = typeof msg.notificationId === 'string' ? msg.notificationId : '';
      if (notifId) dismissNotification(store, notifId);
      break;
    }

    case 'read': {
      const notifId = typeof msg.notificationId === 'string' ? msg.notificationId : '';
      if (notifId) markNotificationRead(store, notifId);
      break;
    }

    case 'list': {
      const windowNotifs = store.notifications.get(windowId) ?? [];
      send({ type: 'notify.listed', notifications: windowNotifs } as NappletMessage);
      break;
    }

    default:
      break;
  }
}

function handleIncNotification(
  store: NotificationStore,
  windowId: string,
  action: string,
  payload: Record<string, unknown>,
  send: (msg: NappletMessage) => void,
): void {
  switch (action) {
    case 'create': {
      const title = typeof payload.title === 'string' ? payload.title : '';
      const body = typeof payload.body === 'string' ? payload.body : '';
      const notification = createNotification(store, windowId, title, body);
      send({ type: 'inc.event', topic: 'notifications:created', payload: { id: notification.id } } as NappletMessage);
      break;
    }

    case 'dismiss': {
      const id = typeof payload.id === 'string' ? payload.id : '';
      if (id) dismissNotification(store, id);
      break;
    }

    case 'read': {
      const id = typeof payload.id === 'string' ? payload.id : '';
      if (id) markNotificationRead(store, id);
      break;
    }

    case 'list': {
      const windowNotifs = store.notifications.get(windowId) ?? [];
      send({ type: 'inc.event', topic: 'notifications:listed', payload: { notifications: windowNotifs } } as NappletMessage);
      break;
    }

    default:
      break;
  }
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
  const store: NotificationStore = {
    notifications: new Map<string, Notification[]>(),
    onChange: options?.onChange,
    maxPerWindow: options?.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW,
  };

  const descriptor: ServiceDescriptor = {
    name: 'notifications',
    version: NOTIFICATION_SERVICE_VERSION,
    description: 'Notification state registry — tracks notifications per napplet window',
  };

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      const msg = message as NappletMessage & Record<string, unknown>;

      if (message.type.startsWith('notify.')) {
        handleNotifyEnvelope(store, windowId, message.type.slice(7), msg, send);
        return;
      }

      if (message.type !== 'inc.emit') return;
      const topic = msg.topic as string | undefined;
      if (!topic?.startsWith('notifications:')) return;

      const payload = ((msg.payload ?? {}) as Record<string, unknown>);
      handleIncNotification(store, windowId, topic.slice(14), payload, send);
    },

    onWindowDestroyed(windowId: string): void {
      if (store.notifications.delete(windowId)) {
        notify(store);
      }
    },
  };
}
