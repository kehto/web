/**
 * domains/dm.ts — Mock NAP-DM service.
 *
 * Spec: naps/NAP-DM.md @ napplet/naps PR #74 head 2c4e4423f40e (draft)
 * Routes: dm.status, dm.conversations, dm.messages, dm.send, dm.subscribe,
 *         dm.unsubscribe
 * Pushes: dm.message (live delivery to matching subscriptions)
 * Spec gaps / decisions:
 * - The draft names no error for malformed requests; the mock answers
 *   `invalid request` (its "common errors" list is open-ended).
 * - A sent message is also delivered to the sender's own live subscriptions
 *   (status `sent`), so a second window stays in sync.
 * - Recipients must be fixture accounts; anything else is `invalid recipient`.
 * - `dm.unsubscribe` on an id this window does not own is `not found`.
 * - Pages are newest-first; `cursor` is an opaque offset.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { DmConversation, DmMessage, DmPeer, DmStatus } from '@napplet/nap/dm/types';
import { DEFAULT_CLOCK, defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import { mockHex } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_ACCOUNTS, MOCK_EPOCH_SECONDS, findMockAccount, type MockAccount } from '../fixtures/nostr.js';

/**
 * NAP-DM draft the mock implements.
 *
 * @example
 * ```ts
 * DM_SPEC_REF.pr === 74;
 * ```
 */
export const DM_SPEC_REF: NapSpecRef = {
  nap: 'NAP-DM',
  status: 'draft',
  source: 'pr',
  pr: 74,
  sha: '2c4e4423f40e',
  path: 'naps/NAP-DM.md',
};

/**
 * One live subscription.
 *
 * @example
 * ```ts
 * const sub: MockDmSubscription = { subscriptionId: 'live-1', windowId: 'win-1' };
 * ```
 */
export interface MockDmSubscription {
  /** Runtime-assigned id. */
  subscriptionId: string;
  /** Owning window. */
  windowId: string;
  /** Conversation filter; absent means every conversation. */
  conversationId?: string;
}

/**
 * In-memory state of the mock DM service.
 *
 * @example
 * ```ts
 * service.mock.state().conversations.map((c) => c.id);
 * ```
 */
export interface MockDmState {
  /** The shell user. */
  owner: MockAccount;
  /** Whether the runtime can service direct messages. */
  available: boolean;
  /** Conversation summaries. */
  conversations: DmConversation[];
  /** Conversation id → messages, oldest first. */
  messages: Map<string, DmMessage[]>;
  /** Subscription id → subscription. */
  subscriptions: Map<string, MockDmSubscription>;
}

/**
 * Options for `createMockDmService`.
 *
 * @example
 * ```ts
 * const dm = createMockDmService({ owner: 'bob', pageSize: 5 });
 * ```
 */
export interface MockDmOptions extends MockServiceOptions {
  /** Fixture account name acting as the shell user. Default `alice`. */
  owner?: string;
  /** Initial availability. Default `true`. */
  available?: boolean;
  /** Default page size for conversations and messages. Default 20. */
  pageSize?: number;
}

/**
 * Mock DM service with an inbound-message control.
 *
 * @example
 * ```ts
 * const dm = createMockDmService();
 * dm.receive('bob', 'ping');
 * ```
 */
export type MockDmService = MockService<MockDmState> & {
  /** Inject an inbound message from a fixture account; returns it, or `undefined` for an unknown sender. */
  receive(fromName: string, text: string, conversationId?: string): DmMessage | undefined;
  /** Flip runtime availability (`dm.status.available`). */
  setAvailable(available: boolean): void;
};

type Context = MockRouteContext<MockDmState>;

const HEX64 = /^[0-9a-f]{64}$/;

function peer(account: MockAccount): DmPeer {
  return { pubkey: account.pubkey, label: account.displayName, avatar: `https://avatars.example.org/${account.name}.png` };
}

