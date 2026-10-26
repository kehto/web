import { normalizeRequirement, permissionScopeMatches, permissionText } from './permission-scopes.js';
import type {
  PermissionDecision, PermissionGrant, PermissionLoadResult, PermissionPolicyOptions,
  PermissionPrincipal, PermissionRequest, PermissionRequirement, PermissionState,
} from './permission-types.js';

const MAX_GRANTS = 2048;
const HASH = /^[a-f0-9]{64}$/;
const MANIFEST = /^nip5d:(?:35129:[a-f0-9]{64}:.+|15129:[a-f0-9]{64}|5129:[a-f0-9]{64})$/;

function principalSnapshot(principal: PermissionPrincipal): PermissionPrincipal {
  if (!principal || !HASH.test(principal.artifactHash)) throw new TypeError('Invalid permission artifact identity');
  if (principal.kind === 'verified' && permissionText(principal.manifestKey) && MANIFEST.test(principal.manifestKey)) {
    return Object.freeze({ kind: 'verified', manifestKey: principal.manifestKey, artifactHash: principal.artifactHash });
  }
  if (principal.kind === 'development' && permissionText(principal.target)) {
    return Object.freeze({ kind: 'development', target: principal.target, artifactHash: principal.artifactHash });
  }
  throw new TypeError('Permission identity must be verified or explicitly developmental');
}

/**
 * Build a collision-free key from an already verified host principal.
 * This validates shape; callers remain responsible for signature/byte verification.
 * @param principal - Verified catalog identity or isolated development target.
 * @returns Opaque identity key including the artifact version.
 * @example permissionPrincipalKey({ kind: 'development', target: 'http://localhost:5173', artifactHash });
 */
export function permissionPrincipalKey(principal: PermissionPrincipal): string {
  const value = principalSnapshot(principal);
  return JSON.stringify([value.kind, value.kind === 'verified' ? value.manifestKey : value.target, value.artifactHash]);
}

function snapshot(grants: readonly PermissionGrant[]): PermissionState {
  return Object.freeze({ version: 1, grants: Object.freeze([...grants]) });
}

/**
 * Create a policy with no grants. Unapproved valid requests ask for approval.
 * @returns Empty immutable permission state.
 * @example const permissions = createPermissionState();
 */
export function createPermissionState(): PermissionState {
  return snapshot([]);
}

function grantSnapshot(grant: PermissionGrant, options: PermissionPolicyOptions): PermissionGrant {
  if (!grant || !permissionText(grant.id, 256) || (grant.effect !== 'allow' && grant.effect !== 'deny')) {
    throw new TypeError('Invalid permission grant');
  }
  const principal = principalSnapshot(grant.principal);
  const permission = normalizeRequirement(grant.permission, options);
  if (grant.lifetime === 'persistent') {
    if (principal.kind !== 'verified' || grant.sessionId !== undefined || grant.requestId !== undefined) {
      throw new TypeError('Persistent grants require verified identity and no ephemeral scope');
    }
    return Object.freeze({ id: grant.id, principal, permission, effect: grant.effect, lifetime: 'persistent' });
  }
  if (!permissionText(grant.sessionId, 256) || (grant.lifetime !== 'once' && grant.lifetime !== 'session')) {
    throw new TypeError('Ephemeral grants require a session generation');
  }
  if (grant.lifetime === 'session' && grant.requestId !== undefined) throw new TypeError('Session grants cannot carry a request token');
  if (grant.lifetime === 'once' && !permissionText(grant.requestId, 256)) throw new TypeError('Once grants require a request token');
  return Object.freeze({
    id: grant.id, principal, permission, effect: grant.effect, lifetime: grant.lifetime,
    sessionId: grant.sessionId, ...(grant.lifetime === 'once' ? { requestId: grant.requestId } : {}),
  });
}

/**
 * Add or replace an exact grant, preserving immutable snapshots.
 * @param state - Existing permission state.
 * @param grant - Explicit policy decision; never a legacy broad allow.
 * @param options - Host-registered extension categories.
 * @returns Detached policy snapshot.
 * @example state = putPermissionGrant(state, grant);
 */
export function putPermissionGrant(state: PermissionState, grant: PermissionGrant, options: PermissionPolicyOptions = {}): PermissionState {
  const entry = grantSnapshot(grant, options);
  const retained = state.grants.filter((item) => item.id !== entry.id);
  if (retained.length >= MAX_GRANTS) throw new RangeError('Permission grant limit exceeded');
  return snapshot([...retained, entry]);
}

/**
 * Remove a grant. Runtime callers also invalidate affected pending/live work.
 * @param state - Existing policy.
 * @param id - Exact host-generated grant identifier.
 * @returns Policy without the grant.
 * @example state = revokePermissionGrant(state, 'grant-1');
 */
export function revokePermissionGrant(state: PermissionState, id: string): PermissionState {
  return snapshot(state.grants.filter((grant) => grant.id !== id));
}

