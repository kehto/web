import { createFirewallState } from '@kehto/rate-limit/legacy';
import type { FirewallPersistence, FirewallStateContainer } from '@kehto/rate-limit/legacy';
import { createShellBridge as createBaseBridge } from './index.js';
import type { ShellAdapter } from './types.js';

/** Test fixture explicitly installing optional legacy host controls. */
export function createLegacyShellBridge(hooks: ShellAdapter & { firewallPersistence?: FirewallPersistence }) {
  const firewallState = createFirewallState(hooks.firewallPersistence);
  const bridge = createBaseBridge({ ...hooks, legacyFirewall: firewallState });
  Object.assign(bridge.runtime, { firewallState });
  return bridge as typeof bridge & { runtime: typeof bridge.runtime & { firewallState: FirewallStateContainer } };
}
