/**
 * domains/notify.ts — Mock NAP-NOTIFY service.
 *
 * Spec: naps/NAP-NOTIFY.md @ napplet/naps PR #11 head 67877ef6 (draft)
 * Routes: notify.send, notify.dismiss, notify.badge, notify.channel.register,
 *   notify.permission.request; pushes notify.controls, notify.action,
 *   notify.clicked, notify.dismissed
 * Spec gaps / decisions:
 *   - Permission is auto-granted (`grantPermission: false` flips every
 *     `notify.send` to `error: 'permission denied'` and every permission
 *     result to `granted: false`).
 *   - `notify.permission.result` is the NAP's result type (not
 *     `notify.permission.request.result`), so it is built by hand.
 *   - A `channel` that the window never registered is rejected with
 *     `error: 'invalid channel'`; more than three `actions` are truncated
 *     (the shell MAY limit the number of actions displayed).
 *   - `notify.controls` is pushed once per window before its first result.
 *   - Napplet-initiated `notify.dismiss` removes the notification silently;
 *     `interact(id, 'dismissed')` models shell-side dismissal and pushes
 *     `notify.dismissed`.
 */
import type { NappletMessage } from '@kehto/runtime';
import type {
  NotificationAction,
  NotificationChannel,
  NotificationPriority,
  NotifyControl,
  NotifyDismissedMessage,
} from '@napplet/nap/notify/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** Spec document read when this mock was written. */
export const NOTIFY_SPEC_REF: NapSpecRef = {
  nap: 'NAP-NOTIFY',
  status: 'draft',
  source: 'pr',
  pr: 11,
  sha: '67877ef6',
  path: 'naps/NAP-NOTIFY.md',
};

const PRIORITIES: readonly NotificationPriority[] = Object.freeze(['low', 'normal', 'high', 'urgent']);
const DEFAULT_CONTROLS: readonly NotifyControl[] = Object.freeze(['toasts', 'badges', 'actions', 'channels']);
const MAX_ACTIONS = 3;

/**
 * One active notification the mock keeps.
 *
 * @example
 * ```ts
 * const [first] = service.mock.state().notifications.values();
 * first.title; // 'New message'
 * ```
 */
export interface MockNotification {
  /** Shell-assigned id, e.g. `shell-1`. */
  notificationId: string;
  /** Owning window. */
  windowId: string;
  /** Notification title. */
  title: string;
  /** Body text, when given. */
  body?: string;
  /** Icon reference, when given. */
  icon?: string;
  /** Action buttons (at most three). */
  actions: NotificationAction[];
  /** Channel id, when given. */
  channel?: string;
  /** Effective priority (`normal` when omitted). */
  priority: NotificationPriority;
  /** `clock.now()` at creation. */
  createdAt: number;
}

/**
 * In-memory state of the notify mock.
 *
 * @example
 * ```ts
 * service.mock.state().badges.get('w1'); // 3
 * ```
 */
export interface MockNotifyState {
  /** Active notifications by id. */
  notifications: Map<string, MockNotification>;
  /** Badge count per window. */
  badges: Map<string, number>;
  /** Registered channels per window, keyed by channel id. */
  channels: Map<string, Map<string, NotificationChannel>>;
  /** Windows that already received `notify.controls`. */
  controlsSent: Set<string>;
  /** Monotonic id counter. */
  counter: number;
}

/**
 * Options for `createMockNotifyService`.
 *
 * @example
 * ```ts
 * const options: MockNotifyOptions = { controls: ['toasts', 'badges'], grantPermission: false };
 * ```
 */
export interface MockNotifyOptions extends MockServiceOptions {
  /** Controls advertised in `notify.controls`. Default `toasts, badges, actions, channels`. */
  controls?: readonly NotifyControl[];
  /** Whether permission requests succeed and sends are accepted. Default `true`. */
  grantPermission?: boolean;
}

/**
 * A simulated user interaction for `interact()`.
 *
 * @example
 * ```ts
 * const action: MockNotifyInteraction = { type: 'action', actionId: 'reply' };
 * ```
 */
export type MockNotifyInteraction =
  | { type: 'clicked' }
  | { type: 'action'; actionId: string }
  | { type: 'dismissed'; reason?: NotifyDismissedMessage['reason'] };

/**
 * The notify mock service with its `interact` control.
 *
 * @example
 * ```ts
 * const notify = createMockNotifyService();
 * notify.interact('shell-1', 'clicked');
 * notify.interact('shell-1', { type: 'dismissed', reason: 'timeout' });
 * ```
 */
export type MockNotifyService = MockService<MockNotifyState> & {
  /**
   * Simulate the user interacting with a notification and push the matching
   * `notify.action`, `notify.clicked`, or `notify.dismissed` to its window.
   * A string is `'clicked'`, `'dismissed'`, or an action id.
   *
   * @param notificationId - Shell-assigned id from `notify.send.result`.
   * @param interaction - What the user did.
   * @returns `false` when the id or action is unknown (nothing is pushed).
   */
  interact(notificationId: string, interaction: MockNotifyInteraction | string): boolean;
};

function normalizeInteraction(interaction: MockNotifyInteraction | string): MockNotifyInteraction {
  if (typeof interaction !== 'string') return interaction;
  if (interaction === 'clicked' || interaction === 'dismissed') return { type: interaction };
  return { type: 'action', actionId: interaction };
}

function parseActions(raw: unknown): NotificationAction[] | undefined {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return undefined;
  const actions: NotificationAction[] = [];
  for (const item of raw) {
    const action = item as Partial<NotificationAction> | null;
    if (!action || typeof action.id !== 'string' || typeof action.label !== 'string') return undefined;
    actions.push({ id: action.id, label: action.label });
  }
  return actions.slice(0, MAX_ACTIONS);
}

