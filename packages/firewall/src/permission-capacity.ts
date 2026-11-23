import { permissionLimits, putPermissionGrant } from './permissions.js';
import { permissionRuleSubject } from './permission-rules.js';
import type { PermissionGrant, PermissionPolicyOptions, PermissionState } from './permission-types.js';

/** Result of admitting grants: the next state and the session grants it evicted. */
export interface PermissionAdmitResult {
  readonly state: PermissionState;
  readonly evicted: readonly PermissionGrant[];
}

const LIMIT = 'Permission grant limit exceeded';

/**
 * Add grants from one decision, making room fairly instead of refusing
 * (kehto/web#513). Each napplet (`permissionRuleSubject`) holds at most
 * `maxGrantsPerPrincipal` grants, so one napplet can't fill the shared table.
 *
 * To make room it evicts only `session` grants, oldest first: first the same
 * napplet's own, then, if the table is still full, the napplet holding the most
 * grants. `persistent` decisions are never evicted silently, and `once` grants
 * are never evicted because the operation that earned them may be about to
 * consume them. Grants are immutable snapshots, so "oldest" is insertion order:
 * re-approving a scope re-inserts it. Throws the `putPermissionGrant` limit
 * `RangeError` when only persistent or once grants are left to evict.
 *
 * @param state - Current policy.
 * @param grants - Grants of one decision, all for the same principal.
 * @param options - Host policy bounds.
 * @param keep - Ids of grants the same decision relies on, never evicted.
 * @returns The next state and the evicted session grants, for diagnostics.
 * @example
 * ```ts
 * const { state: next, evicted } = admitPermissionGrants(state, [grant]);
 * ```
 */
export function admitPermissionGrants(state: PermissionState, grants: readonly PermissionGrant[], options: PermissionPolicyOptions = {},
  keep: readonly string[] = []): PermissionAdmitResult {
  const limits = permissionLimits(options);
  const incoming = new Set(grants.map((grant) => grant.id));
  const pinned = new Set(keep);
  const subjects = new Set(grants.map((grant) => permissionRuleSubject(grant.principal)));
  if (subjects.size > 1) throw new TypeError('One decision grants one principal');
  const [subject] = subjects;
  let kept = state.grants.filter((grant) => !incoming.has(grant.id));
  const evicted: PermissionGrant[] = [];
  const evictOldest = (owner: string): boolean => {
    const index = kept.findIndex((grant) => grant.lifetime === 'session' && !pinned.has(grant.id)
      && permissionRuleSubject(grant.principal) === owner);
    if (index < 0) return false;
    evicted.push(kept[index]!);
    kept = [...kept.slice(0, index), ...kept.slice(index + 1)];
    return true;
  };
  const owned = () => kept.filter((grant) => permissionRuleSubject(grant.principal) === subject).length;
  while (subject !== undefined && owned() + grants.length > limits.maxGrantsPerPrincipal) {
    if (!evictOldest(subject)) throw new RangeError(LIMIT);
  }
  while (kept.length + grants.length > limits.maxGrants) {
    if (!evictOldest(largestEvictableHolder(kept, pinned) ?? '')) throw new RangeError(LIMIT);
  }
  let next: PermissionState = Object.freeze({ version: 1, grants: Object.freeze(kept) });
  for (const grant of grants) next = putPermissionGrant(next, grant, options);
  return Object.freeze({ state: next, evicted: Object.freeze(evicted) });
}

/** The napplet holding the most grants among those with a session grant to evict. */
function largestEvictableHolder(grants: readonly PermissionGrant[], keep: ReadonlySet<string>): string | undefined {
  const counts = new Map<string, number>();
  const evictable = new Set<string>();
  for (const grant of grants) {
    const owner = permissionRuleSubject(grant.principal);
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
    if (grant.lifetime === 'session' && !keep.has(grant.id)) evictable.add(owner);
  }
  let best: string | undefined;
  for (const owner of evictable) if (best === undefined || counts.get(owner)! > counts.get(best)!) best = owner;
  return best;
}
