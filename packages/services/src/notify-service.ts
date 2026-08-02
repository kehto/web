/**
 * NAP-NOTIFY reference service.
 *
 * The service owns protocol correlation and per-window lifecycle while a host
 * backend owns presentation, permission, badges, and channels.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  NotifyActionMessage,
  NotifyBadgeMessage,
  NotifyChannelRegisterMessage,
  NotifyClickedMessage,
  NotifyControl,
  NotifyControlsMessage,
  NotifyDismissedMessage,
  NotifyDismissMessage,
  NotifyPermissionRequestMessage,
  NotifyPermissionResultMessage,
  NotifySendMessage,
  NotifySendResultMessage,
} from '@napplet/nap/notify/types';

const NOTIFY_SERVICE_VERSION = '1.0.0';

/** User-interaction events emitted by a host notification presentation. */
export type NotifyInteractionMessage =
  | NotifyActionMessage
  | NotifyClickedMessage
  | NotifyDismissedMessage;

/** Host presentation request for one accepted notification. */
export interface NotifyPresentation {
  /** Window that requested the notification. */
  readonly windowId: string;
  /** Shell-assigned notification identifier. */
  readonly notificationId: string;
  /** Original, untrusted notification payload. */
  readonly message: NotifySendMessage;
  /** Route a host-side user interaction back to the requesting napplet. */
  readonly emit: (message: NotifyInteractionMessage) => void;
}