function ensureControls(context: MockRouteContext<MockNotifyState>, controls: readonly NotifyControl[]): void {
  if (context.state.controlsSent.has(context.windowId)) return;
  context.state.controlsSent.add(context.windowId);
  context.push({ type: 'notify.controls', controls: [...controls] } as NappletMessage);
}

function handleSend(context: MockRouteContext<MockNotifyState>, options: MockNotifyOptions): void {
  const { message, windowId, state, clock, reply, fail } = context;
  if (options.grantPermission === false) return fail('permission denied');
  if (typeof message.title !== 'string' || message.title.length === 0) return fail('invalid notification');
  const actions = parseActions(message.actions);
  if (!actions) return fail('invalid notification');
  if (message.priority !== undefined && !PRIORITIES.includes(message.priority as NotificationPriority)) return fail('invalid notification');
  if (message.channel !== undefined && !state.channels.get(windowId)?.has(String(message.channel))) return fail('invalid channel');
  state.counter += 1;
  const notificationId = `shell-${state.counter}`;
  state.notifications.set(notificationId, {
    notificationId,
    windowId,
    title: message.title,
    ...(typeof message.body === 'string' ? { body: message.body } : {}),
    ...(typeof message.icon === 'string' ? { icon: message.icon } : {}),
    actions,
    ...(typeof message.channel === 'string' ? { channel: message.channel } : {}),
    priority: (message.priority as NotificationPriority | undefined) ?? 'normal',
    createdAt: clock.now(),
  });
  reply({ notificationId });
}

function handleChannelRegister({ message, windowId, state }: MockRouteContext<MockNotifyState>): void {
  if (typeof message.channelId !== 'string' || typeof message.label !== 'string') return;
  const channels = state.channels.get(windowId) ?? new Map<string, NotificationChannel>();
  channels.set(message.channelId, {
    channelId: message.channelId,
    label: message.label,
    ...(typeof message.description === 'string' ? { description: message.description } : {}),
    ...(PRIORITIES.includes(message.defaultPriority as NotificationPriority)
      ? { defaultPriority: message.defaultPriority as NotificationPriority }
      : {}),
  });
  state.channels.set(windowId, channels);
}

/**
 * Create the NAP-NOTIFY mock. Notifications live in `mock.state()` until
 * dismissed; `interact()` drives the shell-initiated pushes.
 *
 * @param options - Controls, permission policy, and shared mock options.
 * @returns The notify mock service.
 * @example
 * ```ts
 * const notify = createMockNotifyService();
 * notify.handleMessage('w1', { type: 'notify.send', id: 'n1', title: 'New message' }, send);
 * // → notify.controls push, then { type: 'notify.send.result', id: 'n1', notificationId: 'shell-1' }
 * ```
 */
export function createMockNotifyService(options: MockNotifyOptions = {}): MockNotifyService {
  const controls = options.controls ?? DEFAULT_CONTROLS;
  const base = defineMockService<MockNotifyState>({
    domain: 'notify',
    version: '1.0.0',
    description: 'Mock NAP-NOTIFY shell-rendered notifications',
    kind: 'service',
    initialState: () => ({ notifications: new Map(), badges: new Map(), channels: new Map(), controlsSent: new Set(), counter: 0 }),
    routes: {
      'notify.send': (context) => { ensureControls(context, controls); handleSend(context, options); },
      'notify.dismiss': (context) => {
        ensureControls(context, controls);
        const entry = context.state.notifications.get(String(context.message.notificationId));
        if (entry?.windowId === context.windowId) context.state.notifications.delete(entry.notificationId);
      },
      'notify.badge': (context) => {
        ensureControls(context, controls);
        const count = Number(context.message.count);
        if (!Number.isFinite(count)) return;
        context.state.badges.set(context.windowId, Math.max(0, Math.floor(count)));
      },
      'notify.channel.register': (context) => { ensureControls(context, controls); handleChannelRegister(context); },
      'notify.permission.request': (context) => {
        ensureControls(context, controls);
        const id = typeof context.message.id === 'string' ? context.message.id : '';
        context.push({ type: 'notify.permission.result', id, granted: options.grantPermission !== false } as NappletMessage);
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [id, entry] of state.notifications) if (entry.windowId === windowId) state.notifications.delete(id);
      state.badges.delete(windowId);
      state.channels.delete(windowId);
      state.controlsSent.delete(windowId);
    },
  }, options);

  const service: MockNotifyService = Object.assign(base, {
    interact(notificationId: string, interaction: MockNotifyInteraction | string): boolean {
      const state = base.mock.state();
      const entry = state.notifications.get(notificationId);
      if (!entry) return false;
      const action = normalizeInteraction(interaction);
      let envelope: NappletMessage;
      if (action.type === 'action') {
        if (!entry.actions.some((item) => item.id === action.actionId)) return false;
        envelope = { type: 'notify.action', notificationId, actionId: action.actionId } as NappletMessage;
      } else if (action.type === 'clicked') {
        envelope = { type: 'notify.clicked', notificationId } as NappletMessage;
      } else {
        state.notifications.delete(notificationId);
        envelope = { type: 'notify.dismissed', notificationId, ...(action.reason ? { reason: action.reason } : {}) } as NappletMessage;
      }
      return pushToWindow(base, entry.windowId, envelope);
    },
  });
  return service;
}

/** Registry row for the notify mock. */
export const NOTIFY_MOCK_ENTRY: MockDomainEntry = {
  domain: 'notify',
  kind: 'service',
  spec: NOTIFY_SPEC_REF,
  create: (options) => createMockNotifyService(options),
};
