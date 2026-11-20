import type { DomainFixture, OperationCase, PushCase } from './types.js';

/** Action id the push notifications offer and a target's `notify.action` control reports. */
export const NOTIFY_ACTION_ID = 'conformance-ok';

const sendCase = (id: string, title: string): OperationCase => ({
  id, type: 'notify.send',
  payload: { title, body: 'Conformance notification', priority: 'normal', actions: [{ id: NOTIFY_ACTION_ID, label: 'OK' }] },
  semantics: {
    rule: 'The shell MUST respond to notify.send with notify.send.result carrying the same id and the shell-assigned notificationId',
    verify: (reply) => (typeof reply?.notificationId === 'string' && reply.notificationId.length > 0 ? null : `notificationId was ${JSON.stringify(reply?.notificationId)}`),
  },
});

/** A notification sent, then a host-side user interaction with it (the shell MAY send these). */
const interaction = (name: string, type: string, control: string, match?: Record<string, unknown>): PushCase => ({
  id: `notify/${name}`, type,
  subscribe: sendCase(`notify/send-for-${name}`, `Conformance ${name}`),
  trigger: { control },
  ...(match ? { match } : {}),
});

/**
 * NAP-NOTIFY at the pinned draft head. Wire names follow the Wire Protocol table
 * (`notify.channel.register`, `notify.permission.request` answered by
 * `notify.permission.result`); the API Surface table's `notify.registerChannel`
 * and `notify.requestPermission(.result)` contradict it and are not used.
 * Interaction pushes are delivery-only: the NAP defines no message that stops them.
 */
export const NOTIFY_FIXTURE: DomainFixture = {
  domain: 'notify',
  cases: [
    {
      id: 'notify/permission.request', type: 'notify.permission.request', reply: 'notify.permission.result', payload: { channel: 'conformance' },
      semantics: {
        rule: 'The shell MUST respond to notify.permission.request with notify.permission.result carrying the same id and a boolean granted',
        verify: (reply) => (typeof reply?.granted === 'boolean' ? null : `granted was ${JSON.stringify(reply?.granted)}`),
      },
    },
    { id: 'notify/channel.register', type: 'notify.channel.register', reply: null, noId: true, payload: { channelId: 'conformance', label: 'Conformance', description: 'Conformance channel', defaultPriority: 'normal' } },
    sendCase('notify/send', 'Conformance send'),
    { id: 'notify/badge', type: 'notify.badge', reply: null, noId: true, payload: { count: 3 } },
    // An id the shell never assigned: "The shell MUST silently ignore messages referencing unknown notification IDs."
    { id: 'notify/dismiss-unknown', type: 'notify.dismiss', reply: null, noId: true, payload: { notificationId: 'conformance-unknown-notification' } },
  ],
  pushes: [
    interaction('action', 'notify.action', 'notify.action', { actionId: NOTIFY_ACTION_ID }),
    interaction('clicked', 'notify.clicked', 'notify.click'),
    interaction('dismissed', 'notify.dismissed', 'notify.dismissByUser', { reason: 'user' }),
  ],
};
