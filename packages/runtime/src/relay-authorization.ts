import type { PermissionRequirement } from '@kehto/firewall';
import type { ApprovalSignal } from './approval-coordinator.js';
import type { RelayOperationPlan } from './service-types.js';
import type { ServiceRuntimeContext } from './types.js';

// WHATWG URL is supplied by the Node/browser host; no DOM dependency is needed.
declare const URL: {
  new(value: string): { protocol: string; origin: string; username: string; password: string; hash: string };
};
declare const console: { warn(message: string): void };
const legacyNetworkWarnings = new WeakSet<object>();

/** Validate every planned destination before deriving its canonical origin. */
function relayRequirements(plan: RelayOperationPlan): PermissionRequirement[] {
  const requirements: PermissionRequirement[] = [{
    category: 'interface', domain: 'relay', operation: 'access', scope: { kind: 'exact', value: 'relay' },
  }];
  for (const value of plan.relayUrls) {
    if (typeof value !== 'string' || /[\u0000-\u0020\\]/u.test(value)) throw new Error('invalid relay destination');
    const url = new URL(value);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) {
      throw new Error('invalid relay destination');
    }
    requirements.push({ category: 'network', domain: 'relay', operation: 'relay.network',
      scope: { kind: 'origin', value: url.origin } });
  }
  return requirements;
}

/** Detach dynamic host routing state before the approval coordinator can wait. */
export function snapshotRelayPlan(plan: RelayOperationPlan): RelayOperationPlan {
  return Object.freeze({ ...plan, relayUrls: Object.freeze([...new Set(plan.relayUrls)]) });
}

/** Require operation authority for caller hints; unhinted legacy host routing remains supported. */
export async function authorizeRelay<T>(
  context: { authorizeOperation?: ServiceRuntimeContext['authorizeOperation'] },
  windowId: string,
  operation: string,
  plan: RelayOperationPlan,
  execute: (signal: ApprovalSignal) => T | Promise<T>,
  relayHint?: string,
): Promise<void> {
  const requirements = relayRequirements(plan);
  const run = context.authorizeOperation;
  if (!run) {
    if (relayHint && plan.relayUrls.length > 0) throw new Error('relay hints require RuntimeAdapter.permissions');
    if (plan.relayUrls.length > 0 && !legacyNetworkWarnings.has(context)) {
      legacyNetworkWarnings.add(context);
      console.warn('[FW-RELAY-NETWORK-LEGACY-001] Configure RuntimeAdapter.permissions for destination approval; unhinted legacy host routing is deprecated. Warning once per runtime instance.');
    }
    await execute({ aborted: false, addEventListener() {}, removeEventListener() {} });
    return;
  }
  const outcome = await run(windowId, operation, requirements, execute);
  if (outcome.status !== 'executed') throw new Error(`relay authorization ${outcome.status}`);
}
