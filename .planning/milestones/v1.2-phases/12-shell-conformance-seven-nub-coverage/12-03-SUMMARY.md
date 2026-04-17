---
phase: 12-shell-conformance-seven-nub-coverage
plan: 03
subsystem: api
tags: [nip-5d, nub, identity, signer-deletion, service-registry, typescript, vitest]

# Dependency graph
requires:
  - phase: 11-nub-peer-deps-and-type-imports
    provides: "@napplet/nub-identity peer-dep + types-only imports"
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: "Wave 1 (12-01) shell-conformance baseline"
provides:
  - "identity-service.ts — NIP-5D identity NUB reference handler for 9 request types"
  - "handleIdentityMessage runtime dispatch with host-service + fallback paths"
  - "signer domain removal — signer-service.ts/.test.ts deleted; handleSignerMessage + case 'signer' deleted"
  - "@kehto/services barrel: createIdentityService / IdentityServiceOptions (replaces createSignerService / SignerServiceOptions)"
affects: [12-10, 12-11, 13, 14, 15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service handler contract: migration JSDoc header listing v1.1 -> v1.2 signer -> identity/relay mapping (identity-service.ts pattern for future nub migrations)"
    - "Runtime handler contract: `handle<Domain>Message` delegates to serviceRegistry['<domain>'] when registered, falls back to a minimal in-runtime handler that emits spec-correct result envelopes for every action"

key-files:
  created:
    - packages/services/src/identity-service.ts
    - packages/services/src/identity-service.test.ts
  modified:
    - packages/services/src/index.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/core-compat.ts
    - packages/runtime/src/dispatch.test.ts
    - apps/demo/src/shell-host.ts
  deleted:
    - packages/services/src/signer-service.ts
    - packages/services/src/signer-service.test.ts

key-decisions:
  - "Delete signer domain entirely. getPublicKey/getRelays migrate to identity.*; signEvent/nip04/nip44 have no napplet-visible home (shell-mediated signing routes through relay.publish / relay.publishEncrypted in later plans)."
  - "handleIdentityMessage ships with a fallback path so hosts without a registered 'identity' service still receive spec-correct result envelopes for all 9 actions — signer fallback for getPublicKey/getRelays, default/empty payloads for the other 7."
  - "ACL denial test in identity-service.test.ts asserts envelope shape only (TODO(12-10)) — the real resolveCapabilitiesNub identity branch is Plan 12-10's deliverable."

patterns-established:
  - "Per-nub service factory + co-located `.test.ts` with one test per request action + one unknown-action + one envelope-shape ACL assertion. Established in this plan; followed by 12-05 (keys), 12-06 (media), 12-07 (notify)."
  - "Migration-note JSDoc header in replacement service: documents which legacy API surface mapped to the new one, which legacy actions were deleted outright, and where to find the shell-internal equivalent. Referenced from REQUIREMENTS.md DEPS-03 rollup."

requirements-completed: [NUB-03]

# Metrics
duration: 9min
completed: 2026-04-17
---

# Phase 12 Plan 03: Identity NUB Dispatch + Identity Service Summary

**NIP-5D identity nub: 9-action service handler + runtime dispatch wired; signer domain (service, test, runtime handler, dispatch case) hard-deleted.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-17T18:58:33Z
- **Completed:** 2026-04-17T19:07:30Z
- **Tasks:** 2 (both TDD)
- **Files created:** 2
- **Files modified:** 5
- **Files deleted:** 2 (already staged for deletion by parallel executor)

## Accomplishments

- All 9 `identity.*` request types from `@napplet/nub-identity` (`getPublicKey`, `getRelays`, `getProfile`, `getFollows`, `getList`, `getZaps`, `getMutes`, `getBlocked`, `getBadges`) flow through `runtime.handleMessage` → `handleIdentityMessage` and produce spec-correct `.result` envelopes.
- `packages/services/src/identity-service.ts` (230 lines) ships with a NIP-07-signer-backed implementation for `getPublicKey`/`getRelays` plus stub payloads for the other 7 actions. Host apps can swap with `runtime.registerService('identity', realHandler)`.
- `packages/services/src/identity-service.test.ts` (305 lines) covers all 9 actions plus unknown-method and onWindowDestroyed edge cases (15 tests, 100% green).
- `runtime.ts`: `handleSignerMessage` (80+ lines) deleted; `handleIdentityMessage` (57 lines) added; dispatch switch `case 'signer'` → `case 'identity'`; `serviceRegistry['signer']` branch gone.
- Barrel (`packages/services/src/index.ts`): `createSignerService`/`SignerServiceOptions` exports removed; `createIdentityService`/`IdentityServiceOptions` exports added.
- 7 DRIFT markers closed/deleted (see Deviations).

## Task Commits

TDD flow produced multiple commits per task:

1. **Task 1 RED: failing identity-service tests** — `ba48aea` (test)
2. **Task 1 GREEN: identity-service implementation + barrel swap** — `6214f4d` (feat)
3. **Task 2 RED: migrate dispatch signer tests to identity domain** — `23e7eee` (test)
4. **Task 2 GREEN: handleIdentityMessage + dispatch wiring; delete signer** — `de93293` (feat)
5. **Task 2 inline fix: demo app migration (createSignerService → createIdentityService)** — `509328f` (fix, Rule 3)

**Signer file deletions:** `signer-service.ts` + `signer-service.test.ts` were removed from the tree by commit `ceed933` (12-07 executor landed simultaneously; both plans required the deletion and the earlier-landing commit took ownership). No separate 12-03 deletion commit.

**Plan metadata commit:** pending (final commit after SUMMARY + state updates).

## Files Created/Modified

### Created

- `packages/services/src/identity-service.ts` (230 lines) — `createIdentityService` factory; 9-action switch; migration-note JSDoc header documenting signer → identity/relay mapping.
- `packages/services/src/identity-service.test.ts` (305 lines) — 15 vitest cases covering all 9 request/result round-trips, unknown-action denial shape, ACL-denial envelope shape (TODO(12-10)), lifecycle hook.

### Modified

- `packages/services/src/index.ts` — swap `createSignerService`/`SignerServiceOptions` exports for `createIdentityService`/`IdentityServiceOptions`.
- `packages/runtime/src/runtime.ts` — delete `handleSignerMessage` (80+ lines) and `serviceRegistry['signer']` special-case; add `handleIdentityMessage` (57 lines) with serviceRegistry['identity'] + in-runtime fallback for all 9 actions; dispatch switch `case 'signer'` → `case 'identity'`.
- `packages/runtime/src/core-compat.ts` — tidy stale DRIFT-RT-06/07/10 JSDoc references (closed by this plan) while preserving the DRIFT-CORE-06 marker (still open, Phase 14 cleanup).
- `packages/runtime/src/dispatch.test.ts` — migrate `describe('signer handler')` block to `describe('identity handler')` with 5 identity tests (getPublicKey signer-backed, getRelays signer-backed, getProfile stub, getFollows stub, ACL-bypass); update routing test from `signer.*` to `identity.*`; update ACL-enforcement bypass test.
- `apps/demo/src/shell-host.ts` — swap `createSignerService` import for `createIdentityService`; register service under name `identity`; update `demoServiceNames` set.

### Deleted

- `packages/services/src/signer-service.ts` (222 lines)
- `packages/services/src/signer-service.test.ts` (363 lines)

## Decisions Made

- Identity-service `getProfile/getFollows/getList/getZaps/getMutes/getBlocked/getBadges` are stub-level — they return default/empty result payloads rather than error envelopes, so host apps can layer real nostr-query backends without napplets needing to distinguish "no backend" vs "empty result". Rationale matches the phase-level "stub-level handlers" decision in 12-CONTEXT.md.
- Runtime's `handleIdentityMessage` intentionally duplicates the stub behavior of `createIdentityService` in its fallback path. This is idempotent for NUB-03 acceptance (whichever path fires, the napplet receives the same envelope) and preserves host-app compatibility for deployments that rely on `hooks.auth.getSigner()` without explicitly registering an identity service.
- ACL denial test in identity-service.test.ts is envelope-shape-only with a `TODO(12-10)` marker. Per the phase plan, `resolveCapabilitiesNub` in `@kehto/acl` does not yet cover the identity branch — Plan 12-10 ships that, at which point the denial test can be upgraded to a runtime-level integration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Demo app `createSignerService` import broke build**

- **Found during:** Task 2 verification (`pnpm build`)
- **Issue:** `apps/demo/src/shell-host.ts:18` imported the deleted `createSignerService` from `@kehto/services`, breaking `@kehto/demo#build` with `"createSignerService" is not exported by "../../packages/services/dist/index.js"`. Plan acceptance criterion requires `pnpm build && pnpm type-check` to exit 0 workspace-wide.
- **Fix:** Swapped the import + factory call + service-name constant to `createIdentityService` / `identity`. Minimal 3-line change. Demo topology UI still references `'signer'` as a string literal in 4 other files — logged in `deferred-items.md` as a demo-UX follow-up (out of scope for NUB-03 contract; demo builds clean).
- **Files modified:** `apps/demo/src/shell-host.ts` (lines 18, 292-296, 424)
- **Verification:** `pnpm --filter @kehto/demo build` passes; `pnpm build` exits 0 with 11/11 tasks successful.
- **Committed in:** `509328f`

**2. [Rule 2 — Missing Critical] Core-compat JSDoc referenced closed DRIFT markers**

- **Found during:** Task 2 DRIFT-marker grep (acceptance criterion `grep -rE "DRIFT-RT-(01|06|07|10)|DRIFT-SVC-(01|02|07)"` must return zero).
- **Issue:** `packages/runtime/src/core-compat.ts` had three explanatory comments that referenced `DRIFT-RT-06..10` and `DRIFT-RT-07` in explanatory text. These were inside `DRIFT-CORE-06` notes (a separate marker that remains open for Phase 14), but the regex acceptance criterion matched on substring.
- **Fix:** Rewrote the three comments to reference the behavioral outcome (NIP-5D has no napplet-visible signing surface) rather than the legacy DRIFT IDs. DRIFT-CORE-06 marker preserved.
- **Files modified:** `packages/runtime/src/core-compat.ts`
- **Verification:** `grep -rE "DRIFT-RT-(01|06|07|10)|DRIFT-SVC-(01|02|07)" packages/runtime/src packages/services/src` returns zero matches.
- **Committed in:** `de93293` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes were required for acceptance criteria (workspace build green; DRIFT marker cleanup). No scope creep.

## DRIFT Markers Closed

All 7 markers listed in the plan:

| Marker | Source location before | Action |
|---|---|---|
| DRIFT-RT-01 | `packages/runtime/src/runtime.ts` dispatch switch (no `case 'identity'`) | Closed — `case 'identity': return handleIdentityMessage(...)` added at line ~842. (No source-code marker existed; audit doc references only.) |
| DRIFT-RT-06 | `packages/runtime/src/runtime.ts:775` — `case 'signer':` branch | Closed — branch deleted; marker comment removed. |
| DRIFT-RT-07 | `packages/runtime/src/runtime.ts:613-696` — `handleSignerMessage` function | Closed — function deleted; two in-function marker comments removed. |
| DRIFT-RT-10 | `packages/runtime/src/runtime.ts:630-637` — `serviceRegistry['signer']` branch | Closed — branch deleted; marker comment removed. |
| DRIFT-SVC-01 | `packages/services/src/signer-service.ts:10` | Closed — file deleted. |
| DRIFT-SVC-02 | `packages/services/src/` — no identity-service.ts | Closed — `identity-service.ts` created. |
| DRIFT-SVC-07 | `packages/services/src/signer-service.test.ts:8` | Closed — file deleted; getPublicKey/getRelays cases migrated to `identity-service.test.ts`. |

Stray DRIFT markers in `core-compat.ts` tidied during Task 2 (see Deviation 2).

## Issues Encountered

- **Parallel Wave 2 interleaving:** This plan ran concurrently with 12-05 (keys), 12-06 (media), and 12-07 (notify) — all four touch `packages/runtime/src/runtime.ts` and `packages/services/src/index.ts`. Encountered three re-read-before-edit cycles where another executor's commit landed between my reads and writes. Each case resolved by re-reading the file; no merge conflicts occurred because each executor appends to a different part of the switch + a different handler function.
- **Signer file deletion race:** Staged `git rm signer-service.*` during Task 2, but commit `ceed933` (12-07) landed with the same deletion first (that executor also needed it gone to satisfy its integration test). Net effect identical — signer files gone before 12-03's final Task 2 commit.

## Next Phase Readiness

- NUB-03 requirement satisfied: 9 identity.* request types produce spec-correct result envelopes end-to-end.
- Identity dispatch ready for ACL extension in Plan 12-10 (`resolveCapabilitiesNub` identity branch + `identity:read` capability constant).
- Identity dispatch ready for shell-side proxy in Plan 12-11 (`identity-proxy.ts` + barrel wiring).
- No signer-related code paths remain in source (packages/*); the v1.1 signer surface is fully dissolved into identity-service + shell-internal signing.

## Self-Check: PASSED

- FOUND: `packages/services/src/identity-service.ts`
- FOUND: `packages/services/src/identity-service.test.ts`
- MISSING: `packages/services/src/signer-service.ts` (intended — deleted)
- MISSING: `packages/services/src/signer-service.test.ts` (intended — deleted)
- FOUND: `ba48aea` (Task 1 RED commit)
- FOUND: `6214f4d` (Task 1 GREEN commit)
- FOUND: `23e7eee` (Task 2 RED commit)
- FOUND: `de93293` (Task 2 GREEN commit)
- FOUND: `509328f` (Task 2 demo-fix commit, Rule 3)

All DRIFT-RT-(01|06|07|10) + DRIFT-SVC-(01|02|07) markers zero in source.
Full workspace `pnpm build` exits 0 (11/11 tasks). Full `pnpm vitest run` exits 0 (371 pass, 19 skipped, 0 fail).

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*
