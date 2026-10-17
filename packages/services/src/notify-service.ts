/**
 * NAP-NOTIFY reference service.
 *
 * The service owns protocol correlation and per-window lifecycle while a host
 * backend owns presentation, permission, badges, and channels.
 */

import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
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
  /** Approval/lifecycle cancellation for asynchronous host prompts. */
  readonly signal?: ApprovalSignal;
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
  requestPermission?: (windowId: string, channel?: string, signal?: ApprovalSignal) => boolean | Promise<boolean>;
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

function snapshotNotification(message: NotifySendMessage): NotifySendMessage | null {
  if (typeof message.id !== 'string' || message.id.length > 128
    || typeof message.title !== 'string' || message.title.length > 256
    || (message.body !== undefined && (typeof message.body !== 'string' || message.body.length > 4096))
    || (message.channel !== undefined && (typeof message.channel !== 'string' || message.channel.length > 128))
    || (message.priority !== undefined && !['low', 'normal', 'high', 'urgent'].includes(message.priority))
    || (message.icon !== undefined && (typeof message.icon !== 'string' || message.icon.length > 256 || /^[a-z][a-z\d+.-]*:/i.test(message.icon)))
    || (message.actions !== undefined && (!Array.isArray(message.actions) || message.actions.length > 3
      || message.actions.some((action) => !action || typeof action.id !== 'string' || action.id.length > 128
        || typeof action.label !== 'string' || action.label.length > 256)))) return null;
  // Remote icons require NAP-RESOURCE mediation; the reference service permits only shell-owned identifiers.
  return Object.freeze({
    type: 'notify.send', id: message.id, title: message.title,
    ...(message.body === undefined ? {} : { body: message.body }),
    ...(message.icon === undefined ? {} : { icon: message.icon }),
    ...(message.channel === undefined ? {} : { channel: message.channel }),
    ...(message.priority === undefined ? {} : { priority: message.priority }),
    ...(message.actions === undefined ? {} : {
      actions: Object.freeze(message.actions.map((action) => Object.freeze({ id: action.id, label: action.label }))),
    }),
  }) as NotifySendMessage;
}

function scopeFor(operation: string, value: string) {
  return [{ category: 'resource' as const, domain: 'notify', operation, scope: { kind: 'exact' as const, value } }];
}

type NotifyAuthorize = <T>(windowId: string, operation: string, scope: string,
  action: (signal: ApprovalSignal) => T | Promise<T>) => Promise<{ status: 'executed'; value: T } | { status: 'denied' }>;

interface NotifyDispatch {
  readonly options: NotifyServiceOptions;
  readonly active: Map<string, Set<string>>;
  readonly generationFor: (windowId: string) => object;
  readonly current: (windowId: string, generation: object) => boolean;
  readonly authorize: NotifyAuthorize;
  readonly pushControls: (windowId: string, send: (message: NappletMessage) => void) => void;
  readonly sendNotification: (windowId: string, message: NotifySendMessage,
    send: (message: NappletMessage) => void) => Promise<void>;
}

async function requestNotifyPermission(deps: NotifyDispatch, windowId: string,
  message: NotifyPermissionRequestMessage, send: (message: NappletMessage) => void): Promise<void> {
  const generation = deps.generationFor(windowId);
  if (message.channel !== undefined && (typeof message.channel !== 'string' || message.channel.length > 128)) {
    send({ type: 'notify.permission.result', id: message.id, granted: false } as NappletMessage);
    return;
  }
  const channel = typeof message.channel === 'string' ? message.channel : undefined;
  let granted = false;
  try {
    if (deps.options.requestPermission) {
      const outcome = await deps.authorize(windowId, 'notify.permission.request', `channel:${channel ?? '*'}`,
        (signal) => signal.aborted ? false : deps.options.requestPermission!(windowId, channel, signal));
      granted = outcome.status === 'executed' && outcome.value === true;
    }
  } catch (error) {
    deps.options.onError?.(error);
  }
  if (!deps.current(windowId, generation)) return;
  const result: NotifyPermissionResultMessage = { type: 'notify.permission.result', id: message.id, granted };
  send(result as NappletMessage);
}

