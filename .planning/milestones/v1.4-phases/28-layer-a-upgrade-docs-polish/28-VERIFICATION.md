---
phase: 28-layer-a-upgrade-docs-polish
verified: 2026-04-19T18:50:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 28: Layer-A Upgrade & Docs Polish Verification Report

**Phase Goal:** Now that `keys` and `media` have real backends, the previously stub-scope Layer-A specs are upgraded to full protocol-correctness coverage; `@kehto/services` and `apps/demo` READMEs document the new APIs, host-bridge interfaces, and the 10-napplet end-to-end showcase.
**Verified:** 2026-04-19T18:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | E2E-14: nub-keys.spec.ts + nub-media.spec.ts have no STUB SCOPE NOTICE; both use `__registerService__('name', 'real')`; skip-marker count = 0 | VERIFIED | `grep -c "STUB SCOPE NOTICE"` returns 0 for both files; `__registerService__('keys', 'real')` present in nub-keys.spec.ts:56 and `__registerService__('media', 'real')` in nub-media.spec.ts:61; skip-marker grep returns 0 matches |
| 2 | E2E-14 real backend assertions: keys.registerAction.result + keys.action push via synthetic keydown; media.session.create.result + navigator.mediaSession mirror after session.create and session.update | VERIFIED | nub-keys.spec.ts contains `keys.registerAction.result` (5 occurrences), `keys.action` (8 occurrences), `new KeyboardEvent` (2 occurrences); nub-media.spec.ts contains `media.session.create.result` (5 occurrences), `navigator.mediaSession` (15 occurrences), `media.session.update` (4 occurrences) |
| 3 | DOCS-05: packages/services/README.md has `## Keys Service` + `## Media Service` H2 sections with HostKeysBridge + HostMediaBridge verbatim interface blocks, runnable snippets, demo cross-refs, stale '(stub in v1.3)' language removed | VERIFIED | Both H2 sections present (count=1 each); `export interface HostKeysBridge` + `export interface HostMediaBridge` present; `subscribe(chord: string, callback` present; `setMetadata(sessionId: string, metadata: MediaMetadata)` present; `When to plug a custom bridge` count=2; demo cross-refs present; stale language count=0 |
| 4 | DOCS-06: apps/demo/README.md exists with 7-section skeleton, 10-napplet inventory, v1.3→v1.4 history line, STUB_ONLY_SERVICES=[], host-hook catalog | VERIFIED | File exists; H1 `@kehto/demo` count=1; 6 H2 sections present (Run, Napplet Inventory, Service Topology, ACL Surface, Host Hooks, License); 10 inventory rows confirmed; `10-napplet end-to-end showcase` present; `STUB_ONLY_SERVICES` present; `__grantKeysForward__` + `__grantMediaControl__` each present; both spec cross-refs present |
| 5 | Iteration loop + anti-term hygiene: 28-ITERATION-LOG.md records 49/0/0 (no-delta); anti-term real violations = 0; raw-postMessage grep on new napplets = 0 | VERIFIED | ITERATION-LOG.md exists; `49 passed` appears 4 times; `Matches: 0` appears 2 times; 27 raw anti-term grep matches all confirmed as documented false-positive classes (JSDoc/comments/local-var over-match); raw-postMessage count = 0; skip-marker audit = 0 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/e2e/harness/harness.ts` | Extended `__registerService__` with 'real' factory-key branch; `createKeysService` import | VERIFIED | Import line 19 present; `handlerScript === 'real'` branch at line ~449; `createKeysService()` + `createMediaService()` calls in branch; existing `new Function` eval path preserved with `eslint-disable-next-line no-new-func` comment |
| `tests/e2e/nub-keys.spec.ts` | Rewritten real-backend spec; no STUB SCOPE NOTICE; 'real' factory-key | VERIFIED | File fully rewritten; no STUB SCOPE NOTICE; E2E-14 cited in docblock; all assertions present |
| `tests/e2e/nub-media.spec.ts` | Rewritten real-backend spec; no STUB SCOPE NOTICE; 'real' factory-key | VERIFIED | File fully rewritten; no STUB SCOPE NOTICE; E2E-14 cited in docblock; all assertions present |
| `packages/services/README.md` | Two new H2 sections with interface blocks, usage examples, demo cross-refs | VERIFIED | 326 lines; both H2 sections inserted between Quick Start and Public API; all acceptance criteria met |
| `apps/demo/README.md` | New file; 7-section skeleton; 10-napplet inventory | VERIFIED | File created from scratch; all 7 sections present; 10 inventory rows confirmed |
| `.planning/phases/28-layer-a-upgrade-docs-polish/28-ITERATION-LOG.md` | Fresh-build 49/0/0 evidence; anti-term sweep; milestone-gate docs | VERIFIED | File exists; all required sections present; no unfilled template tokens (CI Verification section left with post-push placeholder, which is expected behavior per Phase 26/27 precedent) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tests/e2e/harness/harness.ts` | `@kehto/services (createKeysService, createMediaService)` | Static ESM import line 19; 'real' branch instantiation | VERIFIED | `from '@kehto/services'` count=1; `createKeysService()` and `createMediaService()` each instantiated in branch |
| `tests/e2e/nub-keys.spec.ts` | real keys-service document listener | `page.evaluate(() => document.dispatchEvent(new KeyboardEvent(...)))` → keys.action push envelope | VERIFIED | `new KeyboardEvent` present; `keys.action` waitForFunction + assertion present |
| `tests/e2e/nub-media.spec.ts` | real media-service navigator.mediaSession mirror | `media.session.create` → `bridge.setMetadata` → `navigator.mediaSession.metadata.title` | VERIFIED | `expect.poll` on `navigator.mediaSession?.metadata?.title` present twice; both 'Layer-A Real Track' and 'Updated Layer-A Track' titles asserted |
| `packages/services/README.md (## Keys Service)` | `packages/services/src/keys-service.ts (HostKeysBridge)` | Verbatim typescript code-fence block | VERIFIED | `export interface HostKeysBridge` present with `subscribe(chord: string, callback` member |
| `packages/services/README.md (## Media Service)` | `packages/services/src/media-service.ts (HostMediaBridge)` | Verbatim typescript code-fence block | VERIFIED | `export interface HostMediaBridge` present with `setMetadata(sessionId: string, metadata: MediaMetadata)` member |
| `packages/services/README.md` | `apps/demo/napplets/hotkey-chord/src/main.ts` + `apps/demo/napplets/media-controller/src/main.ts` | 'See the demo:' prose cross-ref in each H2 | VERIFIED | Both demo paths present in README |

