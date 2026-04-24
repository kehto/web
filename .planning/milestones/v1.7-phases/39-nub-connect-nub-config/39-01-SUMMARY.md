---
phase: 39-nub-connect-nub-config
plan: "01"
subsystem: acl, shell, infra
tags: [connect-store, localStorage, capability, resolve, audit-csp, NUB-CONNECT, NUB-CONFIG]

requires:
  - phase: 38-nub-class-adoption
    provides: provisional-class.ts singleton pattern; ShellBridge interface convention
  - phase: 37-spec-resync
    provides: provisional-connect.ts (ConnectGrant, ConnectGrantKey, ConnectConsentRequest, ConsentResult)

provides:
  - connectStore singleton (grant/revoke/check/getOrigins/getAllGrants/persist/load/clear) under localStorage key napplet:connect
  - connectGrantKey(dTag, aggregateHash) composite-key helper
  - ShellBridge.connectStore readonly surface
  - config:read capability in ALL_CAPABILITIES + CAP_CONFIG_READ constant
  - resolveCapabilitiesNub case 'config' → configMap (sender/recipient gate)
  - scripts/audit-csp.mjs + pnpm audit:csp script entry
  - Two changesets: @kehto/shell minor, @kehto/acl minor

affects:
  - 39-02 (createConfigService uses config:read)
  - 39-03 (Vite CSP plugin imports connectStore.getOrigins)
  - 39-04 (consent flow calls connectStore.grant)
  - 39-05 (adds audit:csp to GitHub Actions workflow)

tech-stack:
  added: []
  patterns:
    - connect-store mirrors acl-store.ts module-level singleton + localStorage persistence pattern
    - RESTRICTIVE default policy (opposite of aclStore permissive default) — check() returns false for unknown entries
    - Composite key <dTag>:<aggregateHash> makes CONNECT-06 hash-upgrade structurally guaranteed
    - Node ESM block comment must not contain glob patterns with */ — use prose descriptions instead

key-files:
  created:
    - packages/shell/src/connect-store.ts
    - scripts/audit-csp.mjs
    - .changeset/connect-01-shell-connect-store.md
    - .changeset/config-02-capability.md
  modified:
    - packages/shell/src/shell-bridge.ts
    - packages/shell/src/index.ts
    - packages/acl/src/capabilities.ts
    - packages/acl/src/resolve.ts
    - packages/runtime/src/acl-state.ts
    - package.json

key-decisions:
  - "RESTRICTIVE default: connectStore.check() returns false for any origin not explicitly granted (NUB-CONNECT security invariant)"
  - "configMap uses recipient gate for shell-push messages (config.values, registerSchema.result, schemaError) and sender gate for napplet requests"
  - "Node ESM block comment */ gotcha: glob pattern apps/demo/napplets/*/dist in JSDoc caused SyntaxError; fixed by using prose description"
  - "CAP_CONFIG_READ added to CAP_MAP in packages/runtime/src/acl-state.ts (bit 1<<14 = 16384) to satisfy Record<Capability, number> constraint"

patterns-established:
  - "connect-store pattern: module-level Map + localStorage persistence under napplet: prefix key"
  - "ConnectStore interface exported from connect-store.ts for use in shell-bridge.ts type-only import"

requirements-completed:
  - CONNECT-01
  - CONNECT-05
  - CONNECT-06
  - CONFIG-02

duration: 18min
completed: "2026-04-24"
---

# Phase 39 Plan 01: NUB-CONNECT Foundation + NUB-CONFIG ACL Surface Summary

**connect-store singleton (CONNECT-01/CONNECT-06), ShellBridge.connectStore surface, config:read ACL capability with resolve.ts dispatch, and pnpm audit:csp meta-CSP residual tag enforcement script**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-24T14:25:00Z
- **Completed:** 2026-04-24T14:43:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `connect-store.ts` singleton implemented with RESTRICTIVE default policy, composite-key `<dTag>:<aggregateHash>` localStorage persistence under `napplet:connect`, and full grant/revoke/check/getOrigins/getAllGrants/persist/load/clear API
- `ShellBridge.connectStore` readonly getter wired in `shell-bridge.ts`; `connectStore` + `ConnectStore` type re-exported from `packages/shell/src/index.ts` alongside all four provisional-connect.ts wire types
- `config:read` added to `ALL_CAPABILITIES` and `CAP_CONFIG_READ` constant; `resolveCapabilitiesNub` extended with `case 'config'` dispatching to `configMap` (asymmetric: sender gate for napplet requests, recipient gate for shell pushes)
- `scripts/audit-csp.mjs` created and `pnpm audit:csp` wired in root `package.json`; scanned 10 napplet dist/index.html files, exits 0 clean
- Two changesets written: `@kehto/shell` minor (connect-store public surface), `@kehto/acl` minor (config:read capability)

## Task Commits

1. **Task 1: connect-store singleton + ShellBridge.connectStore + index re-exports** - `6b01607` (feat)
2. **Task 2: config:read capability + resolve.ts dispatch + changeset** - `d4e733e` (feat)
3. **Task 3: audit-csp.mjs script + pnpm audit:csp wiring + runtime CAP_MAP fix** - `cfdcc37` (feat)

**Plan metadata:** _(final docs commit follows)_

## Files Created/Modified

