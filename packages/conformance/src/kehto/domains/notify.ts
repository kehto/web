import { createNotifyService, type NotifyPresentation } from '@kehto/services';
import { NOTIFY_ACTION_ID } from '../../fixtures/notify.js';
import type { DomainBackendModule } from './types.js';

/**
 * NAP-NOTIFY backend: the reference notify service presenting into an
 * in-memory list. Controls stand in for the user interacting with the most
 * recently presented notification.
 */
export const NOTIFY_BACKEND: DomainBackendModule = {
  domain: 'notify',
  create() {
    const presented: NotifyPresentation[] = [];
    const host = { dismissed: [] as string[], badges: [] as number[], channels: [] as string[] };
    let counter = 0;
    const latest = (): NotifyPresentation | undefined => presented.at(-1);
    const notify = createNotifyService({
      generateId: () => `conformance-notification-${++counter}`,
      present: (presentation) => { presented.push(presentation); },
      dismiss: (_windowId, notificationId) => { host.dismissed.push(notificationId); },
      setBadge: (_windowId, count) => { host.badges.push(count); },
      registerChannel: (_windowId, channel) => { host.channels.push(channel.channelId); },
      requestPermission: () => true,
      controls: ['toasts', 'badges', 'actions', 'channels'],
    });
    return {
      services: { notify },
      controls: {
        'notify.action': () => {
          const item = latest();
          item?.emit({ type: 'notify.action', notificationId: item.notificationId, actionId: NOTIFY_ACTION_ID });
        },
        'notify.click': () => {
          const item = latest();
          item?.emit({ type: 'notify.clicked', notificationId: item.notificationId });
        },
        'notify.dismissByUser': () => {
          const item = latest();
          item?.emit({ type: 'notify.dismissed', notificationId: item.notificationId, reason: 'user' });
        },
        'notify.hostState': () => structuredClone(host),
      },
    };
  },
};
