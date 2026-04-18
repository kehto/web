---
phase: 19-core-domain-napplets
verified: 2026-04-17T00:00:00Z
status: passed
score: 6/6 must-haves verified
gaps: []
---

# Phase 19: Core-Domain Napplets Verification Report

**Phase Goal:** `composer`, `preferences`, and `toaster` napplets are live in the demo, each exercising one core NUB domain end-to-end; their Playwright specs are green and the capability-matrix specs confirm ACL enforcement on relay-write and storage-write.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3 napplet directories exist with full skeletons (package.json, vite.config.ts, tsconfig.json, index.html, src/main.ts) | VERIFIED | `apps/demo/napplets/{composer,preferences,toaster}/` each contain all 5 required files |
| 2 | Each napplet builds successfully — dist/index.html with napplet-aggregate-hash meta present | VERIFIED | composer/dist has `index-CIPzb-cY.js`; preferences/dist has `index-Yhhysc2I.js`; toaster/dist has `index-BP_Uvuu4.js`; all dist/index.html carry `<meta name="napplet-aggregate-hash" content="">` (empty = expected per Phase 18 decision when VITE_DEV_PRIVKEY_HEX unset) |
| 3 | Anti-term grep clean across the 3 new src directories (toaster has exactly 1 documented addEventListener('message') exemption) | VERIFIED | Composer + preferences: zero live-code anti-term matches. Toaster: `window.addEventListener('message')` count = 1 (Plan 19-03 SDK-gap exemption, documented in JSDoc); zero matches for BusKind, kind===29001/29002, window.nostr, signer-service, NIP-01 arrays |
| 4 | `DEMO_NAPPLETS[]` in shell-host.ts includes composer, preferences, toaster | VERIFIED | Lines 138–156 of `apps/demo/src/shell-host.ts` register all three entries with correct name/label/statusId/aclId/frameContainerId fields |
| 5 | 6 new spec files exist and are substantive | VERIFIED | relay-publish.spec.ts (118 lines), relay-publish-encrypted.spec.ts (73 lines), storage-persist.spec.ts (85 lines), notify-lifecycle.spec.ts (84 lines), acl-revoke-relay-write.spec.ts (108 lines), acl-revoke-storage-write.spec.ts (84 lines) — all under `tests/e2e/` |
| 6 | `19-ITERATION-LOG.md` documents iteration loop and final 27/27 pass across 3 consecutive runs | VERIFIED | Log records 3 iterations; Iteration 3 closes with 27/27 across 3 consecutive stable runs after clean turbo cache rebuild; Phase Close Gate checklist fully marked |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/demo/napplets/composer/package.json` | @kehto/demo-composer workspace definition | VERIFIED | name = "@kehto/demo-composer" |
| `apps/demo/napplets/composer/vite.config.ts` | Vite build with nip5aManifest | VERIFIED | `nip5aManifest({ nappletType: 'demo-composer' })` present |
| `apps/demo/napplets/composer/tsconfig.json` | TypeScript strict config | VERIFIED | strict=true, ES2022, moduleResolution=bundler |
| `apps/demo/napplets/composer/index.html` | Full HTML with composer DOM contract | VERIFIED | #composer-status, #composer-input, #composer-encrypted-toggle, #composer-recipient, #composer-publish-btn, #composer-log all present |
| `apps/demo/napplets/composer/src/main.ts` | relay.publish + relay.publishEncrypted via @napplet/sdk | VERIFIED | Imports `relay` from `@napplet/sdk`, `import '@napplet/shim'`; handles both publish and publishEncrypted paths; #composer-status transitions documented |
| `apps/demo/napplets/preferences/package.json` | @kehto/demo-preferences workspace definition | VERIFIED | name = "@kehto/demo-preferences" |
| `apps/demo/napplets/preferences/vite.config.ts` | Vite build with nip5aManifest | VERIFIED | `nip5aManifest({ nappletType: 'demo-preferences' })` present |
| `apps/demo/napplets/preferences/index.html` | Full HTML with preferences DOM contract | VERIFIED | #preferences-status, #pref-display-name, #pref-theme-preference, #preferences-save-btn present |
| `apps/demo/napplets/preferences/src/main.ts` | storage.setItem/getItem via @napplet/sdk | VERIFIED | Imports `storage` from `@napplet/sdk`, `import '@napplet/shim'`; loads on mount, saves on btn click |
| `apps/demo/napplets/toaster/package.json` | @kehto/demo-toaster workspace definition | VERIFIED | name = "@kehto/demo-toaster" |
| `apps/demo/napplets/toaster/vite.config.ts` | Vite build with nip5aManifest | VERIFIED | `nip5aManifest({ nappletType: 'demo-toaster' })` present |
| `apps/demo/napplets/toaster/index.html` | Full HTML with toaster DOM contract | VERIFIED | #toaster-status, #toaster-title, #toaster-body, #toaster-notify-btn, #toaster-dismiss-all-btn, #toaster-list present |
| `apps/demo/napplets/toaster/src/main.ts` | notify lifecycle (Plan 19-03 SDK gap: 1 raw message listener) | VERIFIED | Exactly 1 `window.addEventListener('message')` as documented SDK-gap exemption; JSDoc explains deviation |
| `apps/demo/src/shell-host.ts` | DEMO_NAPPLETS includes all 3 new entries | VERIFIED | Entries for composer, preferences, toaster at lines 138–156 |
| `tests/e2e/relay-publish.spec.ts` | NAP-03 E2E-07 spec | VERIFIED | 118 lines; asserts #composer-status reaches 'authenticated' then 'published:' or 'denied:'; anti-term console assertions present |
| `tests/e2e/relay-publish-encrypted.spec.ts` | NAP-03 E2E-07 spec (encrypted path) | VERIFIED | 73 lines; covers publishEncrypted path |
| `tests/e2e/storage-persist.spec.ts` | NAP-04 E2E-07 spec | VERIFIED | 85 lines; asserts storage.setItem values survive page.reload() |
| `tests/e2e/notify-lifecycle.spec.ts` | NAP-05 E2E-07 spec | VERIFIED | 84 lines; asserts notify.create/list/dismiss lifecycle; debugger envelope assertion |
| `tests/e2e/acl-revoke-relay-write.spec.ts` | E2E-08 capability-matrix spec | VERIFIED | 108 lines; two-phase: publish succeeds before revoke, 'denied:' after relay-write toggle off |
| `tests/e2e/acl-revoke-storage-write.spec.ts` | E2E-08 capability-matrix spec | VERIFIED | 84 lines; two-phase: save succeeds before revoke, 'denied:' after state-write toggle off |
| `.planning/phases/19-core-domain-napplets/19-ITERATION-LOG.md` | Iteration loop record with 27/27 final pass | VERIFIED | 3 iterations documented; Iteration 3 shows 27/27 x3 consecutive stable runs; Phase Close Gate checklist complete |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| composer/src/main.ts | @napplet/sdk relay namespace | `import { relay } from '@napplet/sdk'` | WIRED | Import present in source; relay.publish + relay.publishEncrypted called in publish handler |
| composer/src/main.ts | @napplet/shim | `import '@napplet/shim'` | WIRED | Side-effect import present (auto-AUTH path) |
| preferences/src/main.ts | @napplet/sdk storage namespace | `import { storage } from '@napplet/sdk'` | WIRED | Import present; storage.getItem on mount, storage.setItem on save |
| preferences/src/main.ts | @napplet/shim | `import '@napplet/shim'` | WIRED | Side-effect import present |
| toaster/src/main.ts | notification-service (raw postMessage) | `window.parent.postMessage` + `window.addEventListener('message')` | WIRED | Plan 19-03 SDK-gap exemption; exactly 1 message listener; dual-registration of notification-service under 'notify' name (Plan 19-04) routes envelopes |
| shell-host.ts DEMO_NAPPLETS | composer/preferences/toaster frame containers | `frameContainerId` fields match demo HTML IDs | WIRED | All 3 entries registered with correct DOM IDs |
| composer/dist/assets/index-CIPzb-cY.js | relay.publish.error handler | Iteration 3 fix: both result + error message types handled | WIRED | Bundle contains 2 occurrences of `relay.publish.error` (confirmed via grep); stale turbo cache cleared to preserve fix |
| acl-revoke-relay-write.spec.ts | composer napplet | `frameLocator + #composer-status 'denied:'` | WIRED | Spec asserts 'denied:' prefix in composer status after relay-write ACL revoke |
| acl-revoke-storage-write.spec.ts | preferences napplet | `frameLocator + #preferences-status 'denied:'` | WIRED | Spec asserts 'denied:' after state-write ACL revoke |