- `packages/shell/src/connect-store.ts` — new: connectStore singleton + ConnectStore interface + connectGrantKey helper
- `packages/shell/src/shell-bridge.ts` — added: import { connectStore } + ConnectStore type import + `readonly connectStore: ConnectStore` interface member + `get connectStore()` getter in return object
- `packages/shell/src/index.ts` — added: export connectStore, connectGrantKey, ConnectStore type, ConnectGrant/ConnectGrantKey/ConnectConsentRequest/ConsentResult types
- `packages/acl/src/capabilities.ts` — added: `'config:read'` to ALL_CAPABILITIES + `CAP_CONFIG_READ` constant
- `packages/acl/src/resolve.ts` — added: configMap function + `case 'config'` switch arm + JSDoc table rows for config domain
- `packages/runtime/src/acl-state.ts` — auto-fix: added `CAP_CONFIG_READ = 1 << 14` + `'config:read': CAP_CONFIG_READ` to CAP_MAP (Rule 1 bug fix)
- `scripts/audit-csp.mjs` — new: Node ESM script scanning napplet dist/index.html for meta-CSP tags
- `package.json` — added: `"audit:csp": "node scripts/audit-csp.mjs"` script entry
- `.changeset/connect-01-shell-connect-store.md` — new: @kehto/shell minor bump
- `.changeset/config-02-capability.md` — new: @kehto/acl minor bump

## Decisions Made

- Used RESTRICTIVE default for connectStore (check() → false for unknown entries), mirroring the NUB-CONNECT security invariant. Opposite of aclStore's permissive default.
- configMap uses recipient gate (`recipientCap: 'config:read'`) for shell-push messages (`values`, `registerSchema.result`, `schemaError`) and sender gate for all napplet-originated requests.
- Origins sorted deterministically in `grant()` with `[...new Set(origins)].sort()` for idempotent CSP header output (Plan 39-03 dependency).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added config:read to CAP_MAP in packages/runtime/src/acl-state.ts**
- **Found during:** Task 3 (build verification)
- **Issue:** `packages/runtime/src/acl-state.ts` has `CAP_MAP: Record<Capability, number>` — adding `config:read` to `ALL_CAPABILITIES` made the type require the new capability in CAP_MAP, causing a DTS build error: `Property '"config:read"' is missing in type`
- **Fix:** Added `const CAP_CONFIG_READ = 1 << 14;` (bit 14, value 16384) and `'config:read': CAP_CONFIG_READ` to the CAP_MAP object. Next available bit after `theme:read` (bit 13 = 8192).
- **Files modified:** `packages/runtime/src/acl-state.ts`
- **Verification:** `pnpm build` passed (24/24 tasks successful) after fix
- **Committed in:** `cfdcc37` (Task 3 commit)

**2. [Rule 1 - Bug] Node ESM comment `*/` gotcha in audit-csp.mjs JSDoc**
- **Found during:** Task 3 (smoke-test of `pnpm audit:csp`)
- **Issue:** Initial JSDoc comment included the glob pattern `` `apps/demo/napplets/*/dist/index.html` `` — the `*/` inside the backtick span terminates the `/** */` block comment prematurely. Node 22.22.1 ESM parser then sees unquoted text and throws `SyntaxError: Unexpected identifier 'pnpm'` on the next backtick-enclosed phrase.
- **Fix:** Rewrote JSDoc to use prose descriptions instead of glob patterns, replaced backtick-quotes with double-quote references, and replaced em-dash `—` separators with `--` in descriptive lines.
- **Files modified:** `scripts/audit-csp.mjs`
- **Verification:** `pnpm audit:csp` exits 0 with `scanned 10 napplet dist/index.html file(s), no meta-CSP found`
- **Committed in:** `cfdcc37` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 × Rule 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Grep Self-Check Results

```
grep -c "export const connectStore" packages/shell/src/connect-store.ts → 1 ✓
grep -c "connectStore" packages/shell/src/shell-bridge.ts → 4 ✓ (import + type import + interface + getter)
grep -c "export { connectStore" packages/shell/src/index.ts → 1 ✓
grep -c "'config:read'" packages/acl/src/capabilities.ts → 2 ✓ (ALL_CAPABILITIES + CAP_CONFIG_READ)
grep -c "case 'config'" packages/acl/src/resolve.ts → 1 ✓
grep -c "configMap" packages/acl/src/resolve.ts → 2 ✓ (function decl + switch call)
grep -q "@kehto/shell" .changeset/connect-01-shell-connect-store.md → ✓
grep -q "@kehto/acl" .changeset/config-02-capability.md → ✓
grep -q '"audit:csp":' package.json → ✓
test -r scripts/audit-csp.mjs → ✓
```

## pnpm audit:csp Output

```
[audit:csp] OK — scanned 10 napplet dist/index.html file(s), no meta-CSP found
```

## Issues Encountered

- Node 22.22.1 ESM parser terminates `/** */` block comments at the first `*/` character sequence encountered, even inside backtick-quoted text spans. Glob patterns like `napplets/*/dist` in JSDoc comments cause parse failures. Fixed by writing prose descriptions instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **39-02 (createConfigService)**: `config:read` capability is now in ALL_CAPABILITIES and `resolveCapabilitiesNub` returns the correct gates for `config.*` messages. 39-02 can proceed immediately.
- **39-03 (Vite CSP plugin)**: `connectStore.getOrigins(dTag, aggregateHash)` is available on `@kehto/shell` export; `connectGrantKey` is available for the in-memory middleware map key. 39-03 can import directly.
- **39-04 (consent flow)**: `connectStore.grant(dTag, aggregateHash, origins)` is the approval path. `ShellBridge.connectStore` is the bridge access point.
- **39-05 (CI workflow)**: `pnpm audit:csp` script exists and exits 0 on clean workspace; 39-05 adds the GitHub Actions step.

---
*Phase: 39-nub-connect-nub-config*
*Completed: 2026-04-24*
