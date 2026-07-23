import type { NappletMessage } from '@napplet/core';
import type { IncMessage } from '@napplet/nap/inc/types';

import type { SessionRegistry } from './session-registry.js';
import type { RuntimeAdapter } from './types.js';

interface IncChannel {
  channelId: string;
  peerA: string;
  peerB: string;
}

type RuntimeIncMessage = IncMessage & {
  id?: string;
  topic?: string;
  payload?: unknown;
  target?: string;
  channelId?: string;
};

type IncState = {
  subscriptions: Map<string, Set<string>>;
  channels: Map<string, IncChannel>;
  channelsByWindow: Map<string, Set<string>>;
};

type ChannelOpenAuthorizer = (targetWindowId: string, message: NappletMessage) => boolean;

export interface IncRuntime {
  handleMessage(windowId: string, msg: NappletMessage): void;
  destroyWindow(windowId: string): void;
  /**
   * Close a live window's established channels after its open-time authority is revoked.
   *
   * @param windowId - Internal identity of the session whose open-time authority changed
   */
  revokeWindow(windowId: string): void;
  clear(): void;
}

export function createIncRuntime(
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  authorizeChannelOpen: ChannelOpenAuthorizer,
): IncRuntime {
  const state: IncState = {
    subscriptions: new Map(),
    channels: new Map(),
    channelsByWindow: new Map(),
  };

  return {
    handleMessage(windowId: string, msg: NappletMessage): void {
      handleIncMessage(state, hooks, sessionRegistry, authorizeChannelOpen, windowId, msg);
    },
    destroyWindow(windowId: string): void {
      removeWindowChannels(state, hooks, windowId);
      removeWindowSubscriptions(state, windowId);
    },
    revokeWindow(windowId: string): void {
      revokeWindowChannels(state, hooks, windowId);
    },
    clear(): void {
      state.subscriptions.clear();
      state.channels.clear();
      state.channelsByWindow.clear();
    },
  };
}