---

### Data-Flow Trace (Level 4)

Not applicable as primary phase artifacts are napplet frontends and Playwright specs, not server-side data pipelines. The napplets consume live protocol responses from the runtime (verified working end-to-end by the Playwright suite results documented in the iteration log).

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable server in this verification context — behavioral verification was performed by the Playwright iteration loop documented in 19-ITERATION-LOG.md; 27/27 passing across 3 consecutive stable runs constitutes the behavioral gate per E2E-11).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NAP-03 | 19-01-PLAN.md | composer napplet exercises relay.publish + relay.publishEncrypted; UI shows OK/denied status | SATISFIED | composer/src/main.ts implements both paths; relay-publish + relay-publish-encrypted specs green (Iteration Log) |
| NAP-04 | 19-02-PLAN.md | preferences napplet exercises storage.setItem/getItem; state survives page reload | SATISFIED | preferences/src/main.ts implements load-on-mount + save; storage-persist.spec.ts green |
| NAP-05 | 19-03-PLAN.md | toaster napplet exercises notify.create/list/read/dismiss; host toast layer and napplet UI both update | SATISFIED | toaster/src/main.ts implements full lifecycle; notify-lifecycle.spec.ts green |
| E2E-07 (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle) | 19-05-PLAN.md, 19-06-PLAN.md | Layer-B domain specs green against real demo build | SATISFIED | All 4 specs exist with substantive assertions; 27/27 suite pass documented in iteration log. Note: REQUIREMENTS.md status table row (line 139) still reads "Pending" — stale update; checkbox at line 66 is [x] and iteration log confirms completion. |
| E2E-08 (acl-revoke-relay-write, acl-revoke-storage-write) | 19-06-PLAN.md | Layer-B capability-matrix specs green | SATISFIED | Both specs exist with two-phase ACL revoke assertions; 27/27 suite pass documented |
| E2E-11 | 19-07-PLAN.md | Phase closes with recorded build→run→Playwright→fix iteration loop | SATISFIED | 19-ITERATION-LOG.md documents 3 full iterations; Iteration 3 final gate: 27/27 x3 consecutive stable runs |

