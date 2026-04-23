---
phase: 33-reserved-chord-surface-e2e-17
plan: 2
subsystem: docs-and-demo
tags: [keys, reservedChords, readme, docs, demo-shell, e2e-observation-surface, hyprgate-unblock]

# Dependency graph
requires:
  - phase: 33-reserved-chord-surface-e2e-17 (plan 1)
    provides: KeysServiceOptions.reservedChords public surface (v1.2.0), JSDoc @example prose, three canonicalizer helpers + reservation gates
  - phase: 32-nub-dep-consolidation
    provides: @napplet/nub/keys subpath imports (no action here, but inherited)
provides:
  - "packages/services/README.md Keys H2 Reserved Chords sub-section (57 inserted lines, placed inside Keys H2 scope before Media Service H2)"
  - "KeysServiceOptions table row for reservedChords with cross-reference link"
  - "WM-launcher integration @example in README (reservedChords: Object.keys(wmChordMap) pattern)"
  - "Precedence prose in README (reserved > registered contract, two bullets for IS/NOT reserved)"
  - "Normalization note in README (case-insensitive + modifier aliases via parseChord)"
  - "Demo shell reservedChords: ['Ctrl+Shift+R'] declaration at createKeysService call site"
  - "Demo shell onForward callback writes canonical chord string to #reserved-chord-last-fired DOM sentinel"
  - "Demo #reserved-chord-last-fired DOM sentinel element on parent frame (document.body, bottom-right diagnostic pill)"