function addChannel(state: IncState, channelId: string, peerA: string, peerB: string): void {
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

function removeChannel(state: IncState, channelId: string): void {
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

function peerOf(state: IncState, channelId: string, self: string): string | null {
  const channel = state.channels.get(channelId);
  if (!channel) return null;
  if (channel.peerA === self) return channel.peerB;
  if (channel.peerB === self) return channel.peerA;
  return null;
}

function resolveTarget(sessionRegistry: SessionRegistry, target: string): string | null {
  return sessionRegistry.getWindowIdByDTag(target) ?? null;
}

function handleIncMessage(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  authorizeChannelOpen: ChannelOpenAuthorizer,
  windowId: string,
  msg: NappletMessage,
): void {
  const m = msg as RuntimeIncMessage;
  const dotIdx = msg.type.indexOf('.');
  const action = msg.type.slice(dotIdx + 1);

  switch (action) {
    case 'emit': handleEmit(state, hooks, sessionRegistry, windowId, m); return;
    case 'subscribe': handleSubscribe(state, hooks, windowId, m); return;
    case 'unsubscribe': handleUnsubscribe(state, windowId, m); return;
    case 'channel.open': handleChannelOpen(state, hooks, sessionRegistry, authorizeChannelOpen, windowId, m); return;
    case 'channel.emit': handleChannelEmit(state, hooks, sessionRegistry, windowId, m); return;
    case 'channel.broadcast': handleChannelBroadcast(state, hooks, sessionRegistry, windowId, m); return;
    case 'channel.list': handleChannelList(state, hooks, sessionRegistry, windowId, m); return;
    case 'channel.close': handleChannelClose(state, hooks, windowId, m); return;
    default: return;
  }
}

function handleEmit(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const topic = m.topic ?? '';
  const sender = sessionRegistry.getEntryByWindowId(windowId)?.dTag;
  if (!sender) return;
  if (!topic) return;
  const subscribers = state.subscriptions.get(topic);
  if (!subscribers) return;
  for (const subscriberWindowId of subscribers) {
    if (subscriberWindowId !== windowId) {
      hooks.sendToNapplet(subscriberWindowId, { type: 'inc.event', topic, payload: m.payload, sender } as NappletMessage);
    }
  }
}

function handleSubscribe(
  state: IncState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const id = m.id ?? '';
  const topic = m.topic ?? '';
  if (!topic) {
    hooks.sendToNapplet(windowId, { type: 'inc.subscribe.result', id, error: 'missing topic' } as NappletMessage);
    return;
  }
  let subscriptions = state.subscriptions.get(topic);
  if (!subscriptions) {
    subscriptions = new Set();
    state.subscriptions.set(topic, subscriptions);
  }
  subscriptions.add(windowId);
  hooks.sendToNapplet(windowId, { type: 'inc.subscribe.result', id } as NappletMessage);
}

function handleUnsubscribe(state: IncState, windowId: string, m: RuntimeIncMessage): void {
  const topic = m.topic ?? '';
  if (!topic) return;
  const subscriptions = state.subscriptions.get(topic);
  if (!subscriptions) return;
  subscriptions.delete(windowId);
  if (subscriptions.size === 0) state.subscriptions.delete(topic);
}

function handleChannelOpen(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  authorizeChannelOpen: ChannelOpenAuthorizer,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const id = m.id ?? '';
  const peerWindow = resolveTarget(sessionRegistry, m.target ?? '');
  const openerDTag = sessionRegistry.getEntryByWindowId(windowId)?.dTag;
  const peerDTag = peerWindow ? sessionRegistry.getEntryByWindowId(peerWindow)?.dTag : undefined;
  if (!peerWindow || !openerDTag || !peerDTag) {
    hooks.sendToNapplet(windowId, { type: 'inc.channel.open.result', id, error: 'target not found' } as NappletMessage);
    return;
  }
  if (!authorizeChannelOpen(peerWindow, m)) {
    hooks.sendToNapplet(windowId, { type: 'inc.channel.open.result', id, error: 'target denied' } as NappletMessage);
    return;
  }
  const channelId = hooks.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  addChannel(state, channelId, windowId, peerWindow);
  try {
    hooks.sendToNapplet(peerWindow, { type: 'inc.channel.opened', channelId, peer: openerDTag } as NappletMessage);
  } catch {
    removeChannel(state, channelId);
    hooks.sendToNapplet(windowId, { type: 'inc.channel.open.result', id, error: 'target unavailable' } as NappletMessage);
    return;
  }
  try {
    hooks.sendToNapplet(windowId, { type: 'inc.channel.open.result', id, channelId, peer: peerDTag } as NappletMessage);
  } catch {
    teardownChannel(state, hooks, channelId);
  }
}

function handleChannelEmit(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const peer = peerOf(state, m.channelId ?? '', windowId);
  const sender = sessionRegistry.getEntryByWindowId(windowId)?.dTag;
  if (peer && sender) {
    hooks.sendToNapplet(peer, { type: 'inc.channel.event', channelId: m.channelId ?? '', sender, payload: m.payload } as NappletMessage);
  }
}

function handleChannelBroadcast(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const channels = state.channelsByWindow.get(windowId);
  const sender = sessionRegistry.getEntryByWindowId(windowId)?.dTag;
  if (!channels || !sender) return;
  for (const channelId of channels) {
    const peer = peerOf(state, channelId, windowId);
    if (peer) {
      hooks.sendToNapplet(peer, { type: 'inc.channel.event', channelId, sender, payload: m.payload } as NappletMessage);
    }
  }
}

function handleChannelList(
  state: IncState,
  hooks: RuntimeAdapter,
  sessionRegistry: SessionRegistry,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const channels = [];
  const set = state.channelsByWindow.get(windowId);
  if (set) {
    for (const channelId of set) {
      const peer = peerOf(state, channelId, windowId);
      const peerDTag = peer ? sessionRegistry.getEntryByWindowId(peer)?.dTag : undefined;
      if (peerDTag) channels.push({ id: channelId, peer: peerDTag });
    }
  }
  hooks.sendToNapplet(windowId, { type: 'inc.channel.list.result', id: m.id ?? '', channels } as NappletMessage);
}

function handleChannelClose(
  state: IncState,
  hooks: RuntimeAdapter,
  windowId: string,
  m: RuntimeIncMessage,
): void {
  const channelId = m.channelId ?? '';
  if (!peerOf(state, channelId, windowId)) return;
  teardownChannel(state, hooks, channelId);
}

function teardownChannel(state: IncState, hooks: RuntimeAdapter, channelId: string, destroyedWindowId?: string): void {
  const channel = state.channels.get(channelId);
  if (!channel) return;

  try {
    if (destroyedWindowId) {
      const survivor = peerOf(state, channelId, destroyedWindowId);
      if (survivor) {
        try {
          hooks.sendToNapplet(survivor, { type: 'inc.channel.closed', channelId, reason: 'peer destroyed' } as NappletMessage);
        } catch { /* channel teardown must still complete */ }
      }
      return;
    }
    for (const peer of [channel.peerA, channel.peerB]) {
      try {
        hooks.sendToNapplet(peer, { type: 'inc.channel.closed', channelId } as NappletMessage);
      } catch { /* channel teardown must still complete */ }
    }
  } finally {
    removeChannel(state, channelId);
  }
}

function removeWindowSubscriptions(state: IncState, windowId: string): void {
  for (const [topic, subscriptions] of state.subscriptions) {
    subscriptions.delete(windowId);
    if (subscriptions.size === 0) state.subscriptions.delete(topic);
  }
}

function removeWindowChannels(state: IncState, hooks: RuntimeAdapter, windowId: string): void {
  const channelIds = state.channelsByWindow.get(windowId);
  if (!channelIds) return;
  for (const channelId of Array.from(channelIds)) {
    teardownChannel(state, hooks, channelId, windowId);
  }
}

function revokeWindowChannels(state: IncState, hooks: RuntimeAdapter, windowId: string): void {
  const channelIds = state.channelsByWindow.get(windowId);
  if (!channelIds) return;
  for (const channelId of Array.from(channelIds)) {
    teardownChannel(state, hooks, channelId);
  }
}