**Minor finding:** REQUIREMENTS.md status table line 139 shows `E2E-07 (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle) | Phase 19 | Pending` but the [x] checkbox at line 66 and the iteration log both confirm completion. This is a stale documentation row, not an implementation gap. It does not affect phase goal achievement.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/demo/napplets/toaster/src/main.ts` | `window.addEventListener('message')` | INFO | Intentional — Plan 19-03 SDK-gap exemption; `@napplet/sdk` does not expose notify.create/list/read (confirmed in plan); documented in JSDoc; exactly 1 listener |
| `apps/demo/napplets/composer/dist/assets/index-CIPzb-cY.js` | Stale turbo cache risk (pre-Iteration-3) | INFO | Mitigated — Iteration 3 cleared turbo cache; fresh rebuild captured in turbo cache; current dist bundle is the post-fix version with 2 occurrences of `relay.publish.error` |

No blocker anti-patterns found.

---

### Human Verification Required

None required for automated acceptance. The following are noted as optional confirmations:

1. **Live demo rendering at :4174**
   Test: `pnpm preview` then visit http://localhost:4174 and confirm 5 napplet topology cards render (bot, chat, composer, preferences, toaster).
   Expected: 5 cards visible; composer shows "connecting..." → "authenticated" after shim AUTH; preferences loads saved values; toaster shows notify controls.
   Why human: Requires running preview server; visual confirmation not automatable in this context.

---

### Gaps Summary

No gaps. All 6 must-haves are fully verified:

1. All 3 napplet directories exist with complete, non-placeholder skeletons (5 files each).
2. Build artifacts (dist/) are present for all 3 napplets with correct content-hashed bundles.
3. Anti-term grep is clean: composer and preferences have zero matches; toaster has exactly 1 allowed `addEventListener('message')` per documented SDK-gap exemption.
4. `DEMO_NAPPLETS[]` in shell-host.ts registers composer, preferences, and toaster.
5. All 6 spec files exist and are substantive (73–118 lines each with real assertions).
6. `19-ITERATION-LOG.md` documents the complete iteration loop and 27/27 stable final pass.

The only non-critical finding is a stale "Pending" row in the REQUIREMENTS.md status table for E2E-07 Phase 19 subset — the checkbox and iteration log both confirm completion.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
