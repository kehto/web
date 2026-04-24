---
phase: 38-nub-class-adoption
plan: 03
subsystem: demo, e2e, docs
tags: [nub-class, class-invariant, e2e, policy, demo-integration, phase-close]

# Dependency graph
requires:
  - phase: 38-nub-class-adoption
    plan: 02
    provides: CLASS_CAPABILITY_ALLOWLIST + enforceNub class pre-filter + EnforceResult.reason
provides:
  - "CLASS_BY_DTAG ReadonlyMap adjacent to DEMO_NAPPLETS — all 10 entries null (D2, D3)"
  - "Module-load assertion in shell-host.ts — throws at import if DEMO_NAPPLETS entry missing from CLASS_BY_DTAG (D4, H-05)"
  - "registerSessionEntry reads class: CLASS_BY_DTAG.get(name) ?? null (replaces Plan 38-01 literal)"
  - "NappletClass re-exported from @kehto/shell barrel (additive, non-breaking)"
  - "window.__setNappletClass__ hook in apps/demo/src/main.ts (D9 locked)"
  - "window.__clearAclEvents__ + window.__injectNubEnvelopeAsNapplet__ test hooks in main.ts"
  - "window.__aclEvents__ observability array wired via onAclCheck in shell-host.ts"
  - "docs/policies/SHELL-CLASS-POLICY.md — synced from napplet/napplet@27e16248 with kehto cross-refs (CLASS-05)"
  - "README.md Policies section referencing docs/policies/"
  - "tests/e2e/class-invariant.spec.ts — 8 parameterized tests, one per active NUB domain (CLASS-04, E2E-20)"
  - "Phase 38 close: 62 passed / 0 failed / 0 skipped (54 baseline + 8 new)"
