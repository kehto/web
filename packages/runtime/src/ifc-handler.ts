import type { NappletMessage } from '@napplet/core';
import type { IfcMessage } from '@napplet/nap/ifc/types';

import type { SessionRegistry } from './session-registry.js';
import type { RuntimeAdapter } from './types.js';

interface IfcChannel {
  channelId: string;
  peerA: string;
  peerB: string;
}

type RuntimeIfcMessage = IfcMessage & {
  id?: string;
  topic?: string;
  payload?: unknown;
  target?: string;
  channelId?: string;
};

type IfcDomain = 'ifc' | 'inc';

type IfcState = {
  subscriptions: Map<string, Set<string>>;
  channels: Map<string, IfcChannel>;
  channelsByWindow: Map<string, Set<string>>;
  /** D6: per-window vocabulary tracking — set on first message a window sends. */
  domainByWindow: Map<string, IfcDomain>;
};

export interface IfcRuntime {
  handleMessage(windowId: string, msg: NappletMessage): void;
  destroyWindow(windowId: string): void;
  clear(): void;
}

export function createIfcRuntime(hooks: RuntimeAdapter, sessionRegistry: SessionRegistry): IfcRuntime {
  const state: IfcState = {
    subscriptions: new Map(),
    channels: new Map(),
    channelsByWindow: new Map(),
    domainByWindow: new Map(),
  };

  return {
    handleMessage(windowId: string, msg: NappletMessage): void {
      handleIfcMessage(state, hooks, sessionRegistry, windowId, msg);
    },
    destroyWindow(windowId: string): void {
      removeWindowChannels(state, hooks, windowId);
      removeWindowSubscriptions(state, windowId);
      state.domainByWindow.delete(windowId);
    },
    clear(): void {
      state.subscriptions.clear();
      state.channels.clear();
      state.channelsByWindow.clear();
      state.domainByWindow.clear();
    },
  };
}

/**
 * Extract the domain prefix from a message type (the portion before the first '.').
 * e.g. 'inc.subscribe' → 'inc', 'ifc.channel.open' → 'ifc'
 */
function domainOf(type: string): IfcDomain {
  const dot = type.indexOf('.');
  const d = dot === -1 ? type : type.slice(0, dot);
  return d === 'inc' ? 'inc' : 'ifc';
}

/**
 * Look up the tracked vocabulary for a given window, falling back to a provided
 * default when not yet recorded.
 */
function prefixFor(state: IfcState, windowId: string, fallback: IfcDomain): IfcDomain {
  return state.domainByWindow.get(windowId) ?? fallback;
}

function addChannel(state: IfcState, channelId: string, peerA: string, peerB: string): void {
  state.channels.set(channelId, { channelId, peerA, peerB });
  for (const windowId of [peerA, peerB]) {
    let set = state.channelsByWindow.get(windowId);
    if (!set) {
      set = new Set();
      state.channelsByWindow.set(windowId, set);
    }
    set.add(channelId);
  }
}

function removeChannel(state: IfcState, channelId: string): void {
  const channel = state.channels.get(channelId);
  if (!channel) return;
  state.channels.delete(channelId);
  for (const windowId of [channel.peerA, channel.peerB]) {
    const set = state.channelsByWindow.get(windowId);
    if (!set) continue;
    set.delete(channelId);
    if (set.size === 0) state.channelsByWindow.delete(windowId);
  }
}

function peerOf(state: IfcState, channelId: string, self: string): string | null {
  const channel = state.channels.get(channelId);
  if (!channel) return null;
  if (channel.peerA === self) return channel.peerB;
  if (channel.peerB === self) return channel.peerA;
  return null;
}

function resolveTarget(sessionRegistry: SessionRegistry, target: string): string | null {
  if (sessionRegistry.getEntryByWindowId(target)) return target;
  const entries = sessionRegistry.getAllEntries();
  const byPubkey = entries.find((entry) => entry.pubkey === target);
  return byPubkey?.windowId ?? null;
}

function handleIfcMessage(
  state: IfcState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  msg: NappletMessage,
): void {
  const m = msg as RuntimeIfcMessage;
  const dotIdx = msg.type.indexOf('.');
  const action = msg.type.slice(dotIdx + 1);

  // D6: record the vocabulary this window uses on the first message it sends
  const incomingDomain = domainOf(msg.type);
  if (!state.domainByWindow.has(windowId)) {
    state.domainByWindow.set(windowId, incomingDomain);
  }

  switch (action) {
    case 'emit': handleEmit(state, hooks, windowId, m, incomingDomain); return;
    case 'subscribe': handleSubscribe(state, hooks, windowId, m, incomingDomain); return;
    case 'unsubscribe': handleUnsubscribe(state, windowId, m); return;
    case 'channel.open': handleChannelOpen(state, hooks, sessionRegistry, windowId, m, incomingDomain); return;
    case 'channel.emit': handleChannelEmit(state, hooks, windowId, m, incomingDomain); return;
    case 'channel.broadcast': handleChannelBroadcast(state, hooks, windowId, m, incomingDomain); return;
    case 'channel.list': handleChannelList(state, hooks, windowId, m, incomingDomain); return;
    case 'channel.close': handleChannelClose(state, hooks, windowId, m, incomingDomain); return;
    default: return;
  }
}

function handleEmit(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  senderDomain: IfcDomain,
): void {
  const topic = m.topic ?? '';
  if (!topic) return;
  const subscribers = state.subscriptions.get(topic);
  if (!subscribers) return;
  for (const subscriberWindowId of subscribers) {
    if (subscriberWindowId !== windowId) {
      // D6: use the recipient's own tracked vocabulary; fall back to sender's domain
      const prefix = prefixFor(state, subscriberWindowId, senderDomain);
      hooks.sendToNapplet(subscriberWindowId, { type: `${prefix}.event`, topic, payload: m.payload, sender: windowId } as NappletMessage);
    }
  }
}

