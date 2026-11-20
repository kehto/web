---
"@kehto/firewall": minor
"@kehto/runtime": minor
"@kehto/services": patch
"@kehto/paja": patch
---

Make the Firewall's requirement and grant caps host policy (kehto/web#514).

- `PermissionPolicyOptions` gains `maxRequirements` (default
  `MAX_PERMISSION_REQUIREMENTS`, 128) and `maxGrants` (default
  `MAX_PERMISSION_GRANTS`, 2048). `permissionLimits()` validates them against
  `MAX_PERMISSION_REQUIREMENTS_CEILING` (1024) and
  `MAX_PERMISSION_GRANTS_CEILING` (16384) and throws a `RangeError` otherwise.
- `PermissionAdapter` accepts both; the approval coordinator validates them when
  it is built, and services see the first as
  `ServiceRuntimeContext.maxPermissionRequirements`.
- `ApprovalFailure` gains `capacity`: a full grant table is reported as host
  capacity, not a denial. OUTBOX and runtime `relay.*` answer it with
  `approval capacity reached` (kehto/web#513).
- OUTBOX plans and COUNT size themselves to the configured `maxRequirements`;
  `createRelayPoolOutboxRouter` takes `maxRelayOrigins` for its coverage selection.
- Paja exposes `firewall.maxRequirements` (2–1024) and `firewall.maxGrants`
  (64–16384) in its Firewall settings group; they apply on reload.
