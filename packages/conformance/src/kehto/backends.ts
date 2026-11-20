/**
 * kehto/backends.ts — Deterministic in-memory backends for the first-party target.
 *
 * Assembles the `ShellAdapter` for one variant. Nothing here reaches a relay,
 * a device, a prompt or the network.
 */
import type { ShellAdapter, ShellBridge } from '@kehto/shell';
import type { TargetVariant } from '../target.js';
import { fullBackends, minimalDisabledDomains, type DomainBackends } from './domain-backends.js';

/** Context handed to a host control. */
export interface ControlContext {
  readonly bridge: ShellBridge;
  readonly hooks: ShellAdapter;
}

/** The backends of one booted variant. */
export interface Backends {
  readonly hooks: ShellAdapter;
  readonly controls: readonly string[];
  control(name: string, payload: unknown, context: ControlContext): Promise<unknown>;
  /** Called once the bridge exists, so services can be attached to the runtime. */
  attach(bridge: ShellBridge): void;
  /** Runtime-assigned opaque INC endpoint id for a window, when the runtime exposes one. */
  incEndpointId(bridge: ShellBridge, windowId: string): string | undefined;
  dispose(): void;
}

/** Fixed fixture user. The key has no value. */
export const FIXTURE_USER_PUBKEY = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';

/** Keys the shell bridge persists in the host page; cleared so every boot starts empty. */
const SHELL_STORAGE_PREFIXES = ['napplet', 'kehto'];

function clearShellStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (SHELL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable; the shell then keeps its state in memory.
  }
}

function baseHooks(domains: DomainBackends): ShellAdapter {
  return {
    relayPool: {
      getRelayPool: () => domains.relayPool,
      trackSubscription() {},
      untrackSubscription() {},
      openScopedRelay() {},
      closeScopedRelay() {},
      publishToScopedRelay: () => false,
      selectRelayTier: () => [],
    },
    relayConfig: {
      addRelay() {},
      removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    windowManager: { createWindow: () => null },
    auth: { getUserPubkey: () => domains.user.pubkey, getSigner: () => domains.user.signer },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward() {} },
    workerRelay: { getWorkerRelay: () => null },
    crypto: { verifyEvent: async () => true },
    permissions: {
      now: () => Date.now(),
      prompt: async (prompt) => domains.decide(prompt),
      createCancellation: () => new AbortController(),
      schedule(callback, delayMs) {
        const timer = setTimeout(callback, delayMs);
        return () => clearTimeout(timer);
      },
    },
    getFocusContext: (windowId) => ({ focused: domains.focus.windowId === windowId }),
    ...domains.adapter,
  };
}

/**
 * Build the adapter and controls for one variant.
 *
 * @param variant - Profile and shell mode.
 * @returns The backends.
 */
export function createBackends(variant: TargetVariant): Backends {
  clearShellStorage();
  const domains = fullBackends(variant);
  const disabled = [
    ...(variant.shell === 'shell-absent' ? ['shell'] : []),
    ...(variant.profile === 'minimal' ? minimalDisabledDomains(domains) : []),
  ];
  const hooks: ShellAdapter = { ...baseHooks(domains), capabilities: { disabledDomains: disabled } };
  if (variant.profile === 'minimal') hooks.services = {};
  return {
    hooks,
    controls: Object.keys(domains.controls),
    async control(name, payload, context) {
      return domains.controls[name]?.(payload, context);
    },
    attach(bridge) { domains.attach(bridge); },
    incEndpointId(bridge, windowId) {
      const getter = (bridge.runtime as { getIncEndpointId?: (id: string) => string | undefined }).getIncEndpointId;
      return typeof getter === 'function' ? getter.call(bridge.runtime, windowId) : undefined;
    },
    dispose() {
      domains.dispose();
      clearShellStorage();
    },
  };
}
