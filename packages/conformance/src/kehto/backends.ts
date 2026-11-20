/**
 * kehto/backends.ts — Deterministic in-memory backends for the first-party target.
 *
 * Assembles the `ShellAdapter` for one variant. Nothing here reaches a relay,
 * a device, a prompt or the network.
 */
import { resolveCapabilitiesNap, type Capability, type LegacyFirewallAdapter } from '@kehto/runtime';
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

/** Which runtime gate a session denies through. */
export type SessionGate = 'permissions' | 'legacy-firewall';

/**
 * A legacy Firewall that rejects every request from a blocked endpoint and
 * counts the rejections, so a check can prove the gate itself fired.
 */
function createBlockingFirewall(): { adapter: LegacyFirewallAdapter; block(endpoint: string): void; rejections(endpoint: string): number } {
  const blocked = new Set<string>();
  const rejected = new Map<string, number>();
  return {
    adapter: {
      evaluate(observation) {
        // `initKey` is the host's source-bound window id, never napplet-supplied.
        const endpoint = observation.initKey ?? '';
        if (!blocked.has(endpoint)) return { decision: 'pass', action: 'ignore', ruleId: 'conformance-pass', reason: 'not blocked' };
        rejected.set(endpoint, (rejected.get(endpoint) ?? 0) + 1);
        return { decision: 'reject', action: 'block', ruleId: 'conformance-block', reason: 'blocked by conformance' };
      },
      resetInitBudget() {}, setPolicy() {}, persist() {}, load() {},
    },
    block(endpoint) { blocked.add(endpoint); },
    rejections: (endpoint) => rejected.get(endpoint) ?? 0,
  };
}

/** Revoke the ACL capability a request needs for one endpoint; returns it, or `null` when it needs none. */
function revokeCapability(payload: unknown, { bridge }: ControlContext): string | null {
  const { endpoint, envelope } = payload as { endpoint: string; envelope: { type: string } };
  const capability = resolveCapabilitiesNap(envelope as Parameters<typeof resolveCapabilitiesNap>[0]).senderCap;
  const entry = bridge.runtime.sessionRegistry.getEntryByWindowId(endpoint);
  if (!capability || !entry) return null;
  bridge.runtime.aclState.revoke('', entry.dTag, entry.aggregateHash, capability as Capability);
  return capability;
}

/**
 * Build the adapter and controls for one variant.
 *
 * The default gate is the scoped `permissions` coordinator. `legacy-firewall`
 * boots without it and installs a blocking legacy Firewall instead, adding the
 * `firewall.block` and `firewall.rejections` controls; it leaves shell storage
 * alone because it runs inside another session.
 *
 * @param variant - Profile and shell mode.
 * @param gate - The runtime gate requests are denied through.
 * @returns The backends.
 */
export function createBackends(variant: TargetVariant, gate: SessionGate = 'permissions'): Backends {
  const legacy = gate === 'legacy-firewall';
  if (!legacy) clearShellStorage();
  const domains = composeBackends(variant);
  const { permissions, ...rest } = baseHooks(domains);
  const firewall = legacy ? createBlockingFirewall() : undefined;
  const hooks: ShellAdapter = {
    ...rest,
    ...(firewall ? { legacyFirewall: firewall.adapter } : { permissions }),
    capabilities: { disabledDomains: disabledDomains(variant, domains) },
  };
  const own: Record<string, (payload: unknown, context: ControlContext) => unknown> = {
    'acl.revoke': revokeCapability,
    ...(firewall ? {
      'firewall.block': (payload: unknown) => firewall.block(String((payload as { endpoint?: unknown }).endpoint)),
      'firewall.rejections': (payload: unknown) => firewall.rejections(String((payload as { endpoint?: unknown }).endpoint)),
    } : {}),
  };
  return {
    hooks,
    controls: [...Object.keys(domains.controls), ...Object.keys(own)],
    async control(name, payload, context) {
      if (Object.hasOwn(own, name)) return own[name](payload, context);
      return domains.controls[name]?.(payload, context);
    },
    attach(bridge) { domains.attach(bridge); },
    incEndpointId(bridge, windowId) {
      return bridge.runtime.getIncEndpointId(windowId);
    },
    dispose() {
      domains.dispose();
      if (!legacy) clearShellStorage();
    },
  };
}
