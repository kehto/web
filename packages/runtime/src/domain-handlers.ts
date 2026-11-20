import type { NappletMessage } from '@napplet/core';
import {
  createCanonicalDomainResult,
  createIntentServiceUnavailableResult,
  createLlmErrorResult,
} from './domain-results.js';

import type { AclStateContainer } from './acl-state.js';
import type { SessionRegistry } from './session-registry.js';
import { handleStorageNap } from './state-handler.js';
import type { RuntimeAdapter, ServiceRegistry } from './types.js';

declare const console: { warn(message: string): void };

type DomainHandler = (windowId: string, msg: NappletMessage) => void;

type RuntimeDomainContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
  sessionRegistry: SessionRegistry;
  aclState: AclStateContainer;
};

export type RuntimeDomainHandlers = {
  gamepad: DomainHandler;
  storage: DomainHandler;
  media: DomainHandler;
  keys: DomainHandler;
  notify: DomainHandler;
  theme: DomainHandler;
  config: DomainHandler;
  resource: DomainHandler;
  cvm: DomainHandler;
  outbox: DomainHandler;
  upload: DomainHandler;
  intent: DomainHandler;
  link: DomainHandler;
  common: DomainHandler;
  lists: DomainHandler;
  serial: DomainHandler;
  ble: DomainHandler;
  webrtc: DomainHandler;
  dm: DomainHandler;
  fs: DomainHandler;
  llm: DomainHandler;
};

export function createRuntimeDomainHandlers(context: RuntimeDomainContext): RuntimeDomainHandlers {
  const warnedUnrouted = new Set<string>();
  return {
    gamepad: (windowId, msg) => handleServiceOnlyMessage(context, 'gamepad', windowId, msg, warnedUnrouted),
    storage: (windowId, msg) => handleStorageMessage(context, windowId, msg),
    media: (windowId, msg) => handleMediaMessage(context, windowId, msg),
    keys: (windowId, msg) => handleKeysMessage(context, windowId, msg),
    notify: (windowId, msg) => handleNotifyMessage(context, windowId, msg),
    theme: (windowId, msg) => handleThemeMessage(context, windowId, msg),
    config: (windowId, msg) => handleServiceOnlyMessage(context, 'config', windowId, msg, warnedUnrouted),
    resource: (windowId, msg) => handleServiceOnlyMessage(context, 'resource', windowId, msg, warnedUnrouted),
    cvm: (windowId, msg) => handleServiceOnlyMessage(context, 'cvm', windowId, msg, warnedUnrouted),
    outbox: (windowId, msg) => handleServiceOnlyMessage(context, 'outbox', windowId, msg, warnedUnrouted),
    upload: (windowId, msg) => handleServiceOnlyMessage(context, 'upload', windowId, msg, warnedUnrouted),
    intent: (windowId, msg) => handleServiceOnlyMessage(context, 'intent', windowId, msg, warnedUnrouted),
    link: (windowId, msg) => handleServiceOnlyMessage(context, 'link', windowId, msg, warnedUnrouted),
    common: (windowId, msg) => handleServiceOnlyMessage(context, 'common', windowId, msg, warnedUnrouted),
    lists: (windowId, msg) => handleServiceOnlyMessage(context, 'lists', windowId, msg, warnedUnrouted),
    serial: (windowId, msg) => handleServiceOnlyMessage(context, 'serial', windowId, msg, warnedUnrouted),
    ble: (windowId, msg) => handleServiceOnlyMessage(context, 'ble', windowId, msg, warnedUnrouted),
    webrtc: (windowId, msg) => handleServiceOnlyMessage(context, 'webrtc', windowId, msg, warnedUnrouted),
    dm: (windowId, msg) => handleServiceOnlyMessage(context, 'dm', windowId, msg, warnedUnrouted),
    fs: (windowId, msg) => handleServiceOnlyMessage(context, 'fs', windowId, msg, warnedUnrouted),
    llm: (windowId, msg) => handleLlmMessage(context, windowId, msg),
  };
}

function handleStorageMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { aclState, hooks, sessionRegistry } = context;
  handleStorageNap(windowId, msg, hooks.sendToNapplet, sessionRegistry, aclState, hooks.statePersistence);
}

function handleMediaMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry } = context;
  const mediaService = serviceRegistry['media'];
  if (mediaService) {
    mediaService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  if (msg.type === 'media.session.create') {
    const m = msg as NappletMessage & { id?: string; owner?: string; sessionId?: string };
    if (m.owner !== 'napplet' && m.owner !== 'shell') {
      hooks.sendToNapplet(windowId, {
        type: 'media.session.create.result',
        id: m.id ?? '',
        error: 'missing owner',
      } as NappletMessage);
      return;
    }
    if (m.owner === 'shell') {
      hooks.sendToNapplet(windowId, {
        type: 'media.session.create.result',
        id: m.id ?? '',
        owner: 'shell',
        error: 'unsupported owner mode',
      } as NappletMessage);
      return;
    }
    hooks.sendToNapplet(windowId, {
      type: 'media.session.create.result',
      id: m.id ?? '',
      owner: m.owner,
      error: 'media service unavailable',
    } as NappletMessage);
  }
}

function handleKeysMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry, sessionRegistry } = context;
  if (msg.type === 'keys.forward') {
    if (!sessionRegistry.getEntryByWindowId(windowId)) return;
    forwardHotkey(hooks, msg);
    return;
  }
  const keysService = serviceRegistry['keys'];
  if (keysService) {
    keysService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  if (msg.type === 'keys.registerAction') sendRegisterActionResult(hooks, windowId, msg);
}

function forwardHotkey(hooks: RuntimeAdapter, msg: NappletMessage): void {
  const m = msg as NappletMessage & {
    key?: string; code?: string;
    ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean;
  };
  hooks.hotkeys.executeHotkeyFromForward({
    key: m.key ?? '',
    code: m.code ?? '',
    ctrlKey: !!m.ctrl,
    altKey: !!m.alt,
    shiftKey: !!m.shift,
    metaKey: !!m.meta,
  });
}

function sendRegisterActionResult(hooks: RuntimeAdapter, windowId: string, msg: NappletMessage): void {
  const m = msg as NappletMessage & {
    id?: string; action?: { id: string; defaultKey?: string };
  };
  hooks.sendToNapplet(windowId, {
    type: 'keys.registerAction.result',
    id: m.id ?? '',
    actionId: m.action?.id ?? '',
  } as NappletMessage);
}

function handleNotifyMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry } = context;
  const notifyService = serviceRegistry['notify'];
  if (notifyService) {
    notifyService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  if (msg.type === 'notify.send') {
    const m = msg as NappletMessage & { id?: string };
    hooks.sendToNapplet(windowId, { type: 'notify.send.result', id: m.id ?? '', notificationId: `shell-${Date.now()}` } as NappletMessage);
  } else if (msg.type === 'notify.permission.request') {
    const m = msg as NappletMessage & { id?: string };
    hooks.sendToNapplet(windowId, { type: 'notify.permission.result', id: m.id ?? '', granted: true } as NappletMessage);
  }
}

function handleThemeMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry } = context;
  const themeService = serviceRegistry['theme'];
  if (themeService) {
    themeService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  const fallback = createCanonicalDomainResult(msg);
  if (fallback) hooks.sendToNapplet(windowId, fallback);
}

/**
 * NAP-LLM (napplet/naps PR #134) routes to a registered `llm` service. Without
 * one, requests fail explicitly with `unsupported` instead of hanging: the
 * domain was advertised, so the napplet is owed exactly one terminal result.
 */
function handleLlmMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const service = context.serviceRegistry['llm'];
  if (service) {
    service.handleMessage(windowId, msg, (resp: NappletMessage) => context.hooks.sendToNapplet(windowId, resp));
    return;
  }
  const result = createLlmErrorResult(msg, 'unsupported', 'No language model service is registered by this shell.');
  if (result) context.hooks.sendToNapplet(windowId, result);
}

function handleServiceOnlyMessage(
  context: RuntimeDomainContext,
  name: 'gamepad' | 'config' | 'resource' | 'cvm' | 'outbox' | 'upload' | 'intent' | 'link' | 'common' | 'lists' | 'serial' | 'ble' | 'webrtc' | 'dm' | 'fs',
  windowId: string,
  msg: NappletMessage,
  warnedUnrouted: Set<string>,
): void {
  if (
    name === 'intent'
    && msg.type !== 'intent.invoke'
    && msg.type !== 'intent.available'
    && msg.type !== 'intent.handlers'
  ) {
    return;
  }
  const service = context.serviceRegistry[name];
  if (!service) {
    if (name === 'intent') {
      const result = createIntentServiceUnavailableResult(msg);
      if (result) context.hooks.sendToNapplet(windowId, result);
      return;
    }
    warnUnroutedServiceDomain(name, warnedUnrouted);
    return;
  }
  service.handleMessage(windowId, msg, (resp: NappletMessage) => context.hooks.sendToNapplet(windowId, resp));
}

/**
 * Host-side diagnostic for a service-only domain with no registered handler.
 *
 * NIP-5D (nostr-protocol/nips#2303 at dskvr/nips@f60550c3) says messages with
 * an unrecognized `type` MUST be silently ignored, which also prevents
 * capability probing, so the napplet gets no reply here. The host still needs
 * to hear about it: a napplet only reaches this path through a raw probe or
 * because the host exposed a domain it never registered (#428). The domain
 * comes from a fixed list and the napplet-controlled type is never logged.
 */
function warnUnroutedServiceDomain(name: string, warned: Set<string>): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[KEHTO_UNROUTED_SERVICE_DOMAIN] Ignored a "${name}" request: no "${name}" service is registered with this runtime, so the napplet gets no reply (NIP-5D ignores unrecognized types). If this shell exposes "${name}", register it with runtime.registerService("${name}", handler). Warned once per domain per runtime.`);
}