function handleNotifyMessage(deps: NotifyDispatch, windowId: string, message: NappletMessage,
  send: (message: NappletMessage) => void): void {
  deps.pushControls(windowId, send);
  switch (message.type) {
    case 'notify.send':
      void deps.sendNotification(windowId, message as NotifySendMessage, send);
      return;
    case 'notify.dismiss': {
      const notificationId = (message as NotifyDismissMessage).notificationId;
      const windowNotifications = deps.active.get(windowId);
      if (!windowNotifications?.delete(notificationId)) return;
      if (deps.options.dismiss) forget(deps.options.dismiss(windowId, notificationId), deps.options.onError);
      return;
    }
    case 'notify.badge': {
      if (!deps.options.setBadge) return;
      const requestedCount = (message as NotifyBadgeMessage).count;
      if (!Number.isSafeInteger(requestedCount) || requestedCount < 0) return;
      const count = Math.min(requestedCount, 9999);
      const generation = deps.generationFor(windowId);
      void deps.authorize(windowId, 'notify.badge', 'badge', (signal) => {
        if (signal.aborted || !deps.current(windowId, generation)) return;
        return deps.options.setBadge!(windowId, count);
      }).catch(deps.options.onError);
      return;
    }
    case 'notify.channel.register': {
      if (!deps.options.registerChannel) return;
      const channel = message as NotifyChannelRegisterMessage;
      if (typeof channel.channelId !== 'string' || channel.channelId.length > 128
        || typeof channel.label !== 'string' || channel.label.length > 256
        || (channel.description !== undefined && (typeof channel.description !== 'string' || channel.description.length > 4096))
        || (channel.defaultPriority !== undefined && !['low', 'normal', 'high', 'urgent'].includes(channel.defaultPriority))) return;
      const snapshot = Object.freeze({ type: 'notify.channel.register' as const,
        channelId: channel.channelId, label: channel.label,
        ...(channel.description === undefined ? {} : { description: channel.description }),
        ...(channel.defaultPriority ? { defaultPriority: channel.defaultPriority } : {}),
      });
      const generation = deps.generationFor(windowId);
      void deps.authorize(windowId, 'notify.channel.register', `channel:${snapshot.channelId}`, (signal) => {
        if (signal.aborted || !deps.current(windowId, generation)) return;
        return deps.options.registerChannel!(windowId, snapshot);
      }).catch(deps.options.onError);
      return;
    }
    case 'notify.permission.request':
      void requestNotifyPermission(deps, windowId, message as NotifyPermissionRequestMessage, send);
      return;
    default: {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      send({ type: `${message.type}.error`, id,
        error: `Unknown notify method: ${message.type}` } as NappletMessage);
    }
  }
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
  const generations = new Map<string, object>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  const generationFor = (windowId: string): object => {
    const generation = generations.get(windowId) ?? {};
    generations.set(windowId, generation);
    return generation;
  };
  const current = (windowId: string, generation: object): boolean => generations.get(windowId) === generation;
  const authorize = async <T>(windowId: string, operation: string, scope: string,
    action: (signal: ApprovalSignal) => T | Promise<T>): Promise<{ status: 'executed'; value: T } | { status: 'denied' }> => {
    if (!runtime?.authorizeOperation) {
      if (!warnedLegacy) {
        warnedLegacy = true;
        console.warn('[FW-NOTIFY-LEGACY-001] Attach RuntimeAdapter.permissions for approved notification effects; host-only delivery is deprecated. Warning once per service instance.');
      }
      return { status: 'executed', value: await action(new AbortController().signal) };
    }
    const result = await runtime.authorizeOperation(windowId, operation, scopeFor(operation, scope), action);
    return result.status === 'executed' ? result : { status: 'denied' };
  };

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
    const request = snapshotNotification(message);
    if (!request) {
      send({ type: 'notify.send.result', id: typeof message.id === 'string' ? message.id : '', error: 'invalid notification' } as NappletMessage);
      return;
    }
    if (!options.present) {
      const result: NotifySendResultMessage = {
        type: 'notify.send.result',
        id: request.id,
        error: 'notification presentation unavailable',
      };
      send(result as NappletMessage);
      return;
    }

    const generation = generationFor(windowId);
    try {
      const outcome = await authorize(windowId, 'notify.send', `channel:${request.channel ?? '*'}`, async (signal) => {
        if (signal.aborted || !current(windowId, generation)) return;
        const notificationId = generateId();
        const windowNotifications = active.get(windowId) ?? new Set<string>();
        windowNotifications.add(notificationId);
        active.set(windowId, windowNotifications);
        const ownsNotification = (): boolean => current(windowId, generation)
          && active.get(windowId) === windowNotifications && windowNotifications.has(notificationId) && !signal.aborted;
        const emit = (interaction: NotifyInteractionMessage): void => {
          if (!ownsNotification() || interaction.notificationId !== notificationId) return;
          if (interaction.type === 'notify.dismissed') windowNotifications.delete(notificationId);
          send(interaction as NappletMessage);
        };
        try {
          await options.present!({ windowId, notificationId, message: request, emit, signal });
        } catch (error) {
          windowNotifications.delete(notificationId);
          if (windowNotifications.size === 0 && active.get(windowId) === windowNotifications) active.delete(windowId);
          if (options.dismiss) forget(options.dismiss(windowId, notificationId), options.onError);
          throw error;
        }
        if (!ownsNotification()) return;
        send({ type: 'notify.send.result', id: request.id, notificationId } as NappletMessage);
      });
      if (outcome.status !== 'executed' && current(windowId, generation)) {
        send({ type: 'notify.send.result', id: request.id, error: 'permission denied' } as NappletMessage);
      }
    } catch (error) {
      if (!current(windowId, generation)) return;
      const result: NotifySendResultMessage = {
        type: 'notify.send.result',
        id: request.id,
        error: errorText(error),
      };
      send(result as NappletMessage);
    }
  };

  return {
    descriptor,

    onRegistered(context) { runtime = context; },
    onUnregistered() {
      for (const windowId of generations.keys()) cleanup(windowId);
      runtime = undefined;
    },

    handleMessage(windowId, message, send) {
      handleNotifyMessage({ options, active, generationFor, current, authorize,
        pushControls, sendNotification }, windowId, message, send);
    },

    onPermissionRevoked(windowId: string): void { cleanup(windowId); },
    onWindowDestroyed(windowId: string): void { cleanup(windowId); },
  };

  function cleanup(windowId: string): void {
      generations.delete(windowId);
      const windowNotifications = active.get(windowId);
      active.delete(windowId);
      controlsSent.delete(windowId);
      if (options.dismiss && windowNotifications) {
        for (const notificationId of windowNotifications) {
          forget(options.dismiss(windowId, notificationId), options.onError);
        }
      }
      if (options.destroyWindow) forget(options.destroyWindow(windowId), options.onError);
  }
}
