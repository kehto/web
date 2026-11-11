import { createFirewallState } from '@kehto/rate-limit/legacy';
import type { FirewallPersistence } from '@kehto/rate-limit/legacy';
import { createRuntime as createBaseRuntime } from './runtime.js';
import type { RuntimeAdapter } from './types.js';

/** Test fixture explicitly installing the historical behavioral policy. */
export function createLegacyRuntime(hooks: RuntimeAdapter & { firewallPersistence?: FirewallPersistence }) {
  const firewallState = createFirewallState(hooks.firewallPersistence);
  hooks.legacyFirewall = firewallState;
  return Object.assign(createBaseRuntime(hooks), { firewallState });
}
