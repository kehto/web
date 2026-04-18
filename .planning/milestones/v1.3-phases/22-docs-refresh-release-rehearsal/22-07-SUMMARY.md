---
phase: 22-docs-refresh-release-rehearsal
plan: 7
subsystem: tests
tags: [e2e-10, legacy-spec-deletion, zero-skipped-gate, gap-closure]

# Dependency graph
requires:
  - phase: 21-fixture-napplets-layer-a-specs
    provides: Plan 21-01 legacy fixture deletion (auth-napplet/publish-napplet/pure-napplet removed) — enabled legacy spec deletion here
  - phase: 22-docs-refresh-release-rehearsal
    provides: Plan 22-06 iteration-log scaffolding (prior sections + idempotency convention)
provides:
  - 7 legacy spec files deleted via `git rm` from tests/e2e/
  - 22-ITERATION-LOG.md E2E-10 section (deleted-file table, coverage preservation audit, post-deletion test tail, CLOSED marker)
  - tests/fixtures/napplets/README.md updated (describes Phase 22-07 spec deletion per Phase 21-01 precedent)
  - REQUIREMENTS.md E2E-10 marked Complete
affects:
  - 22-08 (E2E-11 capstone iteration log now runs against the 0-skipped baseline established here)
  - ROADMAP Phase 22 Success Criterion 1 (zero skipped specs) verifiably satisfied

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legacy spec deletion over migration when underlying fixtures removed (Phase 21-01 cleanliness > backward compat precedent extended from fixtures to specs)"
    - "Coverage preservation audit: every deleted spec mapped to active v1.2 replacement before deletion"

key-files:
  deleted:
    - tests/e2e/acl-enforcement.spec.ts
    - tests/e2e/acl-lifecycle.spec.ts
    - tests/e2e/acl-matrix-relay.spec.ts
    - tests/e2e/acl-matrix-state.spec.ts
    - tests/e2e/lifecycle.spec.ts
    - tests/e2e/replay.spec.ts
    - tests/e2e/routing.spec.ts
  modified:
    - .planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md
    - .planning/REQUIREMENTS.md
    - tests/fixtures/napplets/README.md

key-decisions:
  - "Deletion over migration — 7 specs loaded auth-napplet/publish-napplet/pure-napplet fixtures removed in Phase 21-01; unrunnable by design, migration would duplicate nub-*.spec.ts Layer-A coverage"
  - "Coverage preservation documented per deleted spec: ACL matrix/lifecycle → acl-revoke-*.spec.ts + demo-node-inspector; lifecycle auth → napplet-auth + nub-*; replay → runtime unit tests + denial paths; routing → ifc-roundtrip + nub-ifc + demo-debugger"
  - "REQUIREMENTS.md E2E-10 flipped Pending→Complete (line 69 checkbox + line 143 traceability table)"

patterns-established:
  - "Zero `test.describe.skip` markers anywhere under tests/e2e/*.spec.ts — enforced by grep gate"
  - "`ls tests/e2e/*.spec.ts | wc -l` = 26 (was 33; 7 deleted)"

requirements-completed:
  - E2E-10

# Metrics
duration: ~8min (crashed-resume; original execution recorded 47 passed / 0 failed / 0 skipped / 18.4s)
completed: 2026-04-18
---

# Phase 22 Plan 7: Zero Skipped Specs Gate Closure

**7 legacy spec files deleted via `git rm`; `pnpm test:e2e` reports 47 passed / 0 failed / 0 skipped / 18.4s (exit 0); E2E-10 closed; ROADMAP Phase 22 Success Criterion 1 verifiably satisfied.**

## Deleted Files

| File | Prior tests | Prior state | Reason |
|------|------------:|-------------|--------|
| `tests/e2e/acl-enforcement.spec.ts` | 9 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/acl-lifecycle.spec.ts` | 14 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/acl-matrix-relay.spec.ts` | 9 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/acl-matrix-state.spec.ts` | 14 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/lifecycle.spec.ts` | 5 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/replay.spec.ts` | 5 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |
| `tests/e2e/routing.spec.ts` | 9 | `test.describe.skip` | Loaded nonexistent `auth-napplet` fixture |

Total: 65 legacy test cases removed (verification reported 68 — small discrepancy from nested describe.skip counting).

## Coverage Preservation Audit

- **ACL enforcement / lifecycle / matrix** → Active coverage in `acl-revoke-relay-write.spec.ts`, `acl-revoke-storage-write.spec.ts` (E2E-08) + `demo-node-inspector.spec.ts` + `demo-audit-correctness.spec.ts` (E2E-06).
- **Lifecycle (auth handshake)** → Active coverage in `napplet-auth.spec.ts` (E2E-07) + `nub-*.spec.ts` (E2E-09) — v1.2 AUTH handshake via NIP-5D envelopes.
- **Replay** → Runtime's internal replay-detector unit tests + denial paths in `acl-revoke-*.spec.ts`.
- **Routing** → `ifc-roundtrip.spec.ts` (bot↔chat routing), `nub-ifc.spec.ts` (Layer-A ifc protocol), `demo-debugger.spec.ts` (envelope-type routing).

No protocol-correctness gap is opened.

## Performance

- **Duration:** ~8 min (includes crashed-resume overhead; pure execution per 22-ITERATION-LOG is ~2 min)
- **Files touched:** 10 (7 deleted, 3 modified)
- **Test suite:** 47 passed / 0 failed / 0 skipped / 18.4s (exit 0) — baseline identical to Phase 21-05 (47 passed) minus 68 skipped → zero skipped achieved

## Evidence

`22-ITERATION-LOG.md` §E2E-10 (lines 644–746) captures:
- Pre-delete fixture confirmation per file
- `git rm` invocation + staged-deletion proof
- Post-delete spec count (26) + zero-skip grep
- Dangling-reference grep (only documentation / iteration-log references remain; no active-spec or config pointer dangling)
- Full `pnpm test:e2e` tail + exit 0
- `pnpm build` regression spot-check (fully cached)
- CLOSED status marker

## Notes

- **Crashed-resume:** Terminal crashed mid-execution after the 22-ITERATION-LOG.md E2E-10 section was written and the 7 `git rm`s were staged but before the commit landed. This summary was written on resume; the commit bundles the staged deletions + log additions + README update + REQUIREMENTS.md update + this summary atomically.
- **Idempotency:** The iteration log E2E-10 section was already present from the crashed run — re-append was skipped per the plan's W6 guard.
