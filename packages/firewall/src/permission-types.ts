/** Verified catalog identity or an explicitly separate development target. */
export type PermissionPrincipal =
  | { readonly kind: 'verified'; readonly manifestKey: string; readonly artifactHash: string }
  | { readonly kind: 'development'; readonly target: string; readonly artifactHash: string };

/** Built-in permission families plus explicitly registered host extensions. */
export type PermissionCategory = 'interface' | 'resource' | 'network' | `extension:${string}`;

/** Exact resource keys, network origins, or virtual directory subtrees. */
export interface PermissionScope {
  readonly kind: 'exact' | 'origin' | 'directory';
  readonly value: string;
}

/** One authority required for an operation. */
export interface PermissionRequirement {
  readonly category: PermissionCategory;
  readonly domain: string;
  readonly operation: string;
  readonly scope: PermissionScope;
}

/** Request context comes from the authenticated endpoint, never the wire payload. */
export interface PermissionRequest {
  readonly principal: PermissionPrincipal;
  readonly sessionId: string;
  readonly requestId: string;
  readonly requirements: readonly PermissionRequirement[];
}

/** Explicit grant or refusal with a bounded lifetime. */
export interface PermissionGrant {
  readonly id: string;
  readonly principal: PermissionPrincipal;
  readonly permission: PermissionRequirement;
  readonly effect: 'allow' | 'deny';
  readonly lifetime: 'once' | 'session' | 'persistent';
  readonly sessionId?: string;
  readonly requestId?: string;
}

/** Versioned immutable policy. Ephemeral lifetimes are omitted by serialization. */
export interface PermissionState {
  readonly version: 1;
  readonly grants: readonly PermissionGrant[];
}

/** Host-owned category registry; extension scopes use exact equality. */
export interface PermissionPolicyOptions {
  readonly extensions?: readonly `extension:${string}`[];
}

/** Pure authorization outcome. Missing requirements may be shown for approval. */
export interface PermissionDecision {
  readonly decision: 'allow' | 'deny' | 'ask';
  readonly reason: 'granted' | 'explicit-denial' | 'approval-required';
  readonly grantIds: readonly string[];
  readonly missing: readonly PermissionRequirement[];
}

/** Parsing failure is explicit so hosts can report damaged storage. */
export type PermissionLoadResult =
  | { readonly ok: true; readonly state: PermissionState }
  | { readonly ok: false; readonly reason: 'invalid-state' | 'unsupported-version' };
