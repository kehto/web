---
phase: 12-shell-conformance-seven-nub-coverage
plan: 08
subsystem: runtime

tags: [napplet, nub-relay, publishEncrypted, nip-44, nip-04, shell-mediated-encryption, DRIFT-RT-08, DRIFT-SVC-08, NUB-08, SH-C03]

# Dependency graph
requires:
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: "Plan 12-01 removed window.nostr + signer.* message surface (SH-C01); Plan 12-03 migrated getPublicKey/getRelays to identity-service (DRIFT-RT-06/07/10)"
  - phase: 11-nub-peer-deps-type-imports
    provides: "@napplet/nub-relay peer-dep import including RelayPublishEncryptedMessage / RelayPublishEncryptedResultMessage shapes"
provides:
  - "handleRelayMessage `case 'publishEncrypted':` branch — encrypts via shell signer (nip44 default, nip04 opt-in), signs, publishes via relay service / hooks.relayPool, emits relay.publishEncrypted.result"
  - "relay-pool-service publishEncrypted fallback branch (canonical path bypasses it; service sees synthesized relay.publish from the runtime)"
  - "8 runtime.test.ts tests covering nip44/nip04 success, encryption default, missing recipient, missing signer, unsupported scheme, plaintext-never-leaves-handler, ACL denial"
