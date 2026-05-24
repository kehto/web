import type { NappletMessage } from '@napplet/core';
import type { IfcMessage } from '@napplet/nub/ifc/types';

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

type IfcState = {
  subscriptions: Map<string, Set<string>>;
  channels: Map<string, IfcChannel>;
  channelsByWindow: Map<string, Set<string>>;
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
  };

  return {
    handleMessage(windowId: string, msg: NappletMessage): void {
      handleIfcMessage(state, hooks, sessionRegistry, windowId, msg);
    },
    destroyWindow(windowId: string): void {
      removeWindowChannels(state, hooks, windowId);
      removeWindowSubscriptions(state, windowId);
    },
    clear(): void {
      state.subscriptions.clear();
      state.channels.clear();
      state.channelsByWindow.clear();
    },
  };
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

  switch (action) {
    case 'emit': handleEmit(state, hooks, windowId, m); return;
    case 'subscribe': handleSubscribe(state, hooks, windowId, m); return;
    case 'unsubscribe': handleUnsubscribe(state, windowId, m); return;
    case 'channel.open': handleChannelOpen(state, hooks, sessionRegistry, windowId, m); return;
    case 'channel.emit': handleChannelEmit(state, hooks, windowId, m); return;
    case 'channel.broadcast': handleChannelBroadcast(state, hooks, windowId, m); return;
    case 'channel.list': handleChannelList(state, hooks, windowId, m); return;
    case 'channel.close': handleChannelClose(state, hooks, windowId, m); return;
    default: return;
  }
}

function handleEmit(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const topic = m.topic ?? '';
  if (!topic) return;
  const subscribers = state.subscriptions.get(topic);
  if (!subscribers) return;
  for (const subscriberWindowId of subscribers) {
    if (subscriberWindowId !== windowId) {
      hooks.sendToNapplet(subscriberWindowId, { type: 'ifc.event', topic, payload: m.payload, sender: windowId } as NappletMessage);
    }
  }
}

function handleSubscribe(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const id = m.id ?? '';
  const topic = m.topic ?? '';
  if (!topic) {
    hooks.sendToNapplet(windowId, { type: 'ifc.subscribe.result', id, error: 'missing topic' } as NappletMessage);
    return;
  }
  let subscriptions = state.subscriptions.get(topic);
  if (!subscriptions) {
    subscriptions = new Set();
    state.subscriptions.set(topic, subscriptions);
  }
  subscriptions.add(windowId);
  hooks.sendToNapplet(windowId, { type: 'ifc.subscribe.result', id } as NappletMessage);
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
): void {
  const id = m.id ?? '';
  const peerWindow = resolveTarget(sessionRegistry, m.target ?? '');
  if (!peerWindow) {
    hooks.sendToNapplet(windowId, { type: 'ifc.channel.open.result', id, error: 'target not found' } as NappletMessage);
    return;
  }
  const channelId = hooks.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  addChannel(state, channelId, windowId, peerWindow);
  hooks.sendToNapplet(windowId, { type: 'ifc.channel.open.result', id, channelId, peer: peerWindow } as NappletMessage);
}

function handleChannelEmit(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const peer = peerOf(state, m.channelId ?? '', windowId);
  if (peer) hooks.sendToNapplet(peer, { type: 'ifc.channel.event', channelId: m.channelId ?? '', sender: windowId, payload: m.payload } as NappletMessage);
}

function handleChannelBroadcast(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const channels = state.channelsByWindow.get(windowId);
  if (!channels) return;
  for (const channelId of channels) {
    const peer = peerOf(state, channelId, windowId);
    if (peer) hooks.sendToNapplet(peer, { type: 'ifc.channel.event', channelId, sender: windowId, payload: m.payload } as NappletMessage);
  }
}

function handleChannelList(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const channels = [];
  const set = state.channelsByWindow.get(windowId);
  if (set) {
    for (const channelId of set) {
      const peer = peerOf(state, channelId, windowId);
      if (peer) channels.push({ id: channelId, peer });
    }
  }
  hooks.sendToNapplet(windowId, { type: 'ifc.channel.list.result', id: m.id ?? '', channels } as NappletMessage);
}

function handleChannelClose(state: IfcState, hooks: RuntimeAdapter, windowId: string, m: RuntimeIfcMessage): void {
  const channelId = m.channelId ?? '';
  const peer = peerOf(state, channelId, windowId);
  if (!peer) return;
  hooks.sendToNapplet(windowId, { type: 'ifc.channel.closed', channelId } as NappletMessage);
  hooks.sendToNapplet(peer, { type: 'ifc.channel.closed', channelId } as NappletMessage);
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
    if (peer) hooks.sendToNapplet(peer, { type: 'ifc.channel.closed', channelId } as NappletMessage);
    removeChannel(state, channelId);
  }
}
