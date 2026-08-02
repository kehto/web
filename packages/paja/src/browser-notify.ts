import type {
  NotifyChannelRegisterMessage,
  NotifyDismissedMessage,
} from '@napplet/nap/notify/types';
import type {
  NotifyPresentation,
  NotifyServiceOptions,
} from '@kehto/services';
import type {
  PajaConfirmationHandler,
  PajaIdentityProvider,
} from './browser-adapter.js';

const GENERAL_PERMISSION = '*';

interface ActiveNotification {
  readonly element: HTMLElement;
  readonly emit: NotifyPresentation['emit'];
}

/** Paja notification controller. */
export interface PajaNotifyController {
  /** Hooks consumed by the generic NAP-NOTIFY service. */
  readonly serviceOptions: NotifyServiceOptions;
  /** Remove listeners and all rendered notification state. */
  dispose(): void;
}

/** Configuration for Paja's browser notification center. */
export interface PajaNotifyControllerOptions {
  /** User confirmation queue shared with other sensitive host operations. */
  readonly confirm: PajaConfirmationHandler;
  /** Resolve the immutable identity of the requesting napplet window. */
  readonly getIdentity?: PajaIdentityProvider;
  /** Whether host policy permits notification prompts at all. */
  readonly isEnabled: () => boolean;
  /** Optional document override for browser-boundary tests. */
  readonly document?: Document;
}

function notificationKey(windowId: string, notificationId: string): string {
  return `${windowId}\u0000${notificationId}`;
}

function permissionKey(channel?: string): string {
  return channel ?? GENERAL_PERMISSION;
}

function originLabel(
  getIdentity: PajaIdentityProvider | undefined,
  windowId: string,
): string {
  const identity = getIdentity?.(windowId);
  return identity?.dTag ? `${identity.dTag} · ${windowId}` : windowId;
}