affects: [12-10-acl-extension, phase-13-theme, phase-14-dispatch-refactor, phase-15-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell-mediated encryption: napplets hand an EventTemplate + recipient to the shell; shell signer primitives (nip44/nip04) are SHELL-INTERNAL — no napplet-visible message surface reaches them."
    - "Service delegation for canonical publish: publishEncrypted handler synthesizes a relay.publish envelope with the signed encrypted event, letting the existing relay/relay-pool service handle distribution."

key-files:
  created: []
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/runtime.test.ts
    - packages/services/src/relay-pool-service.ts

key-decisions:
  - "Synthesize a relay.publish envelope into the relay service rather than adding a dedicated publishEncrypted branch in relay-pool-service — keeps the service surface narrow and guarantees the ciphertext is treated identically to pre-signed plaintext publishes."
  - "Default encryption to 'nip44' when field omitted — matches the @napplet/nub-relay interface default and the v1.2 canonical DM path."
  - "Translate service-side relay.publish.result back to relay.publishEncrypted.result in the handler rather than teaching services about the encrypted variant — napplets get canonical nub-relay envelopes; services stay single-concept."
  - "Fallback branch in relay-pool-service for publishEncrypted (no-op delegate to publish) so alternate host wirings that bypass the runtime shim still work."

patterns-established:
  - "Async encrypt→sign→publish pipeline driven off the dispatch-tick via an IIFE so the handler remains sync from the switch's perspective."
  - "Denial precedence: recipient presence → encryption scheme validity → signer availability → event shape → encryption primitive → signEvent result — each gate emits `relay.publishEncrypted.result` with ok:false + descriptive error."

requirements-completed: [NUB-08, SH-C03]

# Metrics
duration: 10min
completed: 2026-04-17
---

# Phase 12 Plan 08: Relay publishEncrypted Shell-Mediated Path Summary

**relay.publishEncrypted now routes through the shell: encrypt via signer.nip44/.nip04 (internal), sign, publish via relay service or hooks.relayPool, emit relay.publishEncrypted.result; napplets never touch raw encryption primitives.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-17T21:11:58Z (approximate)
- **Completed:** 2026-04-17T21:22:46Z (approximate)
- **Tasks:** 2 (RED → GREEN)
- **Files modified:** 3

## Accomplishments

- `handleRelayMessage` gains a `case 'publishEncrypted':` branch between `publish` and `query` that fully realizes the NUB-08 shell-mediated encryption path.
- `relay.publishEncrypted.result` envelope now carries the canonical `{ id, ok, event?, eventId?, error? }` shape — ok:true for happy paths, ok:false with a descriptive `error` for each gate failure (missing recipient, unsupported scheme, no signer, signEvent returned null, encryption threw).
- 8 round-trip tests in `runtime.test.ts` covering all documented behaviors: nip44 success, nip44 default, nip04 explicit, missing recipient, missing signer, unsupported scheme, plaintext-never-exposed-to-subscribers, ACL-denial-without-plaintext-leak.
- `DRIFT-RT-08` marker deleted from `packages/runtime/src/runtime.ts`; the top-of-file nub import comment simplified to reflect Phase 12 completion of per-branch narrowing.
- `relay-pool-service.ts` handles `relay.publishEncrypted` as a fallback (delegates to `options.publish`), documented via JSDoc as non-canonical — the runtime's canonical path translates publishEncrypted into a synthesized `relay.publish` envelope so the service never sees the encrypted variant directly.
- Closes NUB-08 and the SH-C03 "shell mediates encryption via relay.publishEncrypted" half (the other half — signer surface deletion — landed in Plans 12-01 / 12-03).

## Task Commits

1. **Task 1: Write relay.publishEncrypted round-trip test (RED)** — `4d5918b` (test) — 269-line describe block appended to runtime.test.ts; 6/8 tests fail with "expected 0 to be greater than or equal to 1" (no result envelope emitted) — RED confirmed.
2. **Task 2: Add publishEncrypted branch in handleRelayMessage + relay-pool-service (GREEN)** — `4abdaeb` (feat) — 100-line branch inserted between `publish` and `query`; relay-pool-service gains a 14-line fallback branch + updated JSDoc; all 8 tests pass.

**Plan metadata commit:** pending (this file + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `packages/runtime/src/runtime.ts` — `handleRelayMessage` gains `case 'publishEncrypted':` (~100 lines); DRIFT-RT-08 marker deleted; top-of-file comment simplified.
- `packages/runtime/src/runtime.test.ts` — `describe('relay.publishEncrypted (NUB-08 / DRIFT-RT-08 / SH-C03)')` block appended (~270 lines) with stub signer; added `declare function setTimeout(...)` at file top to compile without the DOM lib.
- `packages/services/src/relay-pool-service.ts` — `handleMessage` gains `if (message.type === 'relay.publishEncrypted')` fallback branch (~10 lines) + top-of-file JSDoc note documenting that the runtime's canonical path synthesizes `relay.publish` so the service does not see the encrypted variant directly.

## Decisions Made

- **Synthesize relay.publish into the service, not a dedicated encrypted branch.** The runtime encrypts + signs, then hands the service a normal `relay.publish` envelope. Keeps the service's logic single-purpose and guarantees no accidental re-encryption paths.
- **Translate relay.publish.result back to relay.publishEncrypted.result in the handler.** Napplets receive the canonical nub-relay envelope; services stay oblivious to the encryption layer.
- **Default encryption = 'nip44'.** Matches @napplet/nub-relay's `RelayPublishEncryptedMessage.encryption?` optional field (default 'nip44' per interface JSDoc) and the v1.2 canonical DM path.
- **Happy-path test mocks `isAvailable:true` relay pool.** The default `createMockRuntimeAdapter()` ships `isAvailable:false`; the publishEncrypted describe block installs a minimal no-op pool with `isAvailable:true` so the publish branch (not the fallback "no relay pool available" branch) is exercised in tests. Documented in the test file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test scope missing setTimeout declaration**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `pnpm --filter @kehto/runtime type-check` reported `TS2304: Cannot find name 'setTimeout'` at 8 locations inside the publishEncrypted test block (used `await new Promise((r) => setTimeout(r, 0))` to flush microtasks between the handler and the assertion). The package-level tsconfig omits the DOM lib, matching the runtime.ts ESM-only stance.
- **Fix:** Added `declare function setTimeout(callback: (...args: unknown[]) => void, ms: number): unknown;` at the top of `runtime.test.ts`, mirroring the same declare in `runtime.ts`. Widened callback param to `(...args: unknown[]) => void` to accept Promise resolve (which carries a `value: unknown`) without a type error.
- **Files modified:** packages/runtime/src/runtime.test.ts
- **Verification:** `pnpm --filter @kehto/runtime type-check` passes; `pnpm exec vitest run` all 394 tests pass.
- **Committed in:** 4abdaeb (Task 2 commit)

**2. [Rule 3 - Blocking] Happy-path tests expected ok:true but got ok:false (mock has no relay pool)**
- **Found during:** Task 2 (GREEN verification, first run)
- **Issue:** 3 happy-path tests (nip44 success, encryption default, nip04) failed because `createMockRuntimeAdapter()` ships with `relayPool.isAvailable() → false`; the handler's "no relay pool available" branch returned `ok:false`.
- **Fix:** Added a minimal `createAvailableRelayPool()` helper in the publishEncrypted describe block that returns a `RelayPoolAdapter` with `isAvailable: () => true` and no-op `publish/subscribe/…`. The happy-path `beforeEach` and the "no signer" rebuild case both install this pool so the publish branch is actually exercised in tests.
- **Files modified:** packages/runtime/src/runtime.test.ts
- **Verification:** All 8 publishEncrypted tests pass; full suite remains 394 passing.
- **Committed in:** 4abdaeb (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking). Both directly caused by the current plan's test additions; neither represents scope creep.
**Impact on plan:** Plan executed as written; both fixes necessary to reach GREEN.

## Issues Encountered

- **Parallel-execution race on `runtime.test.ts`.** Plans 12-04 (ifc channels) and 12-08 (this plan) both modify the same file. The first Edit attempt lost its content after a misplaced `git stash push -- <path>` / `pop` cycle. Mitigation: re-applied the describe block after confirming 12-04's RED commit had landed, and committed Task 1 IMMEDIATELY before doing anything else. No content was permanently lost; 12-04's test additions + my publishEncrypted block co-exist cleanly in the final file.
- **`DRIFT-SVC-08` marker not present in source.** Grepping `packages/services/src/` returned zero matches before my changes. The marker was introduced only in planning/audit docs (`.planning/*`, `docs/v1.2-NIP-5D-AUDIT.md`) and never reached source files. No deletion action needed in source; the audit-doc marker will be closed in Plan 12-10's audit-closure task per the phase plan.
- **Mock auth adapter default returns `null` signer.** The happy-path tests needed an overridden `auth.getSigner()` to inject the stub signer. Standard `createMockRuntimeAdapter({ auth: {...} })` pattern used — no change to test-utils.ts.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **NUB-08 closed.** REQUIREMENTS.md checkbox flipped to `[x]`; traceability row gets its plan reference.
- **Plan 12-10 dependency ready:** the ACL-side split (`relay:write` vs `relay:write + sign:nip44` composite for publishEncrypted) can now hook into the existing handler without touching dispatch — the resolver just needs to return the composite cap for `relay.publishEncrypted`.
- **DRIFT-RT-08 fully closed** in source; audit doc closure is the verifier/10-02 checklist's responsibility.
- **SH-C03 fully satisfied.** The shell now mediates BOTH signing (via relay.publish) and encryption (via relay.publishEncrypted); no napplet-visible code path reaches raw signing keys or plaintext encryption primitives.

## Self-Check

- [x] `grep -n "DRIFT-RT-08" packages/runtime/src/runtime.ts` — zero matches (was 2 lines before)
- [x] `grep -rn "DRIFT-SVC-08" packages/services/src/` — zero matches (was zero matches before — never in source)
- [x] `grep -n "case 'publishEncrypted':" packages/runtime/src/runtime.ts` — exactly 1 match (line 611)
- [x] `grep -c "relay\\.publishEncrypted\\.result" packages/runtime/src/runtime.ts` — 2 matches (reply helper + inline comment)
- [x] `pnpm --filter @kehto/runtime build` — exit 0
- [x] `pnpm --filter @kehto/services build` — exit 0
- [x] `pnpm --filter @kehto/runtime type-check` — exit 0
- [x] `pnpm --filter @kehto/services type-check` — exit 0
- [x] `pnpm exec vitest run` — 394 passed, 19 skipped (0 failed)
- [x] Task 1 commit `4d5918b` exists (`git log | grep 4d5918b`)
- [x] Task 2 commit `4abdaeb` exists (`git log | grep 4abdaeb`)
- [x] `packages/runtime/src/runtime.ts` exists
- [x] `packages/runtime/src/runtime.test.ts` exists
- [x] `packages/services/src/relay-pool-service.ts` exists
- [x] Napplet-reachable path review: signer.* messages deleted in Plan 12-01 (`packages/shell/src/signer-proxy.ts` removed); no new API re-exposes `signer.nip04.*` / `signer.nip44.*` to napplets; encryption is strictly shell-internal inside `handleRelayMessage` publishEncrypted branch.

## Self-Check: PASSED

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*
