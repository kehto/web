/**
 * kehto/backends.ts — Deterministic in-memory backends for the first-party target.
 *
 * Assembles the `ShellAdapter` for one variant. Nothing here reaches a relay,
 * a device, a prompt or the network.
 */
import type { ShellAdapter, ShellBridge } from '@kehto/shell';
import type { TargetVariant } from '../target.js';
import { composeBackends, disabledDomains, type DomainBackends } from './domain-backends.js';
import type { ControlContext } from './domains/types.js';

export type { ControlContext } from './domains/types.js';

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
      getRelayPool: () => null,
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
    auth: { getUserPubkey: () => domains.user.pubkey(), getSigner: () => domains.user.current() },
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
    services: { ...domains.services },
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
  const domains = composeBackends(variant);
  const hooks: ShellAdapter = { ...baseHooks(domains), capabilities: { disabledDomains: disabledDomains(variant, domains) } };
  return {
    hooks,
    controls: Object.keys(domains.controls),
    async control(name, payload, context) {
      return domains.controls[name]?.(payload, context);
    },
    attach(bridge) { domains.attach(bridge); },
    incEndpointId(bridge, windowId) {
      return bridge.runtime.getIncEndpointId(windowId);
    },
    dispose() {
      domains.dispose();
      clearShellStorage();
    },
  };
}
