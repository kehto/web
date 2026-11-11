/** Pure approval and scoped access policy. Temporal protection is optional @kehto/rate-limit. */
export {
  createPermissionState, permissionPrincipalKey, putPermissionGrant, revokePermissionGrant,
  evaluatePermissions, consumePermissionGrants, serializePermissions, deserializePermissions,
} from './permissions.js';
export { normalizePermissionScope, normalizeRequirement } from './permission-scopes.js';
export type {
  PermissionPrincipal, PermissionCategory, PermissionScope, PermissionRequirement,
  PermissionRequest, PermissionGrant, PermissionState, PermissionPolicyOptions,
  PermissionDecision, PermissionLoadResult,
} from './permission-types.js';