function handleSubscribe(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  incomingDomain: IfcDomain,
): void {
  const id = m.id ?? '';
  const topic = m.topic ?? '';
  if (!topic) {
    // D6: direct response echoes the requester's incoming domain prefix
    hooks.sendToNapplet(windowId, { type: `${incomingDomain}.subscribe.result`, id, error: 'missing topic' } as NappletMessage);
    return;
  }
  let subscriptions = state.subscriptions.get(topic);
  if (!subscriptions) {
    subscriptions = new Set();
    state.subscriptions.set(topic, subscriptions);
  }
  subscriptions.add(windowId);
  // D6: direct response echoes the requester's incoming domain prefix
  hooks.sendToNapplet(windowId, { type: `${incomingDomain}.subscribe.result`, id } as NappletMessage);
}

function handleUnsubscribe(state: IfcState, windowId: string, m: RuntimeIfcMessage): void {
  const topic = m.topic ?? '';
  if (!topic) return;
  const subscriptions = state.subscriptions.get(topic);
  if (!subscriptions) return;
  subscriptions.delete(windowId);
  if (subscriptions.size === 0) state.subscriptions.delete(topic);
}

function handleChannelOpen(
  state: IfcState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  m: RuntimeIfcMessage,
  incomingDomain: IfcDomain,
): void {
  const id = m.id ?? '';
  const peerWindow = resolveTarget(sessionRegistry, m.target ?? '');
  if (!peerWindow) {
    // D6: direct error response echoes the requester's incoming domain prefix
    hooks.sendToNapplet(windowId, { type: `${incomingDomain}.channel.open.result`, id, error: 'target not found' } as NappletMessage);
    return;
  }
  const channelId = hooks.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  addChannel(state, channelId, windowId, peerWindow);
  // D6: direct response echoes the requester's incoming domain prefix
  hooks.sendToNapplet(windowId, { type: `${incomingDomain}.channel.open.result`, id, channelId, peer: peerWindow } as NappletMessage);
}

function handleChannelEmit(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  senderDomain: IfcDomain,
): void {
  const peer = peerOf(state, m.channelId ?? '', windowId);
  if (peer) {
    // D6: push to other napplet uses recipient's own tracked vocabulary
    const prefix = prefixFor(state, peer, senderDomain);
    hooks.sendToNapplet(peer, { type: `${prefix}.channel.event`, channelId: m.channelId ?? '', sender: windowId, payload: m.payload } as NappletMessage);
  }
}

function handleChannelBroadcast(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  senderDomain: IfcDomain,
): void {
  const channels = state.channelsByWindow.get(windowId);
  if (!channels) return;
  for (const channelId of channels) {
    const peer = peerOf(state, channelId, windowId);
    if (peer) {
      // D6: push to other napplet uses recipient's own tracked vocabulary
      const prefix = prefixFor(state, peer, senderDomain);
      hooks.sendToNapplet(peer, { type: `${prefix}.channel.event`, channelId, sender: windowId, payload: m.payload } as NappletMessage);
    }
  }
}

function handleChannelList(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  incomingDomain: IfcDomain,
): void {
  const channels = [];
  const set = state.channelsByWindow.get(windowId);
  if (set) {
    for (const channelId of set) {
      const peer = peerOf(state, channelId, windowId);
      if (peer) channels.push({ id: channelId, peer });
    }
  }
  // D6: direct response echoes the requester's incoming domain prefix
  hooks.sendToNapplet(windowId, { type: `${incomingDomain}.channel.list.result`, id: m.id ?? '', channels } as NappletMessage);
}

function handleChannelClose(
  state: IfcState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIfcMessage,
  closerDomain: IfcDomain,
): void {
  const channelId = m.channelId ?? '';
  const peer = peerOf(state, channelId, windowId);
  if (!peer) return;
  // D6: direct response (closed-to-self) echoes the closer's incoming domain prefix
  hooks.sendToNapplet(windowId, { type: `${closerDomain}.channel.closed`, channelId } as NappletMessage);
  // D6: push to peer uses the peer's own tracked vocabulary; fall back to closer's domain
  const peerPrefix = prefixFor(state, peer, closerDomain);
  hooks.sendToNapplet(peer, { type: `${peerPrefix}.channel.closed`, channelId } as NappletMessage);
  removeChannel(state, channelId);
}

function removeWindowSubscriptions(state: IfcState, windowId: string): void {
  for (const [topic, subscriptions] of state.subscriptions) {
    subscriptions.delete(windowId);
    if (subscriptions.size === 0) state.subscriptions.delete(topic);
  }
}

function removeWindowChannels(state: IfcState, hooks: RuntimeAdapter, windowId: string): void {
  const channelIds = state.channelsByWindow.get(windowId);
  if (!channelIds) return;
  for (const channelId of Array.from(channelIds)) {
    const peer = peerOf(state, channelId, windowId);
    if (peer) {
      // D6: push to peer uses the peer's own tracked vocabulary; fall back to destroyee's domain
      const destroyeeDomain = prefixFor(state, windowId, 'ifc');
      const peerPrefix = prefixFor(state, peer, destroyeeDomain);
      hooks.sendToNapplet(peer, { type: `${peerPrefix}.channel.closed`, channelId } as NappletMessage);
    }
    removeChannel(state, channelId);
  }
}