function account(name: string): MockAccount {
  return findMockAccount(name) as MockAccount;
}

interface SeedLine { from: string; text: string }

function seedConversation(
  state: MockDmState,
  id: string,
  kind: 'direct' | 'group',
  members: readonly string[],
  lines: readonly SeedLine[],
  subject?: string,
): void {
  const base = MOCK_EPOCH_SECONDS + 86_400 + state.conversations.length * 3_600;
  const messages = lines.map((line, index) => ({
    id: mockHex(`dm:${id}:${index}`, 32),
    conversationId: id,
    senderPubkey: account(line.from).pubkey,
    createdAt: base + index * 120,
    content: line.text,
    status: line.from === state.owner.name ? 'sent' : 'received',
  } satisfies DmMessage));
  state.messages.set(id, messages);
  const lastSent = messages.map((item) => item.status).lastIndexOf('sent');
  const unread = messages.slice(lastSent + 1).filter((item) => item.status === 'received').length;
  state.conversations.push({
    id,
    kind,
    participants: members.map((name) => peer(account(name))),
    ...(subject ? { subject } : {}),
    unread,
    updatedAt: messages[messages.length - 1]?.createdAt ?? base,
  });
}

function seedState(owner: MockAccount, available: boolean): MockDmState {
  const state: MockDmState = { owner, available, conversations: [], messages: new Map(), subscriptions: new Map() };
  const me = owner.name;
  const others = MOCK_ACCOUNTS.filter((item) => item.name !== me).map((item) => item.name);
  const [first = 'bob', second = 'carol', third = 'dave', fourth = 'erin', fifth = 'frank'] = others;
  seedConversation(state, `conv-${first}`, 'direct', [me, first], [
    { from: first, text: 'Did the Debian netinst mirror finish syncing?' },
    { from: me, text: 'Yes, checksums verified an hour ago.' },
    { from: first, text: 'Great, I will announce it tonight.' },
  ]);
  seedConversation(state, `conv-${second}`, 'direct', [me, second], [
    { from: second, text: 'Arch 2024.11.01 ISO is up on mirror-b.' },
    { from: me, text: 'Pulling it now.' },
  ]);
  seedConversation(state, `conv-${third}`, 'direct', [me, third], [
    { from: third, text: 'Release notes for Fedora 41 are drafted, want to review?' },
  ]);
  seedConversation(state, 'conv-mirror-ops', 'group', [me, fourth, fifth], [
    { from: fourth, text: 'Community relay is back after the reboot.' },
    { from: fifth, text: 'Packaging the Mint 22 Cinnamon image today.' },
  ], 'Mirror ops');
  return state;
}

function status(state: MockDmState): DmStatus {
  if (!state.available) return { available: false, implementations: [], capabilities: [] };
  return { available: true, ownerPubkey: state.owner.pubkey, implementations: ['mock'], capabilities: ['direct', 'group', 'history', 'live'] };
}

function pageArgs(message: Record<string, unknown>, pageSize: number): { offset: number; limit: number } | null {
  if (message.cursor !== undefined && typeof message.cursor !== 'string') return null;
  if (message.limit !== undefined && !(Number.isInteger(message.limit) && (message.limit as number) >= 0)) return null;
  const offset = typeof message.cursor === 'string' ? Number.parseInt(message.cursor, 10) : 0;
  if (!Number.isInteger(offset) || offset < 0) return null;
  return { offset, limit: typeof message.limit === 'number' ? message.limit : pageSize };
}

function page<T>(items: readonly T[], args: { offset: number; limit: number }): { slice: T[]; cursor?: string } {
  const slice = items.slice(args.offset, args.offset + args.limit);
  const next = args.offset + args.limit;
  return next < items.length ? { slice, cursor: String(next) } : { slice };
}

