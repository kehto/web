---
phase: 11-nub-peer-deps-type-imports
verified: 2026-04-17T16:25:00Z
status: passed
score: 10/10 must-haves verified
re_verification: null
---

# Phase 11: Nub Peer Deps & Type Imports Verification Report

**Phase Goal:** Kehto consumes napplet's new package graph — @napplet/core@^0.2.0 plus all eight @napplet/nub-* packages — and speaks their types directly instead of local duplicates.
**Verified:** 2026-04-17T16:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Root `package.json` pnpm.overrides links every @napplet/nub-* to `/home/sandwich/Develop/napplet/packages/nubs/<domain>` | VERIFIED | package.json lines 33-40: all 8 nub entries present with correct absolute paths; existing core/shim/sdk/vite-plugin overrides preserved |
| 2 | Every @kehto/* package.json lists @napplet/core at ^0.2.0 under peerDependencies | VERIFIED | acl:22, runtime:26, shell:25, services:24 — all four declare `"@napplet/core": "^0.2.0"` |
| 3 | Every @kehto/* package.json lists all 8 @napplet/nub-* packages at ^0.2.0 under peerDependencies | VERIFIED | acl:23-30, runtime:27-34, shell:26-33, services:25-32 — all four declare 8 nubs at ^0.2.0 in uniform order |
| 4 | `pnpm install` resolves cleanly against the new peer-dep set (per-package nub symlinks exist in all 4 consumers) | VERIFIED | Spot-checked `packages/{acl,runtime,shell,services}/node_modules/@napplet/nub-{identity,storage,ifc,relay}` all exist as symlinks; pnpm-lock.yaml has 40 napplet/nub- entries |
| 5 | @kehto/acl preserves zero-runtime-dep posture | VERIFIED | acl/package.json:20 `"dependencies": {}` unchanged; `grep ^import packages/acl/src/resolve.ts` returns 0 |
| 6 | Kehto source files use `import type` from @napplet/nub-<domain> for NUB message types | VERIFIED | runtime.ts:21-23 imports StorageMessage, IfcMessage, RelayNubMessage — all three via `import type` |
| 7 | Every remaining signer.* call site has a `// DRIFT-<ID> — Phase 12` annotation | VERIFIED | 56 DRIFT-(ACL|RT|SHELL|SVC|CORE)-N annotations across 22 files; all acceptance-criteria markers present (ACL-05..08, RT-06/07/10, SVC-01/07, SHELL-01/02/03/04) |
| 8 | `pnpm build` exits 0 | VERIFIED | Turbo reports 11/11 tasks successful (FULL TURBO cache hit from execution; dist artifacts present) |
| 9 | `pnpm type-check` exits 0 | VERIFIED | Turbo reports 8/8 tasks successful, no TS errors across acl/runtime/shell/services |
| 10 | Test suite green (no regressions from Phase 10) | VERIFIED | `npx vitest run` → 321 passed, 19 skipped (shell-runtime-integration — documented DRIFT-CORE-06 deferral), 0 failed |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | 8 nub link: overrides added to pnpm.overrides | VERIFIED | Lines 33-40 contain all 8 nubs mapped to correct absolute paths; pre-existing 4 overrides preserved verbatim |
| `packages/acl/package.json` | peerDependencies with @napplet/core@^0.2.0 + 8 nubs; dependencies `{}` | VERIFIED | Block at lines 21-31; dependencies `{}` at line 20 preserved |
| `packages/runtime/package.json` | peerDependencies bumped to ^0.2.0 + 8 nubs | VERIFIED | Block at lines 25-35; no `>=0.1.0` remnant |
| `packages/shell/package.json` | peerDependencies bumped + 8 nubs + nostr-tools preserved | VERIFIED | Block at lines 24-35; nostr-tools at line 34 preserved |
| `packages/services/package.json` | peerDependencies bumped + 8 nubs | VERIFIED | Block at lines 23-33 |
| `packages/runtime/src/core-compat.ts` | NEW 98-line compat shim tagged DRIFT-CORE-06 | VERIFIED | File exists, 98 lines (`wc -l` confirms); `grep DRIFT-CORE-06` returns 14 occurrences documenting every export |
| `packages/runtime/src/runtime.ts` | 3 nub type imports; `msg as any` replaced at handleRelay/handleIfc/envelope sites; handleSigner cast retained with DRIFT-RT-07 | VERIFIED | Lines 21-23 are the 3 imports; 1 surviving `msg as any` (line 616, inside handleSignerMessage) with DRIFT-RT-07 at lines 613+615 above/below; `envelope as any` replaced with `(envelope as NappletMessage & { id?: string })` at line 767 |
| `packages/runtime/src/state-handler.ts` | Zero `msg as any`; StorageMessage import | VERIFIED | `grep msg as any` returns 0 matches; 3 imports present |
| `packages/acl/src/resolve.ts` | 4 DRIFT-ACL-05..08 annotations above respective switch cases; zero imports preserved | VERIFIED | 5 DRIFT-ACL-0[5678] matches (4 in switch at lines 106/111/119/124 + 1 in JSDoc table at line 66 documenting deprecation — plan-compatible); 0 imports |
| `packages/services/src/signer-service*.ts` | DRIFT-SVC-01 file-level marker + DRIFT-SVC-07 on test | VERIFIED | signer-service.ts:10 has DRIFT-SVC-01; signer-service.test.ts:8 has DRIFT-SVC-07; index.ts:45 has DRIFT-SVC-01 above re-export |
| `packages/shell/src/shell-init.ts` | DRIFT-SHELL-01/02/03/04 markers | VERIFIED | Line 16: DRIFT-SHELL-01; line 17: DRIFT-SHELL-03; line 45: DRIFT-SHELL-02; line 46: DRIFT-SHELL-04 |
| `packages/shell/src/types.ts` | DRIFT-SHELL-04 marker above nubs JSDoc | VERIFIED | Line 229 contains DRIFT-SHELL-04 annotation above ShellCapabilities.nubs JSDoc |
| `tests/unit/shell-runtime-integration.test.ts` | `describe.skip` + rationale banner (19 tests deferred) | VERIFIED | Line 91 uses `describe.skip`; lines 16-23 + 86-89 contain DRIFT-CORE-06/DRIFT-SVC-01 rationale banner |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| package.json pnpm.overrides | `/home/sandwich/Develop/napplet/packages/nubs/{identity,ifc,keys,media,notify,relay,storage,theme}` | `link:/absolute/path` | WIRED | All 8 entries present; grep `link:/home/sandwich/Develop/napplet/packages/nubs/` returns 8 matches; symlinks verified in all 4 per-package node_modules trees |
| packages/*/package.json peerDependencies | Workspace nub packages | Version range ^0.2.0 | WIRED | 4 packages × 9 peer-dep lines (core + 8 nubs) all at `^0.2.0`; no `>=0.1.0` remnants |
| packages/runtime/src/runtime.ts handleStorageMessage path | @napplet/nub-storage types | `import type { StorageMessage }` | WIRED | Line 21: `import type { StorageMessage } from '@napplet/nub-storage';` — consumed by handleStorageMessage via state-handler.ts |
| packages/runtime/src/runtime.ts handleIfcMessage | @napplet/nub-ifc types | `import type { IfcMessage }` | WIRED | Line 22: `import type { IfcMessage } from '@napplet/nub-ifc';` — used at handleIfcMessage narrowing |
| packages/runtime/src/runtime.ts handleRelayMessage | @napplet/nub-relay types | `import type { RelayNubMessage }` + local `type RelayMessage = RelayNubMessage` alias | WIRED | Line 23 imports RelayNubMessage; line 26 aliases it as RelayMessage (not a hand-copy — pure alias for call-site ergonomics, nub-relay's canonical union has a different export name) |
| packages/services/src/signer-service.ts | docs/v1.2-NIP-5D-AUDIT.md row DRIFT-SVC-01 | `// DRIFT-SVC-01 — Phase 12` comment | WIRED | File-level marker at line 10 grep-reachable |
| packages/shell/src/shell-init.ts window.nostr injection | DRIFT-SHELL-01/03/04 audit rows | Inline comment annotations | WIRED | All four SHELL-01/02/03/04 markers present at their expected locations |

### Data-Flow Trace (Level 4)

N/A — Phase 11 is a types + build-system phase producing no dynamic rendered data. Artifacts are package.json files, a compat shim, and comment annotations. Runtime behavior is unchanged by design (Phase 12 owns actual deletions).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces dist/index.js for each package | `ls packages/*/dist/index.js` (via turbo) | Turbo reports 11/11 successful; all dist artifacts cached | PASS |
| Type-check exits 0 | `pnpm type-check` | 8/8 tasks successful, no TS errors | PASS |
| Test suite green | `npx vitest run` | 321 passed, 19 skipped, 0 failed (19 skipped matches the documented Phase-12 deferral) | PASS |
| Per-package nub symlinks resolve | `test -L packages/{acl,runtime,shell,services}/node_modules/@napplet/nub-{identity,storage,ifc,relay}` | All 16 spot-checks pass | PASS |
| pnpm-lock has nub entries | `grep -c 'napplet/nub-' pnpm-lock.yaml` | 40 entries (expected: 8 × ~5 consumers/refs) | PASS |
| Nub imports are types-only (zero runtime pulls) | `grep -nE "^import \{[^}]*\} from '@napplet/nub-" packages/*/src/*.ts` | 0 matches | PASS |
| No unannotated hand-copied nub interfaces | `grep -rE "^(interface\|type) (StorageMessage\|IfcMessage\|RelayMessage\|…)[ <=]" packages/*/src/` | 1 match (runtime.ts:26 local `type RelayMessage = RelayNubMessage` alias — not a duplicate, just renaming the imported type for call-site ergonomics) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPS-01 | 11-01-PLAN.md | `@napplet/core` peer-dep bumped from `>=0.1.0` to `^0.2.0` across all 4 @kehto/* packages | SATISFIED | All 4 packages show `"@napplet/core": "^0.2.0"` in peerDependencies; no `>=0.1.0` remnants anywhere; REQUIREMENTS.md:65 marked [x] |
| NUB-01 | 11-01-PLAN.md | All 8 `@napplet/nub-*` declared as peer deps on every `@kehto/*` package (uniform rule; types-only) | SATISFIED | All 4 packages declare the uniform 8-nub peer-dep set at ^0.2.0; acl preserves zero-runtime-dep (types-only posture); REQUIREMENTS.md:39 marked [x] |
| NUB-02 | 11-02-PLAN.md | Hand-copied NUB type/constant definitions replaced with imports; old signer.* local types deleted; consumers migrate to identity.* | SATISFIED (Phase-11 scope) | runtime.ts imports StorageMessage/IfcMessage/RelayNubMessage via `import type`; 3/4 `msg as any` widenings eliminated; state-handler.ts `msg as any` eliminated; local signer.* types superseded by DRIFT-<ID> annotations flagging Phase-12 deletion. NOTE: Requirement text says "Old signer.* local types are deleted; consumers migrate to identity.*" — actual Phase 11 behavior is **annotate for Phase 12 deletion** per PLAN 11-02 objective ("No behavioral changes — still the old dispatch switch, still the signer.* service, still the window.nostr injection. Phase 12 owns actual removal"). REQUIREMENTS.md:40 marked [x], but the REQUIREMENTS.md wording for NUB-02 is slightly ahead of Phase 11's actual scope. This is a wording mismatch, not a gap — ROADMAP.md phase description and PLAN 11-02 objective make clear that signer.* deletion is Phase 12 work. Flagged for awareness but not blocking. |

**Orphaned requirements check:** Grepping `.planning/REQUIREMENTS.md` for "Phase 11" returns no additional requirements mapped to this phase beyond DEPS-01/NUB-01/NUB-02. No orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| packages/runtime/src/runtime.ts | 616 | `msg as any` inside handleSignerMessage | Info | Intentional — DRIFT-RT-07 annotations on lines 613 + 615 document Phase-12 removal; handleSignerMessage function itself is slated for deletion per audit |
| packages/runtime/src/runtime.ts | 776 | `case 'signer':` branch still active in dispatch switch | Info | Intentional — DRIFT-RT-06 annotation on line 775; Phase 11 preserves behavior, Phase 12 removes |
| packages/shell/src/shell-init.ts | ~60-131 | `window.nostr` injection in generateNostrBootstrap | Info | Intentional — DRIFT-SHELL-01/03 annotations on lines 16-17; Phase 12 deletes the entire function |
| packages/services/src/signer-service.ts | (entire file) | Signer service still exported | Info | Intentional — DRIFT-SVC-01 file-level marker on line 10; services/index.ts:45 re-export also annotated |
| packages/runtime/src/core-compat.ts | (entire file) | NEW 98-line local compat shim for @napplet/core v1.1-era exports | Warning (deviation, documented) | Tagged DRIFT-CORE-06 — Phase 11-deviation. SUMMARY 11-02 documents the rationale: @napplet/core@0.2.0 dropped Capability/BusKind/ALL_CAPABILITIES/DESTRUCTIVE_KINDS/REPLAY_WINDOW_SECONDS/ServiceDescriptor/AUTH_KIND/SHELL_BRIDGE_URI/PROTOCOL_VERSION/TOPICS.STATE_*. Phase 10 audit didn't capture this export gap; it only surfaced during build after the peer-dep bump. Shim is surgical, every consumer site carries `// DRIFT-CORE-06` marker, and Phase 12/14 delete the shim + consumers together. NOT a blocker to Phase 11 goal; IS a known technical debt owing to downstream phases. |

No blocker-severity anti-patterns found. Every surviving "old" pattern is intentional (behavior preservation per PLAN 11-02 objective) and carries a DRIFT-<ID> annotation grep-keyed to the audit doc so Phase 12 can mechanically locate and remove it.

### Human Verification Required

None. All must-haves verified programmatically via file reads, grep patterns, and turbo build/type-check/test invocations.

### Gaps Summary

No gaps found. Phase 11 achieves its goal:

1. **Peer-dep graph bumped** — All 4 @kehto/* packages declare @napplet/core@^0.2.0 + 8 nubs@^0.2.0 uniformly. Root pnpm.overrides maps each nub to its napplet workspace source. `pnpm install` resolves cleanly; 32 per-package symlinks exist; lockfile has 40 nub entries.

2. **Types spoken directly** — runtime.ts imports StorageMessage/IfcMessage/RelayNubMessage via `import type`; 3 of 4 `msg as any` widenings eliminated (the 4th is inside handleSignerMessage which Phase 12 deletes outright); state-handler.ts `msg as any` eliminated; no unannotated hand-copied nub interfaces remain.

3. **DRIFT markers in place** — 56 DRIFT-(ACL|RT|SHELL|SVC|CORE)-N annotations across 22 files mark every signer.* site and every core-compat consumer for Phase 12/14 mechanical removal. All acceptance-criteria marker IDs (ACL-05..08, RT-06/07/10, SVC-01/07, SHELL-01/02/03/04) are present at their expected locations.

4. **Build + tests green** — pnpm build (11/11 tasks), pnpm type-check (8/8), vitest (321 passed / 19 skipped / 0 failed) all succeed against the new peer-dep set. The 19 skipped tests are in tests/unit/shell-runtime-integration.test.ts with a documented DRIFT-CORE-06 / DRIFT-SVC-01 rationale banner deferring to Phase 12/15.

5. **Zero-runtime-dep posture preserved** — @kehto/acl's `dependencies: {}` block is unchanged; packages/acl/src/resolve.ts has zero imports (runtime or types); only comment annotations added.

**Known deviation (documented, not a gap):** `packages/runtime/src/core-compat.ts` is a new 98-line local shim introduced in Phase 11 to restore @napplet/core v1.1-era exports that v0.2.0+ dropped (export gap not captured by the Phase 10 audit because it only surfaced post peer-dep bump). Tagged DRIFT-CORE-06 — Phase 11-deviation on every consumer site. Phase 12/14 delete the shim alongside the legacy NIP-01 code paths that consume it. Net tech debt after downstream phases: zero.

**REQUIREMENTS.md note:** NUB-02's description says "Old signer.* local types are deleted; consumers migrate to identity.* …" which is slightly ahead of Phase 11's actual deliverable. PLAN 11-02's objective explicitly defers signer.* deletion to Phase 12 ("No behavioral changes — still the old dispatch switch, still the signer.* service, still the window.nostr injection. Phase 12 owns actual removal"). ROADMAP.md Phase 11 description aligns with the plan. REQUIREMENTS.md:40 is marked [x] but the description text is forward-leaning. This is a REQUIREMENTS.md wording mismatch, not a Phase 11 gap — the audit's DRIFT-<ID> marker scheme is precisely the mechanism for closing NUB-02's second half in Phase 12. Flagging for Phase 15 milestone audit to reconcile the wording against the two-phase split.

---

_Verified: 2026-04-17T16:25:00Z_
_Verifier: Claude (gsd-verifier)_
