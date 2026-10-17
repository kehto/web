
import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
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

function findById(store: NotificationStore, windowId: string, id: string): [Notification, number] | undefined {
  const list = store.notifications.get(windowId);
  const index = list?.findIndex((notification) => notification.id === id) ?? -1;
  if (!list || index === -1) return undefined;
  return [list[index], index];
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

function dismissNotification(store: NotificationStore, windowId: string, id: string): void {
  const found = findById(store, windowId, id);
  if (!found) return;
  const [, index] = found;
  const list = store.notifications.get(windowId);
  if (!list) return;
  list.splice(index, 1);
  if (list.length === 0) store.notifications.delete(windowId);
  notify(store);
}

function markNotificationRead(store: NotificationStore, windowId: string, id: string): void {
  const found = findById(store, windowId, id);
  if (!found) return;
  const [notification] = found;
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
      if (notifId) dismissNotification(store, windowId, notifId);
      break;
    }

    case 'read': {
      const notifId = typeof msg.notificationId === 'string' ? msg.notificationId : '';
      if (notifId) markNotificationRead(store, windowId, notifId);
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

/**
 * Create a notification service handler.
 *
 * The notification service is a state registry that tracks notifications
 * per napplet window. It accepts direct `notify.*` service envelopes; INC
 * topics are opaque application data and never select a host service. The
 * shell host controls presentation through the onChange callback.
 * This retained Kehto registry predates NAP-NOTIFY PR #11 and has no owning
 * upstream NAP. New hosts should use createNotifyService and notify.send.
 *
 * @param options - Optional configuration (onChange callback, maxPerWindow limit)
 * @returns A ServiceHandler to register with the runtime
 * @deprecated Use createNotifyService for NAP-NOTIFY wire messages.
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
 * runtime.registerService('notify', notifications);
 * ```
 */
export function createNotificationService(options?: NotificationServiceOptions): ServiceHandler {
  const store: NotificationStore = {
    notifications: new Map<string, Notification[]>(),
    onChange: options?.onChange,
    maxPerWindow: options?.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW,
  };

  const descriptor: ServiceDescriptor = {
    name: 'notify',
    version: NOTIFICATION_SERVICE_VERSION,
    description: 'Notification state registry — tracks notifications per napplet window',
  };
  const generations = new Map<string, object>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  const current = (windowId: string, generation: object): boolean => generations.get(windowId) === generation;
  const cleanup = (windowId: string): void => {
    generations.delete(windowId);
    if (store.notifications.delete(windowId)) notify(store);
  };

  return {
    descriptor,

    onRegistered(context) { runtime = context; },
    onUnregistered() {
      for (const windowId of generations.keys()) cleanup(windowId);
      runtime = undefined;
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (!message.type.startsWith('notify.')) return;
      const action = message.type.slice(7);
      if (!['create', 'list', 'read', 'dismiss'].includes(action)) return;
      if (!warnedLegacy) {
        warnedLegacy = true;
        console.warn('[FW-NOTIFICATION-LEGACY-001] Migrate notify.create/list/read to NAP-NOTIFY notify.send; legacy registry wire is deprecated. Warning once per service instance.');
      }
      const fields = message as NappletMessage & Record<string, unknown>;
      const snapshot = { type: message.type,
        ...(typeof fields.title === 'string' ? { title: fields.title.slice(0, 256) } : {}),
        ...(typeof fields.body === 'string' ? { body: fields.body.slice(0, 4096) } : {}),
        ...(typeof fields.notificationId === 'string' ? { notificationId: fields.notificationId.slice(0, 128) } : {}),
      } as NappletMessage & Record<string, unknown>;
      const generation = generations.get(windowId) ?? {};
      generations.set(windowId, generation);
      const execute = (): void => {
        if (!current(windowId, generation)) return;
        handleNotifyEnvelope(store, windowId, action, snapshot, send);
      };
      if (action === 'dismiss' || !runtime?.authorizeOperation) { execute(); return; }
      const scope = action === 'create' ? 'legacy:notification'
        : action === 'list' ? 'legacy:list'
          : `legacy:${snapshot.notificationId ?? ''}`;
      void runtime.authorizeOperation(windowId, `notify.${action}`, [{
        category: 'resource', domain: 'notify', operation: `notify.${action}`,
        scope: { kind: 'exact', value: scope },
      }], (signal) => { if (!signal.aborted) execute(); });
    },

    onPermissionRevoked(windowId: string): void { cleanup(windowId); },
    onWindowDestroyed(windowId: string): void { cleanup(windowId); },
  };
}
