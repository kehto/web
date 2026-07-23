import type { Runtime, SessionEntry } from '@kehto/runtime';
import { originRegistry, type OriginIdentity } from './origin-registry.js';
import { resolveShellEnvironment } from './shell-init.js';
import type { ShellAdapter, ShellEnvironment } from './types.js';

interface ShellReadyOptions {
  hooks: ShellAdapter;
  origin: string;
  runtime: Runtime;
  state: ShellReadyState;
  sourceRegistrationId: number;
  sourceWindow: Window;
  windowId: string;
}

/** State owned by one ShellBridge instance for its NAP-SHELL lifecycles. */
export interface ShellReadyState {
  isDomainAllowed(windowId: string, domain: string): boolean;
  clear(): void;
  readonly initSent: WeakMap<Window, number>;
  readonly sessionRegistration: Map<string, number>;
  readonly environments: Map<string, ShellEnvironment>;
}

/** Create isolated handshake state for one bridge/runtime pair. */
export function createShellReadyState(): ShellReadyState {
  const initSent = new WeakMap<Window, number>();
  const sessionRegistration = new Map<string, number>();
  const environments = new Map<string, ShellEnvironment>();
  return {
    initSent,
    sessionRegistration,
    environments,
    isDomainAllowed(windowId, domain): boolean {
      return environments.get(windowId)?.capabilities.domains.includes(domain) ?? false;
    },
    clear(): void {
      sessionRegistration.clear();
      environments.clear();
    },
  };
}

export function handleShellReady({
  hooks,
  origin,
  runtime,
  state,
  sourceRegistrationId,
  sourceWindow,
  windowId,
}: ShellReadyOptions): void {
  // SHELL-01: exactly-once shell.init per registered Window lifecycle.
  if (state.initSent.get(sourceWindow) === sourceRegistrationId) {
    return;
  }

  const identity = resolveNip5dIdentity(hooks, windowId, sourceWindow);
  if (!identity) return;

  registerNip5dSessionIfNeeded({ origin, runtime, state, sourceRegistrationId, windowId, identity });
  const environment = originRegistry.getEnvironment(sourceWindow) ?? resolveShellEnvironment(hooks, identity);
  state.environments.set(windowId, environment);
  postShellInit(sourceWindow, environment);
  state.initSent.set(sourceWindow, sourceRegistrationId);
}

function registerNip5dSessionIfNeeded({
  origin,
  runtime,
  state,
  sourceRegistrationId,
  windowId,
  identity,
}: Pick<ShellReadyOptions, 'origin' | 'runtime' | 'state' | 'sourceRegistrationId' | 'windowId'> & {
  identity: OriginIdentity;
}): void {
  // NIP-5D: register a source-identity session entry in runtime.sessionRegistry
  // if one does not already exist for this windowId. This wires the originRegistry
  // identity into the runtime so domain handlers (storage/state, inc, etc.) can
  // resolve the napplet via getEntryByWindowId(windowId).
  const existing = runtime.sessionRegistry.getEntryByWindowId(windowId);
  const previousRegistration = state.sessionRegistration.get(windowId);
  if (existing && previousRegistration === sourceRegistrationId) {
    return;
  }
  if (existing && previousRegistration !== undefined) {
    runtime.sessionRegistry.unregister(windowId);
  }
  if (existing && previousRegistration === undefined) return;

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
  };
  runtime.sessionRegistry.register(windowId, entry);
  state.sessionRegistration.set(windowId, sourceRegistrationId);
}

function resolveNip5dIdentity(
  hooks: ShellAdapter,
  windowId: string,
  sourceWindow: Window,
): { dTag: string; aggregateHash: string } | null {
  // Identity resolution order:
  //   1. hooks.onNip5dIframeCreate?.(windowId) — preferred.
  //   2. originRegistry.getIdentity(win) — fallback for hosts that register
  //      identity directly via originRegistry.register(win, windowId, identity).
  const hookIdentity = hooks.onNip5dIframeCreate?.(windowId);
  if (hookIdentity !== null && hookIdentity !== undefined) {
    return Object.freeze({
      dTag: hookIdentity.dTag,
      aggregateHash: hookIdentity.aggregateHash,
    });
  }

  const originIdentity = originRegistry.getIdentity(sourceWindow);
  if (!originIdentity) {
    return null;
  }

  return Object.freeze({
    dTag: originIdentity.dTag,
    aggregateHash: originIdentity.aggregateHash,
  });
}

function postShellInit(
  win: Window,
  environment: ShellEnvironment,
): void {
  const initMsg = {
    type: 'shell.init',
    capabilities: environment.capabilities,
    services: environment.services,
  };
  win.postMessage(initMsg, '*');
}
