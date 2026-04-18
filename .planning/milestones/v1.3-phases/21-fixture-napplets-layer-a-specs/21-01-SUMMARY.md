---
phase: 21-fixture-napplets-layer-a-specs
plan: 01
subsystem: testing
tags: [playwright, fixtures, napplets, e2e, nip-5d, cleanup]

# Dependency graph
requires:
  - phase: 20-expanded-domain-napplets
    provides: describe.skip markers on 7 legacy specs citing Phase 21 (E2E-09)
provides:
  - tests/fixtures/napplets/README.md documenting v1.3 nub-* fixture pattern + removal rationale
  - Clean napplets/ directory with no legacy NIP-01 protocol fixtures

affects:
  - 21-02 (nub-* fixture creation — directory now clean, unambiguous)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "nub-<domain> fixture naming convention (nub-identity, nub-ifc, nub-notify, nub-relay, nub-storage, nub-theme)"
    - "Fixture napplets use @napplet/sdk only — NO raw window.addEventListener('message')"

key-files:
  created:
    - tests/fixtures/napplets/README.md
  modified: []

key-decisions:
  - "D-02 option (a) implemented: legacy fixtures deleted (not kept alongside new ones) — cleanliness > backward compat for v1.3"

patterns-established:
  - "Fixture napplets are SDK-based only; raw window message listeners are anti-features"
  - "README.md in napplets/ documents both current pattern and removal rationale for historical clarity"

requirements-completed:
  - E2E-09

# Metrics
duration: 1min
completed: 2026-04-18
---

# Phase 21 Plan 01: Delete Legacy Fixture Napplets Summary

**Deleted 3 NIP-01 legacy fixture napplets (auth-napplet, publish-napplet, pure-napplet) and documented v1.3 nub-* pattern in README.md — unblocking Plan 21-02 nub-domain fixture creation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-18T10:29:01Z
- **Completed:** 2026-04-18T10:30:00Z
- **Tasks:** 1
- **Files modified:** 13 (12 deleted + 1 created)

## Accomplishments

- Deleted `tests/fixtures/napplets/auth-napplet/` (NIP-01 `['OK', ...]` array dispatch, incompatible with v1.2 NIP-5D shell)
- Deleted `tests/fixtures/napplets/publish-napplet/` (NIP-01 + raw `window.napplet.relay.publish`, unused)
- Deleted `tests/fixtures/napplets/pure-napplet/` (HTML stub with no SDK, used only by skipped specs)
- Created `tests/fixtures/napplets/README.md` with removal rationale and v1.3 `nub-<domain>` fixture pattern reference
- Confirmed 7 describe.skip blocks in affected spec files remain untouched (1 per spec file)
- `pnpm install` and `pnpm type-check` (8/8 tasks) both green after removal

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete legacy fixture napplet directories and document removal** - `cdf413d` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/fixtures/napplets/README.md` — Created. Documents v1.3 nub-* fixture pattern (6 active fixtures + 2 stub-domain specs) and "Removed in Phase 21" section with per-fixture removal rationale.
- `tests/fixtures/napplets/auth-napplet/` — DELETED (5 files: index.html, package.json, src/main.ts, tsconfig.json, vite.config.ts)
- `tests/fixtures/napplets/publish-napplet/` — DELETED (5 files: index.html, package.json, src/main.ts, tsconfig.json, vite.config.ts)
- `tests/fixtures/napplets/pure-napplet/` — DELETED (2 files: package.json, src/index.html)

## Decisions Made

- D-02 option (a) confirmed: deleted all three legacy fixtures rather than keeping them alongside new nub-* fixtures. Rationale: cleanliness > backward compat for v1.3; legacy fixtures cannot be revived under NIP-5D.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing peer dependency warnings (`@emnapi/core`, `@emnapi/runtime`) in pnpm install output are unrelated to this plan and were present before the changes.

## Verification Commands Run

```
# 1. Legacy directories deleted
! test -d tests/fixtures/napplets/auth-napplet \
  && ! test -d tests/fixtures/napplets/publish-napplet \
  && ! test -d tests/fixtures/napplets/pure-napplet
# → OK: legacy directories deleted

# 2. Parent dir intact + README content
test -d tests/fixtures/napplets             # → OK: parent dir intact
test -f tests/fixtures/napplets/README.md   # → OK: README.md exists
grep -q "Removed in Phase 21" ...           # → OK: removal rationale present
grep -qE "nub-(identity|...)" ...           # → OK: nub- pattern documented

# 3. pnpm install
pnpm install --prefer-offline 2>&1 | tail   # → Done in 802ms

# 4. type-check
pnpm type-check                             # → Tasks: 8 successful, 8 total

# 5. describe.skip blocks (7 spec files, 1 each — all intact)
# lifecycle, routing, replay, acl-matrix-state, acl-matrix-relay,
# acl-lifecycle, acl-enforcement: all 1 describe.skip block
```

## Known Stubs

None — this plan is a deletion + documentation task only. No code stubs introduced.

## Next Phase Readiness

- Plan 21-02 is unblocked: `tests/fixtures/napplets/` is clean with no legacy fixtures; the README documents the target nub-* pattern Plan 21-02 must implement.
- No blockers for Plan 21-02 execution.

## Self-Check: PASSED

- FOUND: tests/fixtures/napplets/README.md
- FOUND: .planning/phases/21-fixture-napplets-layer-a-specs/21-01-SUMMARY.md
- FOUND: commit cdf413d

---
*Phase: 21-fixture-napplets-layer-a-specs*
*Completed: 2026-04-18*
