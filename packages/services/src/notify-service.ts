/**
 * notify-service.ts — NIP-5D notify NAP reference service (stub-level).
 *
 * Handles the 5 napplet -> shell request types from `@napplet/nap/notify`:
 *   - `notify.send`                -> `notify.send.result` (shell-assigned id)
 *   - `notify.dismiss`             -> fire-and-forget
 *   - `notify.badge`               -> fire-and-forget
 *   - `notify.channel.register`    -> fire-and-forget
 *   - `notify.permission.request`  -> `notify.permission.result { granted }`
 *
 * Stub-level: no real Notification API calls, no real channel registry.
 * Host apps wire a real backend via
 * `runtime.registerService('notify', realHandler)`.
 *
 * Coexistence note: this is SEPARATE from
 * `packages/services/src/notification-service.ts`, which is the legacy
 * ifc-topic-based notification registry (operates on `ifc.emit` topics
 * under `notifications:*`). `notify-service.ts` is the canonical
 * `@napplet/nap/notify` NIP-5D path and lives alongside the legacy module.
 * If the host app registers this service via
 * `runtime.registerService('notify', ...)`, @napplet/nap/notify messages
 * land here; the legacy ifc-emit topic path remains untouched.
 *
 * Shell -> napplet push messages (`notify.action`, `notify.clicked`,
 * `notify.dismissed`, `notify.controls`) are not emitted by this stub —
 * they are the host app's responsibility and are deferred to a future plan.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  NotifySendMessage,
  NotifySendResultMessage,
  NotifyPermissionRequestMessage,
  NotifyPermissionResultMessage,
} from '@napplet/nap/notify/types';

/** Notify service version — follows semver. */
const NOTIFY_SERVICE_VERSION = '1.0.0';

/**
 * Optional configuration for `createNotifyService`.
 *
 * @example
 * ```ts
 * const notify = createNotifyService({
 *   generateId: () => crypto.randomUUID(),
 *   defaultGrant: false,
 *   onSend: (windowId, msg) => console.log(`napplet ${windowId} sent ${msg.title}`),
 * });
 * runtime.registerService('notify', notify);
 * ```
 */
export interface NotifyServiceOptions {
  /**
   * Generate a shell-assigned notification ID for `notify.send.result`.
   * Default: a monotonically increasing `shell-<n>` counter.
   */
  generateId?: () => string;
  /**
   * Default permission grant for `notify.permission.request`.
   * Host apps that want real permission prompts should replace this
   * service with a real backend via `runtime.registerService`.
   * Default: `true`.
   */
  defaultGrant?: boolean;
  /**
   * Called synchronously when a napplet dispatches `notify.send`.
   * Intended for host-app plumbing (UI toast, logging, etc.) without
   * requiring a full backend replacement.
   */
  onSend?: (windowId: string, payload: NotifySendMessage) => void;
}

/**
 * Create a stub-level notify service handler.
 *
 * Answers the 5 napplet->shell request types from `@napplet/nap/notify`.
 * Does NOT implement a real backend (no DOM Notification API, no channel
 * registry, no permission prompt). Host apps replace this via
 * `runtime.registerService('notify', realHandler)` when a real backend is
 * needed.
 *
 * @param options - Optional service configuration (see NotifyServiceOptions)
 * @returns A ServiceHandler to register with the runtime under domain `notify`
 *
 * @example
 * ```ts
 * import { createNotifyService } from '@kehto/services';
 *
 * const notify = createNotifyService();
 * runtime.registerService('notify', notify);
 * ```
 */
export function createNotifyService(options: NotifyServiceOptions = {}): ServiceHandler {
  let counter = 0;
  const gen = options.generateId ?? ((): string => {
    counter += 1;
    return `shell-${counter}`;
  });
  const defaultGrant = options.defaultGrant ?? true;

  const descriptor: ServiceDescriptor = {
    name: 'notify',
    version: NOTIFY_SERVICE_VERSION,
    description: 'NIP-5D notify NAP reference handler (stub)',
  };

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      switch (message.type) {
        case 'notify.send': {
          const m = message as NotifySendMessage;
          options.onSend?.(windowId, m);
          const result: NotifySendResultMessage = {
            type: 'notify.send.result',
            id: m.id,
            notificationId: gen(),
          };
          send(result as NappletMessage);
          return;
        }

        case 'notify.dismiss':
        case 'notify.badge':
        case 'notify.channel.register':
          // state to mutate; host apps with real backends override.
          return;

        case 'notify.permission.request': {
          const m = message as NotifyPermissionRequestMessage;
          const result: NotifyPermissionResultMessage = {
            type: 'notify.permission.result',
            id: m.id,
            granted: defaultGrant,
          };
          send(result as NappletMessage);
          return;
        }

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

    onWindowDestroyed(_windowId: string): void {
      // No per-window state in the stub. Host apps with real backends
      // override to clean up pending notifications / channel registrations.
    },
  };
}