/** Host hooks required to turn NAP-NOTIFY messages into observable behavior. */
export interface NotifyServiceOptions {
  /** Generate a shell-assigned notification identifier. */
  generateId?: () => string;
  /** Render or otherwise deliver a notification. Missing backends fail closed. */
  present?: (presentation: NotifyPresentation) => void | Promise<void>;
  /** Remove an active notification from host presentation. */
  dismiss?: (windowId: string, notificationId: string) => void | Promise<void>;
  /** Display or clear the requesting napplet's badge count. */
  setBadge?: (windowId: string, count: number) => void | Promise<void>;
  /** Persist a channel registration in host-owned state. */
  registerChannel?: (windowId: string, channel: NotifyChannelRegisterMessage) => void | Promise<void>;
  /** Apply policy or prompt the user for notification permission. */
  requestPermission?: (windowId: string, channel?: string) => boolean | Promise<boolean>;
  /** Release host-owned state when the runtime destroys a napplet window. */
  destroyWindow?: (windowId: string) => void | Promise<void>;
  /** Notification controls implemented by the host backend. */
  controls?: readonly NotifyControl[];
  /** Observe asynchronous fire-and-forget backend failures. */
  onError?: (error: unknown) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function forget(result: void | Promise<void>, onError?: (error: unknown) => void): void {
  void Promise.resolve(result).catch((error: unknown) => onError?.(error));
}

/**
 * Create a NAP-NOTIFY service backed by host-owned notification behavior.
 *
 * A backendless instance is safe to register for conformance testing: send
 * requests return an error and permission requests return `granted: false`
 * instead of manufacturing successful delivery.
 *
 * @param options - Host presentation, policy, and lifecycle hooks.
 * @returns Runtime service handler for the `notify` domain.
 *
 * @example
 * ```ts
 * const notify = createNotifyService({
 *   present: ({ message }) => showToast(message.title, message.body),
 *   requestPermission: () => promptUser(),
 * });
 * runtime.registerService('notify', notify);
 * ```
 */
export function createNotifyService(options: NotifyServiceOptions = {}): ServiceHandler {
  let counter = 0;
  const generateId = options.generateId ?? ((): string => `shell-${++counter}`);
  const active = new Map<string, Set<string>>();
  const controlsSent = new Set<string>();

  const descriptor: ServiceDescriptor = {
    name: 'notify',
    version: NOTIFY_SERVICE_VERSION,
    description: 'NAP-NOTIFY host-backed notification handler',
  };

  const pushControls = (windowId: string, send: (msg: NappletMessage) => void): void => {
    if (!options.controls || controlsSent.has(windowId)) return;
    controlsSent.add(windowId);
    const message: NotifyControlsMessage = { type: 'notify.controls', controls: [...options.controls] };
    send(message as NappletMessage);
  };

  const sendNotification = async (
    windowId: string,
    message: NotifySendMessage,
    send: (msg: NappletMessage) => void,
  ): Promise<void> => {
    if (!options.present) {
      const result: NotifySendResultMessage = {
        type: 'notify.send.result',
        id: message.id,
        error: 'notification presentation unavailable',
      };
      send(result as NappletMessage);
      return;
    }

    const notificationId = generateId();
    const windowNotifications = active.get(windowId) ?? new Set<string>();
    windowNotifications.add(notificationId);
    active.set(windowId, windowNotifications);
    const emit = (interaction: NotifyInteractionMessage): void => {
      if (!windowNotifications.has(notificationId)) return;
      if (interaction.type === 'notify.dismissed') windowNotifications.delete(notificationId);
      send(interaction as NappletMessage);
    };

    try {
      await options.present({ windowId, notificationId, message, emit });
      const result: NotifySendResultMessage = {
        type: 'notify.send.result',
        id: message.id,
        notificationId,
      };
      send(result as NappletMessage);
    } catch (error) {
      windowNotifications.delete(notificationId);
      if (windowNotifications.size === 0) active.delete(windowId);
      const result: NotifySendResultMessage = {
        type: 'notify.send.result',
        id: message.id,
        error: errorText(error),
      };
      send(result as NappletMessage);
    }
  };

  const requestPermission = async (
    windowId: string,
    message: NotifyPermissionRequestMessage,
    send: (msg: NappletMessage) => void,
  ): Promise<void> => {
    let granted = false;
    try {
      granted = options.requestPermission
        ? await options.requestPermission(windowId, message.channel)
        : false;
    } catch (error) {
      options.onError?.(error);
    }
    const result: NotifyPermissionResultMessage = {
      type: 'notify.permission.result',
      id: message.id,
      granted,
    };
    send(result as NappletMessage);
  };

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      pushControls(windowId, send);
      switch (message.type) {
        case 'notify.send':
          void sendNotification(windowId, message as NotifySendMessage, send);
          return;
        case 'notify.dismiss': {
          const notificationId = (message as NotifyDismissMessage).notificationId;
          const windowNotifications = active.get(windowId);
          if (!windowNotifications?.delete(notificationId)) return;
          if (options.dismiss) forget(options.dismiss(windowId, notificationId), options.onError);
          return;
        }
        case 'notify.badge': {
          if (options.setBadge) {
            const count = Math.max(0, Math.floor((message as NotifyBadgeMessage).count));
            forget(options.setBadge(windowId, count), options.onError);
          }
          return;
        }
        case 'notify.channel.register':
          if (options.registerChannel) {
            forget(options.registerChannel(windowId, message as NotifyChannelRegisterMessage), options.onError);
          }
          return;
        case 'notify.permission.request':
          void requestPermission(windowId, message as NotifyPermissionRequestMessage, send);
          return;
        default: {
          const id = (message as NappletMessage & { id?: string }).id ?? '';
          send({
            type: `${message.type}.error`,
            id,
            error: `Unknown notify method: ${message.type}`,
          } as NappletMessage);
        }
      }
    },

    onWindowDestroyed(windowId: string): void {
      const windowNotifications = active.get(windowId);
      active.delete(windowId);
      controlsSent.delete(windowId);
      if (options.dismiss && windowNotifications) {
        for (const notificationId of windowNotifications) {
          forget(options.dismiss(windowId, notificationId), options.onError);
        }
      }
      if (options.destroyWindow) forget(options.destroyWindow(windowId), options.onError);
    },
  };
}
