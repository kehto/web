import type { Runtime, SessionEntry } from '@kehto/runtime';
import { originRegistry, type OriginIdentity } from './origin-registry.js';
import { resolveShellEnvironment } from './shell-init.js';
import type { ShellAdapter } from './types.js';

interface ShellReadyOptions {
  hooks: ShellAdapter;
  origin: string;
  runtime: Runtime;
  sourceRegistrationId: number;
  sourceWindow: Window;
  windowId: string;
}

/**
 * SHELL-01 (NAP-SHELL gap G1): tracks the source Window registration for which
 * `shell.init` has already been posted, so a duplicate `shell.ready` in the same
 * iframe lifecycle is idempotent and does NOT resend `shell.init`.
 * Module-scoped because the "no NIP-5D identity" path never registers a session
 * entry, so the guard must live independently of the session registry (and must
 * not mutate the runtime `SessionEntry` shape, which is owned by @kehto/runtime).
 */
let initSent = new WeakMap<Window, number>();
let sessionRegistration = new Map<string, number>();

/**
 * Test-only hook to clear the module-scoped {@link initSent} guard between
 * test cases. NOT part of the public API; prefixed with `__` and `ForTests` to
 * signal it must never be called by production code.
 *
 * @internal
 */
export function __resetInitSentForTests(): void {
  initSent = new WeakMap<Window, number>();
  sessionRegistration = new Map<string, number>();
}

export function handleShellReady({
  hooks,
  origin,
  runtime,
  sourceRegistrationId,
  sourceWindow,
  windowId,
}: ShellReadyOptions): void {
  // SHELL-01: exactly-once shell.init per registered Window lifecycle.
  if (initSent.get(sourceWindow) === sourceRegistrationId) {
    return;
  }

  const identity = resolveNip5dIdentity(hooks, windowId, sourceWindow);
  if (!identity) return;

  registerNip5dSessionIfNeeded({ origin, runtime, sourceRegistrationId, windowId, identity });
  const environment = resolveShellEnvironment(hooks, identity);
  postShellInit(sourceWindow, environment);
  initSent.set(sourceWindow, sourceRegistrationId);
}

function registerNip5dSessionIfNeeded({
  origin,
  runtime,
  sourceRegistrationId,
  windowId,
  identity,
}: Pick<ShellReadyOptions, 'origin' | 'runtime' | 'sourceRegistrationId' | 'windowId'> & {
  identity: OriginIdentity;
}): void {
  // NIP-5D: register a source-identity session entry in runtime.sessionRegistry
  // if one does not already exist for this windowId. This wires the originRegistry
  // identity into the runtime so domain handlers (storage/state, inc, etc.) can
  // resolve the napplet via getEntryByWindowId(windowId).
  const existing = runtime.sessionRegistry.getEntryByWindowId(windowId);
  const previousRegistration = sessionRegistration.get(windowId);
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
  sessionRegistration.set(windowId, sourceRegistrationId);
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
  environment: Readonly<{
    capabilities: { readonly domains: readonly string[] };
    services: readonly string[];
  }>,
): void {
  const initMsg = {
    type: 'shell.init',
    capabilities: environment.capabilities,
    services: environment.services,
  };
  win.postMessage(initMsg, '*');
}
