---
phase: 20-expanded-domain-napplets
plan: "03"
subsystem: napplets
tags: [identity, napplet, sdk, vite, profile-viewer, nap-07]

requires:
  - phase: 19-core-domain-napplets
    provides: composer/preferences/toaster napplet templates and D-04 AUTH probe pattern

provides:
  - profile-viewer napplet at apps/demo/napplets/profile-viewer/ (5-file skeleton)
  - identity.getPublicKey + identity.getProfile read-only flow with DOM sentinel contract
  - truncatePubkey helper (empty string -> 'no-pubkey', >16 chars -> 8...4 truncation)

affects: [20-07-identity-flow-spec, 20-integration, identity-NUB-coverage]

tech-stack:
  added: []
  patterns:
    - "D-04 AUTH probe: storage.getItem as first SDK call, discard error, then read identity"
    - "identity.getPublicKey -> identity.getProfile sequential await with per-step status transitions"
    - "truncatePubkey sentinel: empty string returns literal 'no-pubkey' for spec assertability"

key-files:
  created:
    - apps/demo/napplets/profile-viewer/package.json
    - apps/demo/napplets/profile-viewer/vite.config.ts
    - apps/demo/napplets/profile-viewer/tsconfig.json
    - apps/demo/napplets/profile-viewer/index.html
    - apps/demo/napplets/profile-viewer/src/main.ts
  modified: []

key-decisions:
  - "identity.getPublicKey + identity.getProfile are called exactly once each (single functional invocation); JSDoc comments and log strings also reference them but are not functional calls"
  - "Empty napplet-aggregate-hash is acceptable (VITE_DEV_PRIVKEY_HEX not set) — consistent with Phase 18-04 decision applied to all napplets"
  - "profile-viewer is read-only in v1.3 (no edit-profile) per CONTEXT deferred ideas"

patterns-established:
  - "profile-viewer DOM contract for Plan 20-07 spec: #profile-status transitions 'connecting...' -> 'authenticated' -> 'loaded' (or 'denied: <reason>' / 'auth failed')"
  - "truncatePubkey('') === 'no-pubkey' — spec-assertable sentinel for no-signer case"

requirements-completed: [NAP-07]

duration: 2min
completed: "2026-04-18"
---

# Phase 20 Plan 03: Profile Viewer Napplet Summary

**profile-viewer napplet wiring identity.getPublicKey + identity.getProfile with 'connecting...' -> 'authenticated' -> 'loaded' DOM sentinel and truncated pubkey display**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T09:15:44Z
- **Completed:** 2026-04-18T09:17:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `apps/demo/napplets/profile-viewer/` 5-file skeleton mirroring composer/preferences/toaster conventions
- Implemented `identity.getPublicKey()` -> `identity.getProfile()` sequential read flow with D-04 AUTH probe
- DOM sentinel contract fully specified for Plan 20-07 spec: status transitions + #profile-pubkey with 'no-pubkey' sentinel for empty-pubkey case
- Build produces clean dist output in 130ms; zero anti-term violations

## Task Commits

1. **Task 1: profile-viewer scaffolding (package.json, vite.config, tsconfig, index.html)** - `39c1ba0` (feat)
2. **Task 2: implement src/main.ts (identity.getPublicKey + identity.getProfile)** - `fde7390` (feat)

**Plan metadata:** (to be committed)

## DOM Contract Reference (for Plan 20-07 identity-flow.spec.ts)

### Status Sentinel Strings (exact)
- `'connecting...'` — HTML default (before any SDK call)
- `'authenticated'` — after D-04 AUTH probe resolves/rejects
- `'loaded'` — after both getPublicKey and getProfile complete successfully
- `'denied: <reason>'` — on ACL denial of identity:read at either step
- `'auth failed'` — on shim AUTH failure before loadIdentity completes

### DOM IDs
| ID | Element | Content |
|----|---------|---------|
| `#profile-status` | `<span>` | Status sentinel string |
| `#profile-pubkey` | `<span>` | Truncated pubkey or `'no-pubkey'` |
| `#profile-name` | `<span>` | `profile.name ?? profile.displayName` (or empty) |
| `#profile-about` | `<span>` | `profile.about` (or empty) |
| `#profile-picture` | `<img>` | `src=profile.picture`; `display: none` when absent |
| `#profile-log` | `<div>` | Timestamped log entries |

### truncatePubkey Behavior
- Empty string `''` → `'no-pubkey'` (spec-assertable for no-signer case)
- `length <= 16` → pubkey as-is
- `length > 16` → `${pubkey.slice(0,8)}...${pubkey.slice(-4)}`

## Identity Call Sites (for spec reference)

```typescript
// src/main.ts line ~66
pubkey = await identity.getPublicKey();

// src/main.ts line ~78
const profile = await identity.getProfile();
```

Each is invoked exactly once on init (single functional call site per method).

## Anti-Term Grep Evidence

```
window.addEventListener occurrences: 0  (PASS)
window.nostr occurrences: 0             (PASS)
BusKind occurrences: 0                  (PASS — JSDoc comment uses neutral phrasing)
NIP-01 arrays: 0                        (PASS)
```

Note: `grep -c 'identity.getPublicKey'` returns 5 (includes JSDoc, log strings) and `grep -c 'identity.getProfile'` returns 6. There is exactly 1 functional call site for each (the `await` expressions). Plan 20-07 spec should use functional-call-aware grep (e.g., `grep -c "await identity.getPublicKey"`) or count via AST.

## Files Created/Modified

- `apps/demo/napplets/profile-viewer/package.json` — workspace package descriptor (@kehto/demo-profile-viewer)
- `apps/demo/napplets/profile-viewer/vite.config.ts` — Vite config with nip5aManifest, nappletType: 'demo-profile-viewer'
- `apps/demo/napplets/profile-viewer/tsconfig.json` — TypeScript config (byte-for-byte copy of composer tsconfig)
- `apps/demo/napplets/profile-viewer/index.html` — DOM skeleton with all required IDs; composer style block reused + profile-specific CSS
- `apps/demo/napplets/profile-viewer/src/main.ts` — 104-line identity flow implementation

## Decisions Made

- `identity.getPublicKey()` and `identity.getProfile()` called exactly once each (functional invocations); occurrences in comments and log strings are documentation, not calls
- Empty `napplet-aggregate-hash` is acceptable per Phase 18-04 decision (VITE_DEV_PRIVKEY_HEX not set in dev)
- Profile viewer is read-only in v1.3; edit-profile deferred (per CONTEXT)

## Deviations from Plan

None — plan executed exactly as written. All anti-features verified absent.

## Issues Encountered

None.

## Known Stubs

None — identity.getPublicKey and identity.getProfile are real SDK calls; null profile is handled gracefully (not a stub).

## Next Phase Readiness

- `apps/demo/napplets/profile-viewer/` is complete and builds clean
- Plan 20-07 (`identity-flow.spec.ts`) can now assert against the DOM sentinel contract documented above
- NAP-09 8-domain coverage gate: profile-viewer (identity) + feed (relay-subscribe, Plan 20-01) + theme-switcher (Plan 20-05) will complete the domain set

---
*Phase: 20-expanded-domain-napplets*
*Completed: 2026-04-18*
