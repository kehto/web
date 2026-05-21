---
phase: 44-upstream-consumption-validator-parity
verified_at: 2026-05-21
status: passed
score: 9/9
---

# Phase 44 — Upstream Consumption + Validator Parity — Verification

## Goal Restatement
Consume `@napplet/nub@^0.3.0` + `@napplet/core@^0.3.0` across all 4 `@kehto/*` packages, retire the SEED-001 `pnpm.overrides` workaround, reclassify the three `provisional-*.ts` files away from "pending upstream publish" framing (audit revealed upstream and kehto model different concepts), record the canonical origin-validator decision.

## Per-Criterion Verdicts (9 REQ-IDs)

### DEP-01: `@napplet/nub` peer dep ^0.2.1 → ^0.3.0 across 4 packages
**Verdict:** PASS
**Evidence:** `grep '@napplet/nub' packages/{acl,runtime,shell,services}/package.json` returns `^0.3.0` in every peerDependencies block.

### DEP-02: `@napplet/core` peer dep ^0.2.x → ^0.3.0
**Verdict:** PASS
**Evidence:** same grep returns `^0.3.0`.

### DEP-03: pnpm.overrides retired
**Verdict:** PASS
**Evidence:** Root `package.json` no longer contains `pnpm.overrides` block; `pnpm install` resolves cleanly; lockfile no longer references `@napplet/nub>@napplet/core` override.

### DEP-04/-05/-06: Provisional files reclassified
**Verdict:** PASS
**Evidence:** `ls packages/shell/src/types/` shows `internal-{class,connect,resource}.ts` only (no `provisional-*`). Each file header rewritten with PROJECT.md Decision #31 pointer. `grep -rn 'types/provisional-' packages/ apps/` returns 0 matches outside dist/ artifacts.

### DEP-07: 4 minor-bump changesets staged
**Verdict:** PASS
**Evidence:** `ls .changeset/v1-8-dep-*.md` returns 4 files (acl, runtime, shell, services).

### VALIDATOR-01: kehto local validator audit
**Verdict:** PASS
**Evidence:** `grep -rn normalizeConnectOrigin packages/ apps/` returns 0 matches (verified during execution).

### VALIDATOR-02: Canonical decision recorded
**Verdict:** PASS
**Evidence:** PROJECT.md Key Decisions table contains Decision #32 (committed at scope-adjustment time).

## Iteration loop spot-check
- `pnpm install` → exit 0, no warnings beyond pre-existing oxc-parser peer-dep notice.
- `pnpm build` → 26/26 turbo tasks successful.
- `pnpm test:unit` → 523/523 passed.
- `pnpm test:e2e` → 73/0/0 passed.
- Type-check passes across all `@kehto/*` packages.

## Anti-pattern check
- **Scope discipline:** Surfaced THREE upstream-driven scope surprises (class/connect concept divergence, resource API divergence, SDK namespace removal). Each surfaced to the user; scope adjusted via PROJECT.md Decisions #31 + #32 and a new tech-debt entry (SDK migration deferred to v1.9 / SDK-MIGRATE-01). No silent scope creep.
- **Hard-rename safety:** All 3 file renames preserve git blame via `git mv`. Only one file (provisional-class.ts) showed as add/delete instead of rename because its content rewrite was >50%.
- **Test baseline:** 73/0/0 + 523/523 preserved exactly. No regressions from the dep swap.

## Final Verdict
**VERIFICATION PASSED** (9/9). Phase 44 ready to close. 15/27 v1.8 requirements complete. Phase 45 (NIP-44 Decrypt Runtime + Shell MUSTs) is the next phase.
