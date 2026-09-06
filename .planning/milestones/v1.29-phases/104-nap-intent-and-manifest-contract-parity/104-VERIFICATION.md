---
phase: 104-nap-intent-and-manifest-contract-parity
verified: 2026-07-26T15:25:08Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "Malformed, numbered, query/fragment-bearing, mismatched, missing, or unsafe contract metadata fails closed at parse and build-authoring boundaries."
  gaps_remaining: []
  regressions: []
---

# Phase 104: NAP-INTENT and Manifest Contract Parity Verification Report

**Phase Goal:** Kehto resolves authoritative convention URIs through installed verified manifest contracts, accepts source-independent delivery responsibility, and sends runtime-attested carrier-neutral delivery only after target readiness.
**Verified:** 2026-07-26T15:25:08Z
**Status:** passed
**Re-verification:** Yes — after gap closure

## Re-verification Result

The prior ARCH-04 blocker is closed by commit `563c747`. I independently
inspected the exact source and regression test rather than relying on the Plan
104-06 summary:

- `apps/playground/napplets/shared-vite-config.ts:79,85` validates the raw slug
  and convention strings; the pre-validation `.trim()` calls are gone.
- The strict slug regex rejects padded slugs, and the strict queryless convention
  regex rejects padded conventions.
- `tests/unit/playground-gateway-guard.test.ts:114-139` now executes all four
  leading/trailing slug/convention whitespace vectors while retaining a positive
  exact/repeated-contract case.

The repaired authoring boundary now agrees with `parseNappletManifest` and the
exact `napplet/naps@a718915ddefa2f03a0126579601f59d8bd86f7c4`
`NAP-INTENT.md` queryless convention contract. No input normalization changes
the metadata that is later signed into the manifest.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The injected API derives canonical request fields from one shared URI normalizer, rejects invalid/conflicting calls before transport, buffers parent-only delivery FIFO, and survives namespace replacement. | ✓ VERIFIED | `napplet-namespace.ts` shares `normalizeConventionUri`, constructs the canonical request, filters parent messages, and caches/protects the intent binding; binding regressions passed. |
| 2 | Canonical public, resolver, runtime, and carrier objects have exact convention shapes with no legacy protocol/lifecycle/identifier/caller-sender fields. | ✓ VERIFIED | `intent-types.ts`, `intent-service.ts` exact-key validation, public exports, and active-source/type guards passed. |
| 3 | Verified-manifest tags retain one exact queryless contract per tag, including independent ordered scoped kinds; indexes are derived rather than authoritative. | ✓ VERIFIED | `nip/src/5d/index.ts` parses ordered tags and `manifest-intent-catalog.ts` retains contracts while deriving indexes; parser/catalog tests passed. |
| 4 | Malformed contract metadata fails closed in parser and playground build authoring. | ✓ VERIFIED | Raw (untrimmed) values now flow directly to strict regex validation; four whitespace-padding regressions execute and reject. Numbered, query/fragment, mismatch, and unsafe-kind vectors remain covered. |
| 5 | The profile fixture and signed-manifest recomputation use `napplet:profile/open`, not numbered NAP metadata. | ✓ VERIFIED | Profile Vite config, recomputation, and gateway output assertions pass. |
| 6 | Resolver selection uses exact compatible installed contracts, user defaults/chooser policy, and authorized explicit dTags; ambiguity never falls back to catalog order. | ✓ VERIFIED | Resolver exact-contract and policy matrix passed. |
| 7 | Acceptance is produced only after a source-independent immutable delivery is retained, with no public window, protocol, handled, or carrier state. | ✓ VERIFIED | Resolver awaits opaque retention before returning accepted result; retained-task tests passed. |
| 8 | Runtime validates every normalized field, attests sender from the live session, sends one result before task start, and emits no second result on terminal task failure. | ✓ VERIFIED | Runtime/service ordering, attestation, denial, and terminal-failure tests passed. |
| 9 | Ready target delivery survives source destruction, targets only the selected handler, contains authenticated source dTag and canonical carrier fields, and exposes no INC envelope. | ✓ VERIFIED | Real-runtime manifest integration test covers delayed readiness, source teardown, target-only carrier, and no INC traffic. |
| 10 | Current eligible loaded sessions receive discovery changes without needing prior intent requests; destroyed/ineligible recipients do not. | ✓ VERIFIED | Runtime context and service broadcast tests cover live enumeration, ACL/domain gates, and cleanup. |
| 11 | Ready/reused, delayed target, replacement/retry, and terminal-policy seams remain private rather than becoming public contract fields. | ✓ VERIFIED | Focused lifecycle policy matrix covers ready, deferred, retry/replacement, and terminal cases. |
| 12 | Transitional Paja/playground consumers and package docs describe the exact Phase 104 contract without presenting the Phase 105 persistent host flow as complete. | ✓ VERIFIED | Playground build and affected package type checks pass; active-source guards preserve the documented Phase 105 boundary. |
| 13 | Active surfaces reject obsolete numbered/protocol/lifecycle intent vocabulary. | ✓ VERIFIED | NIP-5D and active-intent static guards pass; no Phase 104 debt-marker or placeholder stub was found. |