function requestRequirements(request: PermissionRequest, options: PermissionPolicyOptions): PermissionRequirement[] {
  if (!permissionText(request.sessionId, 256) || !permissionText(request.requestId, 256)
    || !Array.isArray(request.requirements) || request.requirements.length < 1 || request.requirements.length > 128) {
    throw new TypeError('Invalid permission request');
  }
  const requirements = request.requirements.map((value) => normalizeRequirement(value, options));
  for (const domain of new Set(requirements.map((item) => item.domain))) {
    if (!requirements.some((item) => item.category === 'interface' && item.domain === domain)) {
      requirements.push(Object.freeze({ category: 'interface', domain, operation: 'access', scope: Object.freeze({ kind: 'exact', value: domain }) }));
    }
  }
  return requirements;
}

function matches(grant: PermissionGrant, requirement: PermissionRequirement, request: PermissionRequest): boolean {
  if (permissionPrincipalKey(grant.principal) !== permissionPrincipalKey(request.principal)) return false;
  if (grant.lifetime !== 'persistent' && grant.sessionId !== request.sessionId) return false;
  if (grant.lifetime === 'once' && grant.requestId !== request.requestId) return false;
  const permission = grant.permission;
  return permission.category === requirement.category && permission.domain === requirement.domain
    && permission.operation === requirement.operation && permissionScopeMatches(permission.scope, requirement.scope);
}

/**
 * Evaluate composed requirements with implicit interface access and deny priority.
 * The caller enforces protocol safety and ACL constraints independently. An allow
 * does not consume one-use grants; consume them atomically before execution.
 * @param state - Host-owned validated policy.
 * @param request - Exact authenticated operation context.
 * @param options - Explicit extension registry.
 * @returns Allow, deny or missing scopes requiring approval.
 * @example const decision = evaluatePermissions(state, request);
 */
export function evaluatePermissions(state: PermissionState, request: PermissionRequest, options: PermissionPolicyOptions = {}): PermissionDecision {
  principalSnapshot(request.principal);
  const requirements = requestRequirements(request, options);
  const grantIds: string[] = [];
  const missing: PermissionRequirement[] = [];
  for (const requirement of requirements) {
    const candidates = state.grants.filter((grant) => matches(grant, requirement, request));
    const denied = candidates.find((grant) => grant.effect === 'deny');
    if (denied) return Object.freeze({ decision: 'deny', reason: 'explicit-denial', grantIds: Object.freeze([denied.id]), missing: Object.freeze([]) });
    // Prefer durable scopes, then session, then once; break ties by stable ID.
    const rank = { persistent: 0, session: 1, once: 2 };
    const allowed = candidates.sort((a, b) => rank[a.lifetime] - rank[b.lifetime] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (allowed) grantIds.push(allowed.id);
    else missing.push(requirement);
  }
  return Object.freeze({
    decision: missing.length ? 'ask' : 'allow', reason: missing.length ? 'approval-required' : 'granted',
    grantIds: Object.freeze([...new Set(grantIds)]), missing: Object.freeze(missing),
  });
}

/**
 * Recheck and consume exactly the once grants used by this operation.
 * @param state - Latest policy immediately before committing a side effect.
 * @param request - Authenticated request with host-generated request token.
 * @param options - Registered host extension categories.
 * @returns Decision plus next state; no grants consumed on ask or deny.
 * @example const result = consumePermissionGrants(state, request);
 */
export function consumePermissionGrants(state: PermissionState, request: PermissionRequest, options: PermissionPolicyOptions = {}): { decision: PermissionDecision; state: PermissionState } {
  const decision = evaluatePermissions(state, request, options);
  if (decision.decision !== 'allow') return { decision, state };
  return { decision, state: snapshot(state.grants.filter((grant) => grant.lifetime !== 'once' || !decision.grantIds.includes(grant.id))) };
}

/**
 * Serialize only persistent grants; session and once approvals never survive restart.
 * @param state - Validated immutable policy.
 * @returns Versioned JSON document.
 * @example const serialized = serializePermissions(state);
 */
export function serializePermissions(state: PermissionState): string {
  const document = JSON.stringify({ version: 1, grants: state.grants.filter((grant) => grant.lifetime === 'persistent') });
  if (document.length > 2 * 1024 * 1024) throw new RangeError('Persistent permission document exceeds its size limit');
  return document;
}

/**
 * Parse versioned durable policy, refusing the whole document on invalid grants.
 * Legacy broad allows are not accepted or translated into new authority.
 * @param raw - Storage document, limited to 2 MiB.
 * @param options - Host-registered categories accepted in this policy.
 * @returns Explicit parse result; failure never grants authority.
 * @example const loaded = deserializePermissions(serialized);
 */
export function deserializePermissions(raw: string, options: PermissionPolicyOptions = {}): PermissionLoadResult {
  try {
    if (raw.length > 2 * 1024 * 1024) return { ok: false, reason: 'invalid-state' };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'invalid-state' };
    if (parsed.version !== 1) return { ok: false, reason: 'unsupported-version' };
    if (!Array.isArray(parsed.grants) || parsed.grants.length > MAX_GRANTS) return { ok: false, reason: 'invalid-state' };
    const ids = new Set<string>();
    const grants = parsed.grants.map((value: PermissionGrant) => {
      const grant = grantSnapshot(value, options);
      if (grant.lifetime !== 'persistent' || ids.has(grant.id)) throw new TypeError('Invalid durable grant');
      ids.add(grant.id);
      return grant;
    });
    return { ok: true, state: snapshot(grants) };
  } catch {
    return { ok: false, reason: 'invalid-state' };
  }
}