### Data-Flow Trace (Level 4)

Not applicable — Phase 28 artifacts are spec files and documentation. No dynamic data rendering to trace.

### Behavioral Spot-Checks

The iteration log records a full Playwright run. The critical behavioral checks are verified by that recorded output.

| Behavior | Evidence | Status |
|----------|----------|--------|
| nub-keys.spec.ts passes: keys.registerAction.result envelope received + keys.action push on synthetic keydown | ITERATION-LOG.md line 116: `✓ 33 [chromium] tests/e2e/nub-keys.spec.ts:39:1 nub-keys: keys.registerAction + synthetic keydown drives real keys-service keys.action push (391ms)` | PASS |
| nub-media.spec.ts passes: media.session.create.result + navigator.mediaSession.metadata.title mirror | ITERATION-LOG.md line 118: `✓ 35 [chromium] tests/e2e/nub-media.spec.ts:44:1 nub-media: media.session.create/update drives real media-service navigator.mediaSession mirror (502ms)` | PASS |
| Full suite: 49 passed / 0 failed / 0 skipped | ITERATION-LOG.md: `49 passed (20.1s)` | PASS |
| Both upgraded specs in isolation | ITERATION-LOG.md Upgraded-Spec Evidence: `2 passed (2.8s)` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| E2E-14 | 28-01 | Existing Layer-A stub-scope specs `nub-keys.spec.ts` + `nub-media.spec.ts` upgraded from stub-scope to full protocol-correctness coverage; `test.describe.skip` markers removed | SATISFIED | Both specs rewritten with real-backend assertions; STUB SCOPE NOTICE removed; skip-marker audit = 0 |
| DOCS-05 | 28-02 | `packages/services/README.md` extended with `keys` + `media` sections documenting new public APIs, host-bridge interfaces, and usage examples | SATISFIED | Two H2 sections present; verbatim interface blocks; runnable examples; demo cross-refs; stale language removed |
| DOCS-06 | 28-03 | `apps/demo/README.md` updated to list `hotkey-chord` + `media-controller` in demo napplet inventory; narrative updated to reflect 10-napplet showcase | SATISFIED | New file created; 10-row inventory; v1.3→v1.4 history line; STUB_ONLY_SERVICES=[]; host-hook catalog |

All three Phase 28 requirement IDs satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| 28-ITERATION-LOG.md — CI Verification section | `{To be recorded after push}` placeholder remains | Info | Expected — post-push section filled after CI completes per Phase 26/27 precedent; not a pre-push gap |

No blockers or warnings found. The CI Verification placeholder is structural — the same pattern exists in 26-ITERATION-LOG.md and 27-ITERATION-LOG.md and is filled after the push step, not before.

### Anti-Term Hygiene

The 27 raw matches from the full v1.4-surface grep are all documented false-positive classes in 28-ITERATION-LOG.md:

- **Class 1 (JSDoc/comments):** 9 matches — JSDoc `@example` blocks using `signer.signEvent` as a message-type string literal in documentation; comments explaining deleted features (BusKind, signer-service); compliance declarations ("No `window.nostr`...").
- **Class 2 (`signer.sign` over-match):** 3 matches — `signer.signEvent(...)` method call on a local NIP-46 signer client variable in `apps/demo/src/main.ts`; unit tests in `packages/acl/src/resolve.test.ts` asserting `signer.signEvent → null` (testing absence, not presence).
- **Class 3 (spec comment references):** 15 matches — spec file docblocks and comments mentioning the anti-term patterns to explain what ANTI_TERM_RE asserts against (not the ANTI_TERM_RE constant declaration itself — those are filtered by `grep -v 'ANTI_TERM_RE'`).

Zero real violations. Raw-postMessage grep on new napplets = 0. All confirmed by direct grep inspection.

### Human Verification Required

No items require human verification. All must-haves are programmatically verifiable and confirmed by:
- Direct file reads
- Grep assertion counts
- Git log commit verification
- Recorded Playwright output in ITERATION-LOG.md

### Gaps Summary

No gaps. All 5 observable truths verified, all 6 artifacts confirmed substantive and wired, all 3 requirement IDs satisfied, no blocker anti-patterns, iteration loop records 49/0/0 green on first run.

---

_Verified: 2026-04-19T18:50:00Z_
_Verifier: Claude (gsd-verifier)_