function conversationsRoute(pageSize: number): (context: Context) => void {
  return ({ message, state, reply, fail }) => {
    if (!state.available) { fail('unavailable'); return; }
    const args = pageArgs(message, pageSize);
    if (!args) { fail('invalid request'); return; }
    const sorted = [...state.conversations].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const { slice, cursor } = page(sorted, args);
    reply({ conversations: slice, ...(cursor ? { cursor } : {}) });
  };
}

function messagesRoute(pageSize: number): (context: Context) => void {
  return ({ message, state, reply, fail }) => {
    if (!state.available) { fail('unavailable'); return; }
    const args = pageArgs(message, pageSize);
    if (!args || typeof message.conversationId !== 'string') { fail('invalid request'); return; }
    const history = state.messages.get(message.conversationId);
    if (!history) { fail('not found'); return; }
    const { slice, cursor } = page([...history].reverse(), args);
    reply({ messages: slice, ...(cursor ? { cursor } : {}) });
  };
}

function directConversation(state: MockDmState, other: MockAccount): DmConversation | undefined {
  return state.conversations.find((item) =>
    item.kind === 'direct' && item.participants.length === 2 && item.participants.some((p) => p.pubkey === other.pubkey));
}

function createConversation(state: MockDmState, id: string, members: readonly MockAccount[], now: number): DmConversation {
  const conversation: DmConversation = {
    id,
    kind: members.length > 2 ? 'group' : 'direct',
    participants: members.map(peer),
    unread: 0,
    updatedAt: now,
  };
  state.conversations.push(conversation);
  state.messages.set(id, []);
  return conversation;
}

function append(state: MockDmState, conversation: DmConversation, message: DmMessage): void {
  state.messages.get(conversation.id)?.push(message);
  conversation.updatedAt = message.createdAt;
  if (message.status === 'received') conversation.unread += 1;
}

/**
 * Create the mock NAP-DM service.
 *
 * @param options - Owner, availability and page size.
 * @returns A `ServiceHandler` for `runtime.registerService('dm', …)` with mock controls.
 * @example
 * ```ts
 * const dm = createMockDmService();
 * dm.handleMessage('win-1', { type: 'dm.status', id: 's1' }, console.log);
 * ```
 */