affects: [33-03-e2e-17-playwright-spec, hyprgate-v2-wm-absolute-chords-docs-consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "README docs extension within existing H2 scope — sub-section inserted BEFORE next H2 to preserve heading hierarchy (### Reserved Chords inside ## Keys Service, before ## Media Service)"
    - "Shell-side DOM sentinel pattern for E2E observation — parent-frame element (not iframe) so Playwright can read via page.locator() without frameLocator() round-trip. Canonical chord-string format (Ctrl+Shift+R) written in onForward for exact-match assertion"
    - "Demo-boot one-shot DOM creation inside createDemoHooks — appended just before `return { tap, relay }` so the sentinel lands on every demo load without boot-order fragility"
    - "Data-testid + id dual-attribute pattern for Playwright sentinels — id for getElementById + CSS selectors, data-testid for Playwright's canonical attribute"

key-files:
  created: []
  modified:
    - packages/services/README.md
    - apps/demo/src/shell-host.ts

key-decisions:
  - "README sub-section ordering: `### Reserved Chords` inserted BEFORE `## Media Service` but AFTER `### When to plug a custom bridge` — keeps the new content within Keys H2 scope and adjacent to the other Keys sub-sections for discoverability"
  - "Canonical chord string format written to sentinel: `Ctrl+Shift+R` (plus-delimited, Ctrl/Alt/Shift/Meta in that order, single-char keys uppercased). Matches exactly what 33-03's Playwright spec will assert via toHaveText('Ctrl+Shift+R')"
  - "Sentinel element placement: parent frame (document.body) not any napplet iframe — so Playwright's page.locator('#reserved-chord-last-fired') reads it without frameLocator() traversal. Non-interactive (pointer-events: none) so it never intercepts clicks"
  - "Reserved chord choice: Ctrl+Shift+R — verified non-colliding via `grep -rn 'Ctrl+Shift+R\\|Control+Shift+KeyR' apps/` returning only the new declaration. Hotkey-chord napplet registers Ctrl+Shift+K (DEFAULT_KEY in main.ts:25), which is disjoint — preserves E2E-12 untouched"
  - "Empty-string initial sentinel text (not em-dash `—`) — keeps the first-fire assertion simple (toHaveText('Ctrl+Shift+R') after press; prior empty-state assertable via toHaveText(''))"

patterns-established:
  - "README docs parity with JSDoc source — the README Reserved Chords prose mirrors the JSDoc block on KeysServiceOptions.reservedChords field verbatim for precedence language (`reserved > registered`, `The shell WANTS the forward`). Single authoritative voice across tsdoc + README."
  - "Demo shell-side sentinel convention for E2E observation — parent frame DOM element with id + data-testid, updated in service callback, read via page.locator() without frameLocator(). Reusable for future service surfaces needing shell-side observation (e.g. future reserved-intent surfaces on media/theme)."

requirements-completed: [KEYS-06]

# Metrics
duration: 9m
completed: 2026-04-23
---

# Phase 33 Plan 2: Reserved Chord Docs + Demo Wiring Summary

**README Keys H2 gains a `### Reserved Chords` sub-section (table row + WM-launcher @example + precedence + normalization prose); demo shell reserves `Ctrl+Shift+R` and exposes a parent-frame `#reserved-chord-last-fired` DOM sentinel so 33-03's Playwright spec can observe shell handler fires without frameLocator traversal.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-23T09:05:00Z (approx, post 33-01 close)
- **Completed:** 2026-04-23T09:14:00Z
- **Tasks:** 2 (README docs + demo wiring)
- **Files modified:** 2

## Accomplishments

- Extended `packages/services/README.md` Keys H2 section with a new `### Reserved Chords` sub-section — 57 inserted lines documenting the reservedChords option shipped in 33-01
- Added a `reservedChords` row to the KeysServiceOptions table with an explicit precedence note ("reserved > registered") and a cross-ref link to the new sub-section
- Placed the sub-section inside Keys H2 scope (before `## Media Service`) so reserved-chord docs live with the rest of the keys surface
- README sub-section includes: runnable WM-launcher @example, precedence contract with two bulleted cases (IS / NOT reserved), normalization note (Ctrl/Control/ctrl + Cmd/Command/Meta/Win/Super), dynamic-reservation deferred-extension note, OS-level global hotkeys cross-reference to `HostKeysBridge.registerGlobalHotkey`
- Wired the demo shell to reserve `Ctrl+Shift+R` — chosen for non-collision with the hotkey-chord napplet's `Ctrl+Shift+K` registration (preserves E2E-12)
- Extended the existing `onForward` callback in `apps/demo/src/shell-host.ts` (at the `createKeysService()` call site) to write the canonical chord string to a new `#reserved-chord-last-fired` DOM sentinel — parent frame, not any iframe, so the Playwright spec in 33-03 can read it via `page.locator()` without frameLocator traversal
- Appended a small bottom-right diagnostic pill (`<div id="reserved-chord-last-fired" data-testid="reserved-chord-last-fired">`) to `document.body` inside `createDemoHooks`, styled as `position: fixed; pointer-events: none; z-index: 9999` so it never intercepts clicks nor interferes with existing UI assertions
- Full workspace turborepo build: `Tasks: 22 successful, 22 total` (19 cached, 3 rebuilt for this plan's touched files), zero type errors, zero build errors
- `pnpm --filter @kehto/services type-check` exits 0 — validates 33-01's reservedChords surface is type-consumable by downstream packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend README Keys H2 with Reserved Chords sub-section** — `8d1f95c` (docs)
   - Added reservedChords table row (one row in KeysServiceOptions)
   - Inserted `### Reserved Chords` sub-section between `### When to plug a custom bridge` and `## Media Service`
   - +57 / -0 lines on packages/services/README.md
   - Verification: `grep -c "^### Reserved Chords"` = 1; `grep -c "reserved > registered"` = 2; `grep -c "reservedChords"` = 7; `grep -c "HostKeysBridge.reserveAbsolute"` = 1; structural placement confirmed (line 155 before line 211)

2. **Task 2: Wire demo shell for E2E-17 reserved-chord observation** — `f144953` (feat)
   - Pass `reservedChords: ['Ctrl+Shift+R']` to createKeysService()
   - Extend onForward to write canonical chord string to #reserved-chord-last-fired
   - Append sentinel `<div>` to document.body inside createDemoHooks
   - +52 / -1 lines on apps/demo/src/shell-host.ts
   - Verification: `grep -c "reservedChords: \\['Ctrl+Shift+R'\\]"` = 1; `grep -c "reserved-chord-last-fired"` = 4 (id + getElementById + id-attr + data-testid-attr); full workspace build `Tasks: 22 successful, 22 total`; @kehto/services type-check exits 0; @kehto/demo build exits 0

**Plan metadata commit:** _(following this write — SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

- `packages/services/README.md` — Added a `reservedChords` row to the KeysServiceOptions table, inserted a new `### Reserved Chords` sub-section between the Keys H2's existing `### When to plug a custom bridge` and the `## Media Service` H2. Sub-section covers: WM-launcher @example (Ctrl+Alt+T / Super+Space / Ctrl+Shift+Q), precedence contract (reserved > registered with two bullets for IS / NOT reserved), normalization note (parseChord aliases), deferred-extension note (HostKeysBridge.reserveAbsolute v1.7+), OS-level orthogonality note (registerGlobalHotkey). +57 / -0 lines.
- `apps/demo/src/shell-host.ts` — Extended `createKeysService({ ... })` call site (~line 462) with `reservedChords: ['Ctrl+Shift+R']`. Extended the existing onForward callback (inline in the same options object) to construct the canonical chord string (Ctrl/Alt/Shift/Meta + uppercased single-char key, plus-delimited) and write it to `document.getElementById('reserved-chord-last-fired').textContent`. Appended a new `<div>` sentinel inside `createDemoHooks` just before `return { tap, relay };` (line ~927 → now ~954) with id + data-testid both set to `reserved-chord-last-fired`, styled as a bottom-right fixed pill with `pointer-events: none`. +52 / -1 lines.

## Decisions Made

- **Sub-section placement within Keys H2 scope (before `## Media Service` H2)**: Keeps reserved-chord docs adjacent to the rest of the keys surface (Factory, KeysServiceOptions, HostKeysBridge interface, Usage, When to plug a custom bridge) for discoverability. Rejected placement after Media Service (would orphan keys-scope content) or a new top-level H2 (would break the established `## X Service` rhythm for other NUB domains).
- **Canonical chord string format `Ctrl+Shift+R` written to sentinel**: Exactly matches what `parseChord → chordSpecKey → reconstructed` produces. 33-03's Playwright spec will assert `toHaveText('Ctrl+Shift+R')` — the format is load-bearing for that assertion. Order (Ctrl, Alt, Shift, Meta) is Arc-stable because parseChord normalizes modifier order deterministically; single-char keys uppercased matches how the reserved set was normalized at service boot.
- **Parent-frame DOM sentinel (document.body) over iframe-resident one**: Playwright's page.locator() reads parent-frame DOM directly; frameLocator() is only needed for iframe-resident DOM. The plan's `read_first` explicitly called this out — keeps 33-03's assertion shape as simple as `await expect(page.locator('#reserved-chord-last-fired')).toHaveText('Ctrl+Shift+R')`.
- **`pointer-events: none` on the sentinel element**: Prevents the diagnostic pill from intercepting clicks that land on the bottom-right of the demo page. Also keeps it invisible to keyboard-navigation (tabindex never enters it) and accessibility tooling (no aria-role, presentation-only).
- **Reserved chord choice `Ctrl+Shift+R`**: The plan recommended this chord; verification via `grep -rn 'Ctrl+Shift+R\\|Control+Shift+KeyR' apps/` returns only the new declaration (zero pre-existing hits). Disjoint from hotkey-chord's `Ctrl+Shift+K` registration, so E2E-12 is unaffected. `R` is also a safe choice vs browser defaults — it's `Ctrl+Shift+R` (hard-refresh) in most browsers, but Playwright's `page.keyboard.press('Control+Shift+KeyR')` dispatches to the page's document listener before browser UI consumes it, and the reservedChord gate short-circuits before any napplet-side effect.
- **Empty-string initial sentinel text (not em-dash `—`)**: Keeps the first-fire assertion simple. Pre-press state can still be asserted via `toHaveText('')` if needed; post-press state asserts `toHaveText('Ctrl+Shift+R')`. Em-dash would introduce a unicode escape into the Playwright spec for negligible UX benefit on a non-interactive diagnostic element.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the exact edit shapes specified in the plan's `<action>` blocks. The sub-section prose mirrors the plan's template verbatim (including the WM-launcher @example, precedence bullets, and normalization note). The shell-host.ts edits used the exact canonical chord-string-reconstruction pattern (parts array, push Ctrl/Alt/Shift/Meta in order, uppercased single-char key, `.join('+')`) from the plan.

One minor clarification-level adjustment: the plan's `<action>` Edit 2 specified appending the sentinel creation "after the final `};` that closes the `__grantMediaControl__` assignment (find the closing brace, should be around line 935–945)." The actual close was at line 925 (`};` for __grantMediaControl__) and the natural insertion point was just before `return { tap, relay };` at the end of `createDemoHooks` — which is the same logical location (inside createDemoHooks, after all the host-hook blocks). Edit landed exactly where the plan intended.

## Issues Encountered

- **None.** README edit + shell-host edit both landed cleanly on the first attempt; type-check + build both exit 0 on the first run.

Browser-default-hotkey consideration for `Ctrl+Shift+R`: Ctrl+Shift+R is "hard refresh" in most browsers. Playwright's `page.keyboard.press('Control+Shift+KeyR')` dispatches the event to the page's document keydown listener before the browser UI chrome consumes it — so the keys-service's document listener fires first (and the reservation gate short-circuits before any napplet or browser default action). Not an issue; noted here for 33-03's spec author.

## User Setup Required

None — docs-only + demo-wiring changes. No environment variables, no external services, no host-app configuration.

## Next Phase Readiness

- **33-03 (E2E-17 Playwright spec)**: Full observation surface is now live in the demo. The spec can:
  1. Load the demo (via existing `demoBeforeEach` fixture from v1.3 Phase 16)
  2. Wait for the hotkey-chord napplet to reach AUTHENTICATED (via existing `waitForNappletReady` fixture)
  3. Register `Ctrl+Shift+R` via `keys.registerAction` inside the hotkey-chord napplet (override the DEFAULT_KEY via a test-specific path, OR add a second action registration for `Ctrl+Shift+R` and assert both — plan phase will decide)
  4. Dispatch `page.keyboard.press('Control+Shift+KeyR')` at the parent frame
  5. Assert `page.locator('#reserved-chord-last-fired')` has text `Ctrl+Shift+R` (shell handler fired)
  6. Assert the hotkey-chord napplet's own counter sentinel (e.g. `#hotkey-chord-count` in the napplet iframe) did NOT increment from the Ctrl+Shift+R press — the napplet's registered action is suppressed per the reserved > registered precedence contract
- **Public surface**: The `reservedChords` option is documented + JSDoc'd + cross-referenced from the README. Downstream consumers (hyprgate v2.0 first) have a canonical reference to cite.
- **No blockers carried forward.** Full workspace build green, type-check green, working tree clean after commits.

## Self-Check: PASSED

Verification performed post-SUMMARY write:

- `packages/services/README.md` — FOUND (modified)
- `apps/demo/src/shell-host.ts` — FOUND (modified)
- `.planning/phases/33-reserved-chord-surface-e2e-17/33-02-SUMMARY.md` — FOUND (this file)
- Commit `8d1f95c` (Task 1: README docs) — FOUND in `git log`
- Commit `f144953` (Task 2: demo shell wiring) — FOUND in `git log`
- `grep -c "^### Reserved Chords" packages/services/README.md` = 1
- `grep -c "reserved > registered" packages/services/README.md` = 2
- `grep -c "reservedChords" packages/services/README.md` = 7
- `grep -c "HostKeysBridge.reserveAbsolute" packages/services/README.md` = 1
- `grep -c "reservedChords: \['Ctrl+Shift+R'\]" apps/demo/src/shell-host.ts` = 1
- `grep -c "reserved-chord-last-fired" apps/demo/src/shell-host.ts` = 4
- Full workspace build: `Tasks: 22 successful, 22 total`
- `pnpm --filter @kehto/services type-check` exits 0
- `pnpm --filter @kehto/demo build` exits 0
- Working tree clean after task commits (pre-metadata commit)

---
*Phase: 33-reserved-chord-surface-e2e-17*
*Completed: 2026-04-23*
