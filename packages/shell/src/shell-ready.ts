import type { Runtime, SessionEntry } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { originRegistry } from './origin-registry.js';
import { buildShellCapabilities } from './shell-init.js';
import type { ShellAdapter, ShellCapabilities } from './types.js';
import type { NappletClass } from './types/internal-class.js';

interface ShellReadyOptions {
  hooks: ShellAdapter;
  origin: string;
  runtime: Runtime;
  windowId: string;
}

export function handleShellReady({
  hooks,
  origin,
  runtime,
  windowId,
}: ShellReadyOptions): void {
  const capabilities = buildShellCapabilities(hooks);
  registerNip5dSessionIfNeeded({ hooks, origin, runtime, windowId });
  postShellInit(runtime, windowId, capabilities, Object.keys(hooks.services ?? {}));
}

function registerNip5dSessionIfNeeded({
  hooks,
  origin,
  runtime,
  windowId,
}: ShellReadyOptions): void {
  // NIP-5D: register a source-identity session entry in runtime.sessionRegistry
  // if one does not already exist for this windowId. This wires the originRegistry
  // identity into the runtime so domain handlers (storage/state, ifc, etc.) can
  // resolve the napplet via getEntryByWindowId(windowId).
  if (runtime.sessionRegistry.getEntryByWindowId(windowId)) {
    return;
  }

  const identity = resolveNip5dIdentity(hooks, windowId);
  if (!identity) {
    return;
  }

  const entry: SessionEntry = {
    pubkey: '',
    windowId,
    origin,
    type: 'nip5d',
    dTag: identity.dTag,
    aggregateHash: identity.aggregateHash,
    registeredAt: Date.now(),
    instanceId: crypto.randomUUID(),
    provenance: 'nip-5d',
    class: identity.class,
  };
  runtime.sessionRegistry.register(windowId, entry);
}

function resolveNip5dIdentity(
  hooks: ShellAdapter,
  windowId: string,
): { dTag: string; aggregateHash: string; class: NappletClass } | null {
  // Identity resolution order:
  //   1. hooks.onNip5dIframeCreate?.(windowId) — preferred; includes class posture.
  //   2. originRegistry.getIdentity(win) — fallback for hosts that register
  //      identity directly via originRegistry.register(win, windowId, identity).
  const hookIdentity = hooks.onNip5dIframeCreate?.(windowId);
  if (hookIdentity !== null && hookIdentity !== undefined) {
    return {
      dTag: hookIdentity.dTag,
      aggregateHash: hookIdentity.aggregateHash,
      class: hookIdentity.class,
    };
  }

  const win = originRegistry.getIframeWindow(windowId);
  if (!win) {
    return null;
  }

  const originIdentity = originRegistry.getIdentity(win);
  if (!originIdentity) {
    return null;
  }

  return {
    dTag: originIdentity.dTag,
    aggregateHash: originIdentity.aggregateHash,
    class: null,
  };
}

function postShellInit(
  runtime: Runtime,
  windowId: string,
  capabilities: ShellCapabilities,
  services: string[],
): void {
  // CLASS-02: read resolved class from session entry (populated above, or
  // previously by the host at iframe creation time for legacy flows).
  // Fallback to null (permissive default, D2) when no entry is resolvable.
  const sessionEntry = runtime.sessionRegistry.getEntryByWindowId(windowId);
  const resolvedClass: NappletClass = sessionEntry?.class ?? null;
  const initMsg: NappletMessage & {
    capabilities: ShellCapabilities;
    services: string[];
    class: NappletClass;
  } = {
    type: 'shell.init',
    capabilities,
    services,
    class: resolvedClass,
  };
  const win = originRegistry.getIframeWindow(windowId);
  if (win) win.postMessage(initMsg, '*');
}
