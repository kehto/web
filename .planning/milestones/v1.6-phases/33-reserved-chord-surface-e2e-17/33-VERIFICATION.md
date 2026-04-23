---
phase: 33-reserved-chord-surface-e2e-17
verified: 2026-04-23T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 33: Reserved Chord Surface + E2E-17 Verification Report

**Phase Goal:** A shell can declare WM-absolute chords once via `createKeysService` and have the keys service short-circuit to the shell bridge — precedence `reserved > registered` — so a napplet claiming the same chord via `keys.registerAction` never gets the event. Layer-B Playwright locks the contract.
**Verified:** 2026-04-23
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `createKeysService` accepts `reservedChords?: ReadonlyArray<string>` option (exported + JSDoc'd) | ✓ VERIFIED | Option present in `packages/services/src/keys-service.ts` (4 matches) AND re-exported in `packages/services/dist/index.d.ts` (2 matches). JSDoc with `@example` block confirmed in dist surface. |
| 2 | Reserved chord forwarded via `keys.forward` → shell handler fires AND napplet `keys.action` suppressed | ✓ VERIFIED | Reservation gate wired at three sites: Branch A `keys.forward` (line 396), Branch B `keys.forward` (line 634), Branch B document keydown listener (line 559). Helpers `chordSpecKey`, `forwardKey`, `eventKey`, and `reservedChordKeys` Set all present. 6 new unit tests added (`describe('reserved chords')` — per 33-01 SUMMARY: 28/28 green). |
| 3 | `packages/services/README.md` Keys H2 has `### Reserved Chords` sub-section with WM-launcher example + precedence note | ✓ VERIFIED | Sub-section present (1 match). `reserved > registered` precedence prose present (2 matches). WM-launcher `wmChordMap` example present (3 matches). Cross-reference to deferred `HostKeysBridge.reserveAbsolute` present (1 match). |
| 4 | `tests/e2e/reserved-chord.spec.ts` exists, passes against built `:4174` demo — asserts shell sentinel + napplet counter | ✓ VERIFIED | Spec file present (106 lines, ≥80 required). Contains `reservedChords`/`Ctrl+Shift+R` (11 matches), `Control+Shift+KeyR` keyboard press, `#reserved-chord-last-fired` sentinel assertions, `#hotkey-chord-count` / `#hotkey-chord-last` napplet counter assertions, regression gate with `Control+Shift+KeyK`. **Live isolated run: `1 passed (3.4s)`.** |
| 5 | Fresh-install iteration loop reports **54 passed / 0 failed / 0 skipped** (delta 53 → 54) | ✓ VERIFIED | `33-ITERATION-LOG.md` records `✅ 54 passed / 0 failed / 0 skipped (18.5s)`. **Live full-suite re-run during verification: `54 passed (18.4s)`.** Baseline delta 53 → 54 (+1 for reserved-chord.spec.ts). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/services/src/keys-service.ts` | `reservedChords` option + reservation gate helpers + version bump | ✓ VERIFIED | `KEYS_SERVICE_VERSION = '1.2.0'` (bumped from 1.1.0), 4 `reservedChords` matches, 3 helpers (`chordSpecKey`, `forwardKey`, `eventKey`), `reservedChordKeys` Set referenced in 3 gate sites (Branch A / Branch B forward / Branch B keydown). |
| `packages/services/src/keys-service.test.ts` | `describe('reserved chords', ...)` unit block with ≥6 tests | ✓ VERIFIED | Per 33-01 SUMMARY: 28/28 test pass with 6 new tests under reserved-chord block. |
| `packages/services/README.md` | `### Reserved Chords` sub-section | ✓ VERIFIED | Heading present, precedence prose (`reserved > registered`) ×2, `reservedChords` references ×4, WM-launcher example ×3, deferred-extension note ×1. |
| `packages/services/dist/index.d.ts` | Public surface re-export | ✓ VERIFIED | `reservedChords` present (2 matches — JSDoc + field declaration). |
| `apps/demo/src/shell-host.ts` | `reservedChords: ['Ctrl+Shift+R']` + `#reserved-chord-last-fired` sentinel | ✓ VERIFIED | `reservedChords: ['Ctrl+Shift+R']` literal matches (1). `#reserved-chord-last-fired` element created via `document.createElement('div')` + `appendChild(document.body)` at line 961; `document.getElementById('reserved-chord-last-fired')` consumed in `onForward` at line 485. Total 4 references. |
| `tests/e2e/reserved-chord.spec.ts` | Layer-B spec locking E2E-17 | ✓ VERIFIED | 106 lines. Imports `@playwright/test` + `demoBeforeEach`. Uses `baseURL: 'http://localhost:4174'`, `serial` mode, `ANTI_TERM_RE` regex. All 8 assertion steps present. Live run passes. |
| `.planning/phases/33-reserved-chord-surface-e2e-17/33-ITERATION-LOG.md` | Canonical fresh-install loop evidence | ✓ VERIFIED | Records Pre-Iteration Git State, explicit `rm -rf` chain (no `pnpm clean`), `Cached: 0 cached, 22 total`, Playwright summary `54 passed (18.5s)`, Anti-term sweeps all `(clean)`, Final Evidence table with 53→54 delta. |

### Key Link Verification

Note: `gsd-tools verify key-links` returned "Source file not found" for all links — this is a tool artifact (literal string match against `from:` field parentheticals like `(~line 462)`). Verified manually below.

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `KeysServiceOptions.reservedChords` | `createKeysService` body | Destructured → precomputed `Set<string>` of canonical keys | ✓ WIRED | Line 342 declares `const reservedChordKeys: Set<string> = new Set();` → lines 347 populate from `options.reservedChords` → consulted at lines 396, 559, 634. |
| `keys.forward` handler (both branches) | Reservation gate | Early-return path: fires `onForward`, suppresses `keys.action` dispatch | ✓ WIRED | `reservedChordKeys.has(forwardKey(m))` in Branch A (line 396) and Branch B (line 634); `reservedChordKeys.has(eventKey(ev))` in document keydown listener (line 559) which early-returns on reserved, suppressing the `send(payload)` fan-out loop. |
| `createKeysService` call in demo | `KeysServiceOptions.reservedChords` | `reservedChords: ['Ctrl+Shift+R']` declarative at demo boot | ✓ WIRED | `apps/demo/src/shell-host.ts:472` — `reservedChords: ['Ctrl+Shift+R']`. TypeScript compilation clean (33-02 build exit 0). |
| `onForward` callback | `#reserved-chord-last-fired` sentinel | `getElementById(...).textContent = <chord string>` | ✓ WIRED | Line 485 reads sentinel; lines 490–493 compose `Ctrl|Alt|Shift|Meta|KEY` string from event flags; writes `sentinel.textContent`. Element created at line 961 via `document.body.appendChild`. |
| `page.keyboard.press('Control+Shift+KeyR')` | Shell `onForward` + sentinel write | Synthetic keydown → document listener → `onForward` → sentinel | ✓ WIRED | Live spec run asserts `#reserved-chord-last-fired` transitions from `''` → `'Ctrl+Shift+R'` after the synthetic press. Confirmed in isolated run AND full-suite run (both pass). |
| Spec napplet assertion | `#hotkey-chord-count` (iframe) | `frameLocator('#hotkey-chord-frame-container iframe')` + `toHaveText('0')` | ✓ WIRED | Lines 56 / 82 of spec read counter inside frameLocator; passes live — napplet counter stays at `'0'` after reserved `Ctrl+Shift+R` press, confirming suppression. Then increments to `'1'` after non-reserved `Ctrl+Shift+K` press (regression gate). |

### Data-Flow Trace (Level 4)

The phase's primary user-observable behavior is the Playwright spec itself — the automated assertion IS the data-flow proof.

| Artifact | Data Flow | Source → Sink | Produces Real Data | Status |
|----------|-----------|---------------|--------------------|----|
| `reservedChords` option | `options.reservedChords` → `parseChord` → `chordSpecKey` → `reservedChordKeys` Set | Real input from demo (`['Ctrl+Shift+R']`) → normalized canonical string keys consulted at runtime | Yes — spec live-press produces `Ctrl+Shift+R` match | ✓ FLOWING |
| `#reserved-chord-last-fired` sentinel | DOM keydown → keys-service document listener → `options.onForward(event)` → `getElementById('reserved-chord-last-fired').textContent = parts.join('+')` | Live Playwright press → shell `onForward` fires → sentinel text updates to `'Ctrl+Shift+R'` | Yes — spec asserts exact text `'Ctrl+Shift+R'` after press; assertion passes | ✓ FLOWING |
| `#hotkey-chord-count` (napplet iframe) | Napplet `keys.registerAction` subscription → service routes `keys.action` via `send(payload)` → napplet increments counter | Reserved chord press produces ZERO `keys.action` envelopes (suppressed by gate); non-reserved chord produces 1 envelope (legacy path intact) | Yes — counter stays `'0'` on reserved, transitions to `'1'` on non-reserved | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reserved chord spec passes in isolation | `pnpm exec playwright test tests/e2e/reserved-chord.spec.ts` | `1 passed (3.4s)` | ✓ PASS |
| Full E2E suite reports 54 passed | `pnpm test:e2e` | `54 passed (18.4s)` | ✓ PASS |
| `reservedChords` exported in dist | `grep -c 'reservedChords' packages/services/dist/index.d.ts` | `2` | ✓ PASS |
| `KEYS_SERVICE_VERSION` bumped to 1.2.0 | `grep "KEYS_SERVICE_VERSION = '1.2.0'"` source | Line present | ✓ PASS |
| All phase commits real (not speculative) | `gsd-tools verify commits 9deecc8 48fa038 7d9d649 8d1f95c f144953 7b6765c 6915078` | `all_valid: true, valid: 7/7` | ✓ PASS |

### Requirements Coverage

Plan frontmatter REQ-IDs cross-referenced against `.planning/REQUIREMENTS.md`:

| Requirement | Source Plan | Description | REQUIREMENTS.md Status | Evidence |
|-------------|-------------|-------------|------------------------|----------|
| KEYS-04 | 33-01 | `reservedChords` option on `createKeysService` | Complete (Phase 33) | Option shipped + JSDoc'd + version bumped to 1.2.0 + exported in dist surface |
| KEYS-05 | 33-01 | Reservation gate with `reserved > registered` precedence | Complete (Phase 33) | Gate wired at all three keys-forward/keydown sites; 6 unit tests green; live E2E asserts napplet counter stays at 0 on reserved press |
| KEYS-06 | 33-02 | README docs for reserved chords | Complete (Phase 33) | `### Reserved Chords` sub-section with WM-launcher example + precedence prose + deferred-extension note |
| E2E-17 | 33-03 | Playwright spec for reserved-chord contract | Complete (Phase 33) | 106-line spec passes live (full suite: `54 passed`); locks 53→54 baseline delta |

**Coverage:** 4/4 phase REQ-IDs satisfied (KEYS-04, KEYS-05, KEYS-06, E2E-17). All marked `Complete` in REQUIREMENTS.md and verified in codebase.

**Orphans:** None. All phase REQ-IDs claimed by exactly one plan; no REQ-IDs mapped to Phase 33 in REQUIREMENTS.md are unclaimed.

### Anti-Patterns Found

None. Scan of `packages/services/src/keys-service.ts` and `tests/e2e/reserved-chord.spec.ts` for `TODO|FIXME|XXX|HACK|PLACEHOLDER|not yet implemented` returned zero matches.

Iteration log records anti-term sweep results:
- napplet source (`apps/demo/napplets/`): clean (excluding comment prose)
- `@napplet/nub-` substring in `packages/`: clean (CHANGELOG-excluded)
- `core-compat` live consumers: clean (only historical CHANGELOG references)
- v1.6-touched paths: ANTI_TERM_RE regex-literal matches only (by construction, acceptable)

### Human Verification Required

None. The E2E spec IS the automated assertion for the user-observable behavior (shell receives reserved chord; napplet does not). Live full-suite pass during verification (`54 passed (18.4s)`) seals the contract without human intervention.

---

## Gaps Summary

No gaps. All 5 success criteria from ROADMAP.md Phase 33 are met with live evidence:

1. `reservedChords` option shipped with JSDoc and is re-exported from the package's public surface.
2. Reservation gate suppresses napplet `keys.action` for reserved chords across all three dispatch sites (Branch A forward / Branch B forward / Branch B keydown listener); unit tests and E2E spec both exercise this.
3. README documents the precedence contract with a WM-launcher example.
4. Playwright spec exists, passes in isolation, and passes as part of the full suite.
5. Full-suite E2E count is exactly 54 (53 baseline + 1 new spec), with zero failures and zero skips.

All 7 phase commits exist and are reachable from `main`. All 4 phase REQ-IDs are marked `Complete` in `REQUIREMENTS.md` with codebase evidence.

Phase 33 achieves its goal: a shell CAN declare WM-absolute chords once via `createKeysService`, the keys service DOES short-circuit to the shell bridge with `reserved > registered` precedence, and a napplet claiming the same chord DOES NOT receive the event. Layer-B Playwright locks the contract in CI.

---

*Verified: 2026-04-23*
*Verifier: Claude (gsd-verifier)*
