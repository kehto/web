import type { Nip66Aggregator } from '@kehto/nip66';
import type { Notification } from '@kehto/services';
import type { NappletDebugger } from './debugger.js';
import { demoConfig } from './demo-config.js';
import {
  createDemoNotificationController,
  type DemoNotificationController,
  type DemoNotificationSnapshot,
} from './notification-demo.js';
import { getServiceNodeId } from './topology.js';

export interface NotificationUiController {
  controller: DemoNotificationController;
  attachDebugger(debuggerEl: NappletDebugger | null): void;
  injectControls(): void;
  handleDocumentClick(event: MouseEvent): boolean;
}

const shownToastIds = new Set<string>();

function renderToast(notification: Notification): void {
  const layer = document.getElementById('notification-toast-layer');
  if (!layer) return;
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.dataset.notifId = notification.id;
  const title = document.createElement('div');
  title.className = 'notif-toast-title';
  title.textContent = notification.title;
  toast.appendChild(title);
  if (notification.body) {
    const body = document.createElement('div');
    body.className = 'notif-toast-body';
    body.textContent = notification.body;
    toast.appendChild(body);
  }
  const cue = document.createElement('div');
  cue.className = 'notif-toast-cue';
  cue.textContent = 'notifications:create via service';
  toast.appendChild(cue);
  layer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, demoConfig.get('demo.TOAST_DISPLAY_MS'));
}

function renderNotificationNodeSummary(snapshot: DemoNotificationSnapshot): void {
  const totalEl = document.getElementById('notif-total');
  const unreadEl = document.getElementById('notif-unread');
  const sourceCueEl = document.getElementById('notif-source-cue');
  const cueTextEl = sourceCueEl?.querySelector('.notif-cue-text');

  if (totalEl) totalEl.textContent = String(snapshot.notifications.length);
  if (unreadEl) unreadEl.textContent = String(snapshot.unreadCount);
  if (sourceCueEl && cueTextEl && snapshot.sourceLabel) {
    (cueTextEl as HTMLElement).textContent = snapshot.sourceLabel;
    (sourceCueEl as HTMLElement).style.display = '';
  }
}

function renderNotificationInspector(snapshot: DemoNotificationSnapshot): void {
  const listEl = document.getElementById('notification-list');
  if (!listEl) return;

  if (snapshot.notifications.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notif-list-empty';
    empty.textContent = 'no notifications yet';
    listEl.replaceChildren(empty);
    return;
  }

  const sorted = [...snapshot.notifications].reverse();
  const items = sorted.map((n) => {
    const item = document.createElement('div');
    item.className = `notif-item${n.read ? ' read' : ''}`;
    item.dataset.notifId = n.id;

    const title = document.createElement('div');
    title.className = 'notif-item-title';
    title.textContent = n.title;
    item.appendChild(title);

    if (n.body) {
      const body = document.createElement('div');
      body.className = 'notif-item-body';
      body.textContent = n.body;
      item.appendChild(body);
    }

    const meta = document.createElement('div');
    meta.className = 'notif-item-meta';
    const tag = document.createElement('span');
    tag.className = 'notif-item-tag';
    tag.textContent = 'notifications:create';
    const state = document.createElement('span');
    state.textContent = n.read ? 'read' : 'unread';
    meta.append(tag, state);
    item.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'notif-item-actions';
    if (!n.read) {
      const readBtn = document.createElement('button');
      readBtn.className = 'notif-item-btn read-btn';
      readBtn.dataset.action = 'notif-read';
      readBtn.dataset.notifId = n.id;
      readBtn.textContent = 'mark read';
      actions.appendChild(readBtn);
    }
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'notif-item-btn dismiss-btn';
    dismissBtn.dataset.action = 'notif-dismiss';
    dismissBtn.dataset.notifId = n.id;
    dismissBtn.textContent = 'dismiss';
    actions.appendChild(dismissBtn);
    item.appendChild(actions);

    return item;
  });
  listEl.replaceChildren(...items);
}

function injectNotificationControls(): void {
  const notifNodeId = getServiceNodeId('notifications');
  const notifServiceNode = document.getElementById(notifNodeId);
  const template = document.getElementById('notification-node-controls-template') as HTMLTemplateElement | null;
  if (!notifServiceNode || !template) return;
  const clone = document.importNode(template.content, true);
  const contentWrapper = notifServiceNode.querySelector('.topology-node-content') ?? notifServiceNode;
  contentWrapper.appendChild(clone);
}

function syncShownToastIds(snapshot: DemoNotificationSnapshot): void {
  const currentIds = new Set(snapshot.notifications.map((n) => n.id));
  for (const id of shownToastIds) {
    if (!currentIds.has(id)) {
      shownToastIds.delete(id);
    }
  }
}