affects: [39, hyprgate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReadonlyMap<string, NappletClass> for data-driven class assignment (D3)"
    - "Module-load assertion (block-scoped) for coverage invariant enforcement (D4, H-05)"
    - "__injectNubEnvelopeAsNapplet__ hook: dispatches real MessageEvent from iframe contentWindow — routes through relay.handleMessage -> enforceNub"
    - "window.__aclEvents__ observability array accumulated by onAclCheck callback"
    - "8-test parameterized spec via for...of over const ACTIVE_NUB_DOMAINS"

key-files:
  created:
    - "docs/policies/SHELL-CLASS-POLICY.md"
    - "tests/e2e/class-invariant.spec.ts"
  modified:
    - "packages/shell/src/index.ts"
    - "apps/demo/src/shell-host.ts"
    - "apps/demo/src/main.ts"
    - "README.md"
    - ".planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md"

key-decisions:
  - "D9 HONORED: __setNappletClass__ placed in apps/demo/src/main.ts (NOT shell-host.ts)"
  - "__injectNubEnvelopeAsNapplet__ added to bypass theme-switcher SDK gap (no SDK theme.publish; window.parent.postMessage path bypasses enforceNub)"
  - "Upstream SHELL-CLASS-POLICY.md found at napplet/napplet@27e16248 specs/SHELL-CLASS-POLICY.md; synced with kehto header (not a stub)"
  - "onAclCheck extended to match by dTag for NIP-5D napplets (pubkey='') in addition to pubkey for legacy napplets"

patterns-established:
  - "CLASS_BY_DTAG pattern: data-driven ReadonlyMap + module-load assertion is the coverage invariant for per-napplet config"
  - "__injectNubEnvelopeAsNapplet__: bridge for demo napplets that use host-side bypass paths (window.parent.postMessage) rather than SDK NUB APIs"
  - "window.__aclEvents__ + window.__clearAclEvents__: standard observability pair for ACL enforcement E2E specs"

requirements-completed: [CLASS-04, CLASS-05, E2E-20]

# Metrics
duration: 35min
completed: 2026-04-24
---

# Phase 38 Plan 03: Demo Integration + Policy Doc + Cross-NUB Invariant Spec Summary

**CLASS_BY_DTAG data-driven map + D4 module-load assertion + __setNappletClass__ test hook in main.ts + SHELL-CLASS-POLICY.md synced from napplet/napplet@27e16248 + 8-test parameterized class-invariant.spec.ts: 62 passed / 0 failed / 0 skipped**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-24T13:00:41Z
- **Completed:** 2026-04-24T13:36:00Z
- **Tasks:** 3
- **Files modified/created:** 7

## Accomplishments

- Added `NappletClass` re-export to `packages/shell/src/index.ts` (additive, non-breaking)
- Added `CLASS_BY_DTAG: ReadonlyMap<string, NappletClass>` adjacent to `DEMO_NAPPLETS` in `apps/demo/src/shell-host.ts` — all 10 entries null per D2
- Added module-load assertion (block-scoped) in `shell-host.ts` — throws `[CLASS-04 / H-05]` at import time if any DEMO_NAPPLETS entry is missing from CLASS_BY_DTAG; breaks `pnpm build` before drift reaches runtime
- Updated `registerSessionEntry` to read `class: CLASS_BY_DTAG.get(name) ?? null` (replaces Plan 38-01's literal `class: null`)
- Added `findAuthenticatedNappletWindowIdByDTag(dTag)` helper exported from `shell-host.ts`
- Added `window.__setNappletClass__` test hook in `apps/demo/src/main.ts` per D9 (NOT shell-host.ts); mutates session entry class in-place via `relay.runtime.sessionRegistry`
- Added `window.__clearAclEvents__` reset helper and `window.__injectNubEnvelopeAsNapplet__` envelope injection hook in `apps/demo/src/main.ts`
- Extended `onAclCheck` callback in `shell-host.ts` to push events to `window.__aclEvents__` (NIP-5D path: matched by dTag not pubkey); also fixed `onAclCheck` lookup to match NIP-5D napplets by dTag (pubkey='') as well as legacy napplets by pubkey
- Synced `docs/policies/SHELL-CLASS-POLICY.md` from `napplet/napplet@27e16248` `specs/SHELL-CLASS-POLICY.md` with kehto header noting deviation (class inline in shell.init vs async class.assigned) and full file:line cross-references
- Added `## Policies` section to `README.md` with link to `docs/policies/SHELL-CLASS-POLICY.md`
- Authored `tests/e2e/class-invariant.spec.ts` with 8 parameterized tests (one per active NUB domain) using `test.beforeEach` D12 reset and `__injectNubEnvelopeAsNapplet__` to exercise the enforceNub gate
- Ran canonical phase-close iteration loop: clean + install + build + test:e2e → **62 passed / 0 failed / 0 skipped**
- Appended Plan 38-03 close entry to `38-ITERATION-LOG.md`

## Task Commits

1. **Task 1** — `d91edbf` (feat(38-03): add CLASS_BY_DTAG + __setNappletClass__ test hook in main.ts (CLASS-04, D9))
2. **Task 2** — `626f680` (docs(38-03): add SHELL-CLASS-POLICY.md with kehto cross-references (CLASS-05))
3. **Task 3** — committed in final phase-close commit

## Files Created/Modified

- `packages/shell/src/index.ts` — added `export type { NappletClass }` from provisional-class
- `apps/demo/src/shell-host.ts` — NappletClass import; CLASS_BY_DTAG map; module-load assertion; findAuthenticatedNappletWindowIdByDTag; registerSessionEntry CLASS_BY_DTAG lookup; onAclCheck extended with __aclEvents__ push + NIP-5D dTag matching
- `apps/demo/src/main.ts` — NappletClass import; findAuthenticatedNappletWindowIdByDTag import; __setNappletClass__; __clearAclEvents__; __injectNubEnvelopeAsNapplet__
- `docs/policies/SHELL-CLASS-POLICY.md` — new; synced from upstream with kehto header
- `tests/e2e/class-invariant.spec.ts` — new; 8 parameterized class-invariant tests
- `README.md` — Policies section added
- `.planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md` — Plan 38-03 block appended

## Decisions Made

- Used `window.parent.postMessage` bypass identification to add `__injectNubEnvelopeAsNapplet__` hook: theme-switcher dispatches theme via `window.parent.postMessage({ type: 'demo.publishTheme' })`, which the host catches and calls `relay.publishTheme()` — this bypasses `enforceNub`. The spec needed a way to inject a real NUB envelope (relay.publish) on behalf of theme-switcher's iframe contentWindow so it routes through `relay.handleMessage -> enforceNub` and produces a measurable `class-forbidden` AclCheckEvent
- Fixed `onAclCheck` NIP-5D identity lookup: the existing callback matched only by pubkey, but NIP-5D napplets have `pubkey=''`. Extended the loop to also match by dTag (event.identity.dTag) when pubkey is empty — necessary for the class-forbidden event to be associated with the correct napplet and pushed to `window.__aclEvents__`
- Upstream SHELL-CLASS-POLICY.md found at `napplet/napplet@27e16248` — not a stub; kehto deviation note added to header documenting the class-in-shell.init vs async class.assigned approach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] onAclCheck NIP-5D identity lookup was pubkey-only**
- **Found during:** Task 3 (E2E spec development — `__aclEvents__` was not receiving class-forbidden events)
- **Issue:** The `createDemoHooks().onAclCheck` callback matched napplets by `info.pubkey === event.identity.pubkey`. For NIP-5D napplets (theme-switcher), pubkey is `''` — so the match never fired, `pushAclEvent` was never called, and `window.__aclEvents__` received the event via the new push code but the event had no dTag match to resolve nappletName. The root issue: for NIP-5D, the identity is keyed on dTag, not pubkey. The publish call to `window.__aclEvents__` was still getting the event, but testing revealed the `onAclCheck` also needed to properly identify the napplet for correct audit association.
- **Fix:** Extended the napplet lookup loop in `onAclCheck` to also match by `info.dTag === event.identity.dTag` when `event.identity.pubkey` is empty (NIP-5D path). This correctly associates theme-switcher's class-forbidden events with the theme-switcher napplet.
- **Files modified:** `apps/demo/src/shell-host.ts`

**2. [Rule 2 - Missing Critical] __injectNubEnvelopeAsNapplet__ hook needed for E2E observability**
- **Found during:** Task 3 (spec design — theme-switcher's SDK gap means no relay.publish NUB path exists via normal button click)
- **Issue:** The plan's spec design assumed the dark button click would trigger a `relay:write` NUB path through `enforceNub`. In reality, theme-switcher sends `window.parent.postMessage({ type: 'demo.publishTheme' })` which is caught by the host's message listener and calls `relay.publishTheme()` — a host-side operation that bypasses the runtime's `handleMessage` and `enforceNub` entirely.
- **Fix:** Added `__injectNubEnvelopeAsNapplet__` hook to `apps/demo/src/main.ts` that dispatches a real `MessageEvent` from the napplet iframe's `contentWindow`, routing it through `relay.handleMessage -> enforceNub` with the correct session entry. The spec uses this to inject a `relay.publish` envelope on behalf of theme-switcher.
- **Files modified:** `apps/demo/src/main.ts`

## Verification Grid

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "export type { NappletClass }" packages/shell/src/index.ts` | 1 | 1 | PASS |
| `grep -c "CLASS_BY_DTAG" apps/demo/src/shell-host.ts` | >= 4 | 8 | PASS |
| `grep -c "CLASS_BY_DTAG.get(name)" apps/demo/src/shell-host.ts` | 1 | 1 | PASS |
| `grep -c "CLASS-04 / H-05" apps/demo/src/shell-host.ts` | >= 1 | 1 | PASS |
| `grep -c "__setNappletClass__" apps/demo/src/main.ts` | >= 2 | 8 | PASS |
| `grep -cE "__setNappletClass__[[:space:]]*=" apps/demo/src/shell-host.ts` | 0 (D9 guard) | 0 | PASS |
| `test -f docs/policies/SHELL-CLASS-POLICY.md` | exists | exists | PASS |
| `grep -c "Upstream commit SHA:" docs/policies/SHELL-CLASS-POLICY.md` | 1 | 1 | PASS |
| `grep -c "packages/runtime/src/enforce.ts" docs/policies/SHELL-CLASS-POLICY.md` | >= 2 | 2 | PASS |
| `grep -c "## Policies" README.md` | 1 | 1 | PASS |
| `test -f tests/e2e/class-invariant.spec.ts` | exists | exists | PASS |
| `grep -c "class-forbidden" tests/e2e/class-invariant.spec.ts` | >= 1 | 8 | PASS |
| `grep -c "ACTIVE_NUB_DOMAINS" tests/e2e/class-invariant.spec.ts` | >= 2 | 2 | PASS |
| `grep -c "__aclEvents__" apps/demo/src/shell-host.ts` | >= 1 | 1 | PASS |
| `pnpm build` | 0 (24/24 tasks) | 0 (24/24 tasks) | PASS |
| Canonical iteration loop E2E result | 62 passed / 0 failed / 0 skipped | **62 passed (20.6s)** | PASS |
| Anti-term sweep (napplet sources) | clean | clean | PASS |
| C-01 check: class.assigned in executable code | 0 hits | 0 hits (3 doc-comments only) | PASS |

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## Phase 38 Close Status

Phase 38 (NUB-CLASS Adoption) is COMPLETE:
- Plans 38-01, 38-02, 38-03 all committed
- Requirements CLASS-01 through CLASS-06 and E2E-20 all completed
- 62 passed / 0 failed / 0 skipped confirmed by canonical iteration loop
- C-01 and C-02 anti-feature invariants both hold
- Phase 39 (NUB-CONNECT + NUB-CONFIG) is unblocked

---
*Phase: 38-nub-class-adoption*
*Completed: 2026-04-24*
