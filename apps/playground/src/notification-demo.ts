/**
 * notification-demo.ts — Host-owned notification controller for the demo.
 *
 * Owns all host-side notification UX state. The notification service calls
 * handleServiceChange() when its state changes; the controller derives
 * snapshot fields and notifies subscribers. All lifecycle actions dispatch
 * canonical notify.* NappletMessage envelopes through the service handler.
 *
 * Architecture principle: service is browser-agnostic and host-owned;
 * this controller is the bridge between the service callback and the DOM
 * rendering code in main.ts.
 *
 * Per DEMO-07: notify.* envelopes (not ifc.emit topic wrappers) are the
 * canonical v1.2 dispatch shape. Host-originated envelopes are also recorded
 * through the demo message tap so debugger.ts sees them alongside iframe traffic.
 */

import type { Notification } from '@kehto/services';
import type { ServiceHandler } from '@kehto/shell';
import type { NappletMessage } from '@kehto/shell';
import { getMessageTap } from './shell-host.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DemoNotificationSnapshot {
  notifications: readonly Notification[];
  unreadCount: number;
  lastUpdatedAt: number | null;
  /** Host-visible label identifying the most recent notification source. */
  sourceLabel: string | null;
}

export interface DemoNotificationController {
  getSnapshot(): DemoNotificationSnapshot;
  subscribe(listener: (snapshot: DemoNotificationSnapshot) => void): () => void;
  /** Called by the notification service onChange callback. */
  handleServiceChange(notifications: readonly Notification[]): void;
  /** Connect the service handler so actions flow through the real service path. */
  connectService(handler: ServiceHandler): void;
  /** Send a notify.create envelope through the real service path. */
  createDemoNotification(input: { title: string; body: string; sourceLabel: string }): void;
  /** Send a notify.list request through the real service path. */
  requestList(windowId?: string): void;
  /** Send a notify.read envelope for the given notification id. */
  markRead(id: string): void;
  /** Send a notify.dismiss envelope for the given notification id. */
  dismiss(id: string): void;
}

// ─── Host-side window ID used for direct host-originated notifications ────────

export const DEMO_HOST_WINDOW_ID = '__demo-host__';

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `notif-host-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create the host-owned notification controller.
 *
 * @returns A DemoNotificationController instance
 *
 * @example
 * ```ts
 * const controller = createDemoNotificationController();
 * controller.subscribe((snapshot) => renderNotifications(snapshot));
 * ```
 */
export function createDemoNotificationController(): DemoNotificationController {
  let _notifications: readonly Notification[] = [];
  let _lastUpdatedAt: number | null = null;
  let _sourceLabel: string | null = null;
  let _serviceHandler: ServiceHandler | null = null;
  const _listeners: Array<(snapshot: DemoNotificationSnapshot) => void> = [];

  function buildSnapshot(): DemoNotificationSnapshot {
    return {
      notifications: _notifications,
      unreadCount: _notifications.filter((n) => !n.read).length,
      lastUpdatedAt: _lastUpdatedAt,
      sourceLabel: _sourceLabel,
    };
  }

  function notifyListeners(): void {
    const snap = buildSnapshot();
    for (const listener of _listeners) {
      try { listener(snap); } catch { /* ignore listener errors */ }
    }
  }

  /**
   * Dispatch a canonical notify.* NappletMessage envelope to the service handler
   * AND record it in the demo message tap so debugger.ts sees host-originated
   * traffic the same way it sees iframe postMessage traffic.
   *
   * Without tap recording, host-originated service calls are invisible to the
   * debugger because the tap only watches iframe postMessage (17-04 tap surface).
   * The source label 'demo-host' distinguishes host-originated rows in the log.
   *
   * Per DEMO-07: no BusKind, no IPC_PEER, no ifc-emit topic tags.
   */
  function dispatchEnvelope(
    handler: ServiceHandler | null,
    envelope: NappletMessage,
    windowId = DEMO_HOST_WINDOW_ID,
  ): void {
    if (!handler) {
      console.warn('[notification-demo] service not connected — cannot dispatch', envelope.type);
      return;
    }
    // Record the inbound request on the tap so debugger shows it.
    getMessageTap()?.recordInboundEnvelope(envelope, 'demo-host');
    handler.handleMessage(windowId, envelope, (reply) => {
      // Record the reply as well — gives debugger the full request/reply pair.
      if (reply) getMessageTap()?.recordOutboundEnvelope(reply as NappletMessage, 'demo-host');
    });
  }

  return {
    getSnapshot() {
      return buildSnapshot();
    },

    subscribe(listener) {
      _listeners.push(listener);
      return () => {
        const i = _listeners.indexOf(listener);
        if (i !== -1) _listeners.splice(i, 1);
      };
    },

    handleServiceChange(notifications: readonly Notification[]) {
      _notifications = notifications;
      _lastUpdatedAt = Date.now();
      // sourceLabel reflects the real service path for educational cues
      _sourceLabel = notifications.length > 0 ? 'notify.create via service' : null;
      notifyListeners();
    },

    connectService(handler: ServiceHandler) {
      _serviceHandler = handler;
    },

    createDemoNotification(input: { title: string; body: string; sourceLabel: string }) {
      _sourceLabel = input.sourceLabel;
      const envelope: NappletMessage = {
        type: 'notify.create',
        id: makeId(),
        title: input.title,
        body: input.body,
      } as NappletMessage;
      dispatchEnvelope(_serviceHandler, envelope);
    },

    requestList(windowId?: string) {
      const envelope: NappletMessage = {
        type: 'notify.list',
        id: makeId(),
      } as NappletMessage;
      dispatchEnvelope(_serviceHandler, envelope, windowId ?? DEMO_HOST_WINDOW_ID);
    },

    markRead(id: string) {
      const envelope: NappletMessage = {
        type: 'notify.read',
        id: makeId(),
        notificationId: id,
      } as NappletMessage;
      dispatchEnvelope(_serviceHandler, envelope);
    },

    dismiss(id: string) {
      const envelope: NappletMessage = {
        type: 'notify.dismiss',
        id: makeId(),
        notificationId: id,
      } as NappletMessage;
      dispatchEnvelope(_serviceHandler, envelope);
    },
  };
}
