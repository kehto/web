/** Pure approval and scoped access policy. Temporal protection is optional @kehto/rate-limit. */
export {
  createPermissionState, permissionPrincipalKey, putPermissionGrant, revokePermissionGrant,
  evaluatePermissions, consumePermissionGrants, serializePermissions, deserializePermissions,
  MAX_PERMISSION_REQUIREMENTS, MAX_PERMISSION_REQUIREMENTS_CEILING, MAX_PERMISSION_GRANTS, MAX_PERMISSION_GRANTS_CEILING,
  permissionLimits,
} from './permissions.js';
export type { PermissionLimits } from './permissions.js';
export { normalizePermissionScope, normalizeRequirement } from './permission-scopes.js';
export type {
  PermissionPrincipal, PermissionCategory, PermissionScope, PermissionRequirement,
  PermissionRequest, PermissionGrant, PermissionState, PermissionPolicyOptions,
  PermissionDecision, PermissionLoadResult,
} from './permission-types.js';
export {
  createPermissionRules, permissionRuleSubject, resolvePermissionRule, setPermissionRule,
  serializePermissionRules, deserializePermissionRules,
} from './permission-rules.js';
export type {
  PermissionRuleAction, PermissionRuleScope, PermissionRules, PermissionRuleTarget,
  PermissionRulesLoadResult,
} from './permission-rules.js';