export function createMockDmService(options: MockDmOptions = {}): MockDmService {
  const owner = findMockAccount(options.owner ?? 'alice') ?? (MOCK_ACCOUNTS[0] as MockAccount);
  const pageSize = options.pageSize ?? 20;

  const fanOut = (state: MockDmState, message: DmMessage): void => {
    for (const sub of state.subscriptions.values()) {
      if (sub.conversationId !== undefined && sub.conversationId !== message.conversationId) continue;
      pushToWindow(service, sub.windowId, { type: 'dm.message', subscriptionId: sub.subscriptionId, message } as NappletMessage);
    }
  };

  const sendRoute = ({ message, state, reply, fail, rng, clock }: Context): void => {
    if (!state.available) { fail('unavailable'); return; }
    if (typeof message.content !== 'string' || message.content.length === 0) { fail('invalid request'); return; }
    if (message.conversationId !== undefined && typeof message.conversationId !== 'string') { fail('invalid request'); return; }
    const recipients = message.recipients;
    if (!Array.isArray(recipients) || recipients.length === 0) { fail('invalid request'); return; }
    const members: MockAccount[] = [];
    for (const pubkey of recipients) {
      const found = typeof pubkey === 'string' && HEX64.test(pubkey) ? findMockAccount(pubkey) : undefined;
      if (!found || found.pubkey === state.owner.pubkey) { fail('invalid recipient'); return; }
      members.push(found);
    }
    const now = Math.floor(clock.now() / 1000);
    let conversation: DmConversation | undefined;
    if (typeof message.conversationId === 'string') {
      conversation = state.conversations.find((item) => item.id === message.conversationId);
      if (!conversation) { fail('not found'); return; }
    } else {
      conversation = (members.length === 1 ? directConversation(state, members[0] as MockAccount) : undefined)
        ?? createConversation(state, `conv-${rng.hex(8)}`, [state.owner, ...members], now);
    }
    const sent: DmMessage = { id: `msg-${rng.hex(16)}`, conversationId: conversation.id, senderPubkey: state.owner.pubkey, createdAt: now, content: message.content, status: 'sent' };
    append(state, conversation, sent);
    reply({ ok: true, message: sent });
    fanOut(state, sent);
  };

  const subscribeRoute = ({ message, windowId, state, reply, fail, rng }: Context): void => {
    if (!state.available) { fail('unavailable'); return; }
    if (message.conversationId !== undefined && typeof message.conversationId !== 'string') { fail('invalid request'); return; }
    if (typeof message.conversationId === 'string' && !state.messages.has(message.conversationId)) { fail('not found'); return; }
    const subscriptionId = `live-${rng.hex(8)}`;
    state.subscriptions.set(subscriptionId, {
      subscriptionId, windowId, ...(typeof message.conversationId === 'string' ? { conversationId: message.conversationId } : {}),
    });
    reply({ subscriptionId });
  };

  const unsubscribeRoute = ({ message, windowId, state, reply, fail }: Context): void => {
    const sub = typeof message.subscriptionId === 'string' ? state.subscriptions.get(message.subscriptionId) : undefined;
    if (!sub || sub.windowId !== windowId) { fail('not found'); return; }
    state.subscriptions.delete(sub.subscriptionId);
    reply({ ok: true });
  };

  const dropWindow = (state: MockDmState, windowId: string): void => {
    for (const [id, sub] of state.subscriptions) if (sub.windowId === windowId) state.subscriptions.delete(id);
  };

  const base = defineMockService<MockDmState>({
    domain: 'dm',
    version: '1.0.0',
    description: 'Mock NAP-DM: seeded conversations between fixture accounts with live delivery',
    kind: 'service',
    initialState: () => seedState(owner, options.available ?? true),
    routes: {
      'dm.status': ({ state, reply }) => reply({ ...status(state) }),
      'dm.conversations': conversationsRoute(pageSize),
      'dm.messages': messagesRoute(pageSize),
      'dm.send': sendRoute,
      'dm.subscribe': subscribeRoute,
      'dm.unsubscribe': unsubscribeRoute,
    },
    onWindowDestroyed: (windowId, state) => dropWindow(state, windowId),
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null || capability === 'dm:read') dropWindow(state, windowId);
    },
  }, options);

  const service: MockDmService = Object.assign(base, {
    receive(fromName: string, text: string, conversationId?: string): DmMessage | undefined {
      const state = base.mock.state();
      const sender = findMockAccount(fromName);
      if (!sender || sender.pubkey === state.owner.pubkey) return undefined;
      const now = Math.floor((options.clock ?? DEFAULT_CLOCK).now() / 1000);
      const conversation = conversationId !== undefined
        ? state.conversations.find((item) => item.id === conversationId)
        : directConversation(state, sender) ?? createConversation(state, `conv-${sender.name}`, [state.owner, sender], now);
      if (!conversation) return undefined;
      const count = state.messages.get(conversation.id)?.length ?? 0;
      const received: DmMessage = {
        id: mockHex(`dm:${conversation.id}:${count}`, 32),
        conversationId: conversation.id,
        senderPubkey: sender.pubkey,
        createdAt: now,
        content: text,
        status: 'received',
      };
      append(state, conversation, received);
      fanOut(state, received);
      return received;
    },
    setAvailable(available: boolean): void {
      base.mock.state().available = available;
    },
  });
  return service;
}

/**
 * Registry row for the `dm` domain.
 *
 * @example
 * ```ts
 * DM_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'dm';
 * ```
 */
export const DM_MOCK_ENTRY: MockDomainEntry = {
  domain: 'dm',
  kind: 'service',
  spec: DM_SPEC_REF,
  create: (options) => createMockDmService(options),
};