function button(document: Document, label: string, className: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

/**
 * Create Paja's shell-rendered notification center.
 *
 * All untrusted strings are assigned through `textContent`; icons are not
 * fetched, avoiding an ambient network capability. Notifications are visibly
 * attributed to the originating napplet window.
 *
 * @param options - Host policy, identity, and DOM dependencies.
 * @returns A controller when the host page contains notification roots, else null.
 */
export function createPajaNotifyController(
  options: PajaNotifyControllerOptions,
): PajaNotifyController | null {
  const document = options.document ?? globalThis.document;
  const center = document?.getElementById('paja-notification-center');
  const badgeCenter = document?.getElementById('paja-notification-badges');
  if (!center || !badgeCenter) return null;

  const active = new Map<string, ActiveNotification>();
  const badges = new Map<string, HTMLElement>();
  const channels = new Map<string, Map<string, NotifyChannelRegisterMessage>>();
  const permissions = new Map<string, Set<string>>();
  let disposed = false;

  const removeNotification = (
    windowId: string,
    notificationId: string,
    reason?: NotifyDismissedMessage['reason'],
  ): void => {
    const key = notificationKey(windowId, notificationId);
    const record = active.get(key);
    if (!record) return;
    active.delete(key);
    record.element.remove();
    if (reason) record.emit({ type: 'notify.dismissed', notificationId, reason });
  };

  const hasPermission = (windowId: string, channel?: string): boolean => {
    const grants = permissions.get(windowId);
    return grants?.has(GENERAL_PERMISSION) === true
      || grants?.has(permissionKey(channel)) === true;
  };

  const requestPermission = async (windowId: string, channel?: string): Promise<boolean> => {
    if (disposed || !options.isEnabled()) return false;
    if (hasPermission(windowId, channel)) return true;
    const napplet = options.getIdentity?.(windowId) ?? { dTag: 'unknown napplet', aggregateHash: 'unknown' };
    const granted = await options.confirm({
      action: 'notify',
      windowId,
      napplet,
      channel,
    });
    if (!granted) return false;
    const grants = permissions.get(windowId) ?? new Set<string>();
    grants.add(permissionKey(channel));
    permissions.set(windowId, grants);
    return true;
  };

  const present = async (presentation: NotifyPresentation): Promise<void> => {
    if (disposed) throw new Error('notification center unavailable');
    const { windowId, notificationId, message, emit } = presentation;
    if (!await requestPermission(windowId, message.channel)) throw new Error('permission denied');
    if (message.channel && !channels.get(windowId)?.has(message.channel)) {
      throw new Error('invalid channel');
    }

    const article = document.createElement('article');
    article.className = 'paja-notification';
    article.dataset.priority = message.priority ?? 'normal';
    article.dataset.windowId = windowId;
    article.dataset.notificationId = notificationId;

    const header = document.createElement('div');
    header.className = 'paja-notification-header';
    const origin = document.createElement('span');
    origin.className = 'paja-notification-origin';
    origin.textContent = originLabel(options.getIdentity, windowId);
    const close = button(document, 'Dismiss', 'paja-notification-close');
    header.append(origin, close);

    const bodyButton = button(document, '', 'paja-notification-body');
    const title = document.createElement('strong');
    title.textContent = message.title;
    bodyButton.append(title);
    if (message.body) {
      const body = document.createElement('span');
      body.textContent = message.body;
      bodyButton.append(body);
    }
    bodyButton.addEventListener('click', () => {
      emit({ type: 'notify.clicked', notificationId });
    });
    close.addEventListener('click', () => removeNotification(windowId, notificationId, 'user'));
    article.append(header, bodyButton);

    const requestedActions = message.actions?.slice(0, 3) ?? [];
    if (requestedActions.length > 0) {
      const actionBar = document.createElement('div');
      actionBar.className = 'paja-notification-actions';
      for (const action of requestedActions) {
        const actionButton = button(document, action.label, 'paja-notification-action');
        actionButton.dataset.actionId = action.id;
        actionButton.addEventListener('click', () => {
          emit({ type: 'notify.action', notificationId, actionId: action.id });
        });
        actionBar.append(actionButton);
      }
      article.append(actionBar);
    }

    const key = notificationKey(windowId, notificationId);
    const replaced = active.get(key);
    if (replaced) {
      replaced.element.remove();
      replaced.emit({ type: 'notify.dismissed', notificationId, reason: 'replaced' });
    }
    active.set(key, { element: article, emit });
    center.prepend(article);
  };

  const setBadge = (windowId: string, count: number): void => {
    const current = badges.get(windowId);
    if (count === 0) {
      current?.remove();
      badges.delete(windowId);
      return;
    }
    const badge = current ?? document.createElement('span');
    badge.className = 'paja-notification-badge';
    badge.dataset.windowId = windowId;
    badge.textContent = `${originLabel(options.getIdentity, windowId)}: ${Math.min(count, 9999)}`;
    if (!current) badgeCenter.append(badge);
    badges.set(windowId, badge);
  };

  const registerChannel = (windowId: string, channel: NotifyChannelRegisterMessage): void => {
    const windowChannels = channels.get(windowId) ?? new Map<string, NotifyChannelRegisterMessage>();
    windowChannels.set(channel.channelId, { ...channel });
    channels.set(windowId, windowChannels);
  };

  const destroyWindow = (windowId: string): void => {
    for (const [key, record] of active) {
      if (!key.startsWith(`${windowId}\u0000`)) continue;
      record.element.remove();
      active.delete(key);
    }
    badges.get(windowId)?.remove();
    badges.delete(windowId);
    channels.delete(windowId);
    permissions.delete(windowId);
  };

  return {
    serviceOptions: {
      controls: ['toasts', 'badges', 'actions', 'channels'],
      present,
      dismiss: (windowId, notificationId) => removeNotification(windowId, notificationId),
      setBadge,
      registerChannel,
      requestPermission,
      destroyWindow,
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const record of active.values()) record.element.remove();
      for (const badge of badges.values()) badge.remove();
      active.clear();
      badges.clear();
      channels.clear();
      permissions.clear();
    },
  };
}
