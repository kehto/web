import type { NappletMessage } from '@napplet/core';

import type { AclStateContainer } from './acl-state.js';
import type { SessionRegistry } from './session-registry.js';
import { handleStorageNub } from './state-handler.js';
import type { RuntimeAdapter, ServiceRegistry } from './types.js';

type DomainHandler = (windowId: string, msg: NappletMessage) => void;

type RuntimeDomainContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
  sessionRegistry: SessionRegistry;
  aclState: AclStateContainer;
};

export type RuntimeDomainHandlers = {
  storage: DomainHandler;
  media: DomainHandler;
  keys: DomainHandler;
  notify: DomainHandler;
  theme: DomainHandler;
  config: DomainHandler;
  resource: DomainHandler;
};

const THEME_FALLBACK_DEFAULT = {
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
} as const;

export function createRuntimeDomainHandlers(context: RuntimeDomainContext): RuntimeDomainHandlers {
  return {
    storage: (windowId, msg) => handleStorageMessage(context, windowId, msg),
    media: (windowId, msg) => handleMediaMessage(context, windowId, msg),
    keys: (windowId, msg) => handleKeysMessage(context, windowId, msg),
    notify: (windowId, msg) => handleNotifyMessage(context, windowId, msg),
    theme: (windowId, msg) => handleThemeMessage(context, windowId, msg),
    config: (windowId, msg) => handleServiceOnlyMessage(context, 'config', windowId, msg),
    resource: (windowId, msg) => handleServiceOnlyMessage(context, 'resource', windowId, msg),
  };
}

function handleStorageMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { aclState, hooks, sessionRegistry } = context;
  handleStorageNub(windowId, msg, hooks.sendToNapplet, sessionRegistry, aclState, hooks.statePersistence);
}

function handleMediaMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry } = context;
  const mediaService = serviceRegistry['media'];
  if (mediaService) {
    mediaService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  if (msg.type === 'media.session.create') {
    const m = msg as NappletMessage & { id?: string; sessionId?: string };
    hooks.sendToNapplet(windowId, {
      type: 'media.session.create.result',
      id: m.id ?? '',
      sessionId: m.sessionId ?? '',
    } as NappletMessage);
  }
}

function handleKeysMessage(context: RuntimeDomainContext, windowId: string, msg: NappletMessage): void {
  const { hooks, serviceRegistry } = context;
  const keysService = serviceRegistry['keys'];
  if (keysService) {
    keysService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
    return;
  }
  if (msg.type === 'keys.forward') {
    forwardHotkey(hooks, msg);
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
    ...(m.action?.defaultKey ? { binding: m.action.defaultKey } : {}),
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
  if (msg.type === 'theme.get') {
    const m = msg as NappletMessage & { id?: string };
    hooks.sendToNapplet(windowId, {
      type: 'theme.get.result',
      id: m.id ?? '',
      theme: THEME_FALLBACK_DEFAULT,
    } as NappletMessage);
  }
}

function handleServiceOnlyMessage(
  context: RuntimeDomainContext,
  name: 'config' | 'resource',
  windowId: string,
  msg: NappletMessage,
): void {
  const service = context.serviceRegistry[name];
  if (!service) return;
  service.handleMessage(windowId, msg, (resp: NappletMessage) => context.hooks.sendToNapplet(windowId, resp));
}