export function createNotificationUi(): NotificationUiController {
  const controller = createDemoNotificationController();
  let debuggerEl: NappletDebugger | null = null;
  let snapshot = controller.getSnapshot();

  controller.subscribe((next) => {
    snapshot = next;

    for (const notification of next.notifications) {
      if (!shownToastIds.has(notification.id)) {
        shownToastIds.add(notification.id);
        renderToast(notification);
        debuggerEl?.addSystemMessage(`notifications:create via service — id:${notification.id.slice(0, 16)}`);
      }
    }

    renderNotificationNodeSummary(next);

    const inspector = document.getElementById('notification-inspector');
    if (inspector?.classList.contains('open')) {
      renderNotificationInspector(next);
    }

    syncShownToastIds(next);
  });

  return {
    controller,
    attachDebugger(nextDebuggerEl) {
      debuggerEl = nextDebuggerEl;
    },
    injectControls: injectNotificationControls,
    handleDocumentClick(event) {
      const target = event.target as HTMLElement;

      if (target.id === 'notification-node-create' || target.closest('#notification-node-create')) {
        event.stopPropagation();
        controller.createDemoNotification({
          title: 'Demo notification',
          body: 'Triggered from the notification service node',
          sourceLabel: 'notifications:create via service',
        });
        debuggerEl?.addSystemMessage('notifications:create dispatched from host node control');
        return true;
      }

      if (target.id === 'notification-node-list' || target.closest('#notification-node-list')) {
        event.stopPropagation();
        controller.requestList();
        debuggerEl?.addSystemMessage('notifications:list requested');
        const inspector = document.getElementById('notification-inspector');
        inspector?.classList.add('open');
        renderNotificationInspector(snapshot);
        return true;
      }

      if (target.id === 'notification-node-mark-read' || target.closest('#notification-node-mark-read')) {
        event.stopPropagation();
        const newest = [...snapshot.notifications].filter((n) => !n.read).pop();
        if (newest) {
          controller.markRead(newest.id);
          debuggerEl?.addSystemMessage(`notifications:read dispatched — id:${newest.id.slice(0, 16)}`);
        } else {
          debuggerEl?.addSystemMessage('notifications:read — no unread notifications');
        }
        return true;
      }

      if (target.id === 'notification-node-dismiss' || target.closest('#notification-node-dismiss')) {
        event.stopPropagation();
        const newest = [...snapshot.notifications].pop();
        if (newest) {
          controller.dismiss(newest.id);
          debuggerEl?.addSystemMessage(`notifications:dismiss dispatched — id:${newest.id.slice(0, 16)}`);
        } else {
          debuggerEl?.addSystemMessage('notifications:dismiss — no notifications to dismiss');
        }
        return true;
      }

      if (target.dataset.action === 'notif-read') {
        event.stopPropagation();
        const id = target.dataset.notifId;
        if (id) {
          controller.markRead(id);
          debuggerEl?.addSystemMessage(`notifications:read from inspector — id:${id.slice(0, 16)}`);
        }
        return true;
      }

      if (target.dataset.action === 'notif-dismiss') {
        event.stopPropagation();
        const id = target.dataset.notifId;
        if (id) {
          controller.dismiss(id);
          debuggerEl?.addSystemMessage(`notifications:dismiss from inspector — id:${id.slice(0, 16)}`);
        }
        return true;
      }

      if (target.id === 'notification-inspector-close' || target.closest('#notification-inspector-close')) {
        event.stopPropagation();
        const inspector = document.getElementById('notification-inspector');
        inspector?.classList.remove('open');
        return true;
      }

      return false;
    },
  };
}

function renderNip66Suggestions(aggregator: Nip66Aggregator): boolean {
  const list = document.getElementById('nip66-suggestions-list');
  if (!list) return false;
  const relays = Array.from(aggregator.getRelaySet());
  if (relays.length === 0) return false;
  list.replaceChildren();
  for (const url of relays) {
    const li = document.createElement('li');
    li.style.padding = '2px 0';
    li.style.color = '#62d0ff';
    li.style.fontFamily = 'monospace';
    li.textContent = url;
    list.appendChild(li);
  }
  return true;
}

export function initNip66Suggestions(aggregator: Nip66Aggregator | null | undefined): void {
  if (!aggregator) return;
  aggregator.start();

  let attempts = 0;
  const nip66PollId = window.setInterval(() => {
    attempts++;
    const rendered = renderNip66Suggestions(aggregator);
    if (rendered || attempts >= 10) {
      window.clearInterval(nip66PollId);
    }
  }, 100);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(nip66PollId);
    aggregator.stop();
  });
}