**Score:** 13/13 truths verified (0 present but behavior-unverified)

### Required Artifacts and Key Links

All declared Phase 104 artifacts pass existence/substance/wiring review. The
automated key-link verifier reports 17/17 links across Plans 01–05, and Plan
104-06 reports 2/2 artifacts plus its test-to-authoring link verified. The
critical data path remains:

`parseNappletManifest` → `manifestToIntentCatalogEntry` →
`createCatalogIntentResolver` → `createIntentService` → runtime-attested
session context → retained controller → target-only `intent.deliver`.

At the repaired build boundary, raw authoring input → strict validation →
recomputed signed manifest now has no normalization hop capable of changing a
malformed identity into an accepted one.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Complete Phase 104 focused contract/lifecycle matrix | `pnpm exec vitest run` on 12 Phase-104 files | 309 tests passed | ✓ PASS |
| Exact raw authoring validation and signed repeat-contract output | Included in `tests/unit/playground-gateway-guard.test.ts` | 15 tests passed in focused file; all four padding vectors reject | ✓ PASS |
| Playground production build | `pnpm --filter @kehto/playground build` | passed | ✓ PASS |
| Affected package type checks | `pnpm --filter @kehto/{nip,runtime,services,shell,paja} type-check` | all passed | ✓ PASS |
| Patch integrity | `git diff --check` | exit 0 | ✓ PASS |

The playground build issued only existing Vite chunking/dynamic-import warnings;
it completed successfully and introduced no Phase 104 functional failure.

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| BASE-01 | ✓ SATISFIED | Exact public model and active-source guard reject numbered/protocol vocabulary. |
| BASE-02 | ✓ SATISFIED | Binding, parser, adapter, and resolver use queryless convention identity. |
| INTENT-01 | ✓ SATISFIED | Protected URI-authoritative `invoke`/`open` binding and rejection matrix. |
| INTENT-02 | ✓ SATISFIED | Runtime validates normalized request identity before resolution. |
| INTENT-03 | ✓ SATISFIED | Exact canonical types, exports, and negative shape coverage. |
| INTENT-04 | ✓ SATISFIED | Manifest contracts remain distinct and feed catalog candidates. |
| INTENT-05 | ✓ SATISFIED | Exact convention matching; no action/payload/kind inference. |
| INTENT-06 | ✓ SATISFIED | Default, chooser, and authorized explicit target policy are fail-closed. |
| INTENT-07 | ✓ SATISFIED | Acceptance-only structured result, including policy denial shape. |
| INTENT-08 | ✓ SATISFIED | Retain-before-result/task start and source-independent ready delivery. |
| INTENT-09 | ✓ SATISFIED | Runtime-attested sender, target-only no-ID carrier, no INC envelope. |
| INTENT-10 | ✓ SATISFIED | Parent-only FIFO buffer and private lifecycle-policy seams. |
| INTENT-11 | ✓ SATISFIED | Loaded eligible-client notifications without request history. |
| ARCH-01 | ✓ SATISFIED | One ordered queryless contract/tag with local unsigned event-kind scope. |
| ARCH-02 | ✓ SATISFIED | Derived indexes only; no NAAT/payload/default invention. |
| ARCH-04 | ✓ SATISFIED | Parser and build authoring both reject malformed metadata, including raw whitespace padding. |

No Phase 104 requirement is orphaned. No deferred item is needed: Phase 105
still owns published-package adoption and persistent live host flows, which do
not reduce this phase's verified contract/runtimes scope.

### Anti-Patterns Found

No blocking debt markers (`TBD`, `FIXME`, `XXX`), placeholder implementations,
hard-coded empty user-facing data paths, or regressions were found in the
Phase 104 surface during re-verification.

## Gaps Summary

No gaps remain. The prior signed-metadata validation failure is closed and all
phase must-haves, artifacts, links, behavioral checks, and 16 requirement IDs
are verified at current HEAD.

---

_Verified: 2026-07-26T15:25:08Z_
_Verifier: gsd-verifier_
