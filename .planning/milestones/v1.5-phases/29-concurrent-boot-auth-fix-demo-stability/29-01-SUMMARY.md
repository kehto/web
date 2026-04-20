---
phase: 29-concurrent-boot-auth-fix-demo-stability
plan: 01
subsystem: ui
tags: [demo, napplets, auth, dom-update, aclRendered, DEMO_NAPPLETS]

# Dependency graph
requires:
  - phase: 20-expanded-domain-napplets
    provides: DEMO_NAPPLETS array with statusId/name per entry; shell-host.ts NappletInfo.authenticated flag
  - phase: 26-real-keys-backend
    provides: hotkey-chord + media-controller entries added to DEMO_NAPPLETS (entries 9-10)
provides:
  - apps/demo/src/main.ts refreshAclPanelsIfNeeded() as a data-driven DEMO_NAPPLETS loop; all 10 napplets get status DOM updated on AUTH
affects: [29-02-plan, phase-31-e2e-concurrent-boot]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven topology status update: iterate DEMO_NAPPLETS, find matching NappletInfo by name, set statusEl.textContent + style.color only once (idempotent via aclRendered Set.has)"

key-files:
  created: []
  modified:
    - apps/demo/src/main.ts

key-decisions:
  - "Replace hardcoded chat+bot if-chain with DEMO_NAPPLETS loop — closes DEMO-01 bug for all 10 napplets automatically; future additions are zero-cost"
  - "Remove aclRendered.size < 8 stale guard — idempotence is provided by Set.has(napplet.name) inside the loop; size-based bail was v1.3 era and blocked v1.4 additions"
  - "Delete orphaned *Info const declarations (chatInfo, botInfo, composerInfo, preferencesInfo, toasterInfo, feedInfo, profileViewerInfo, themeSwitcherInfo) — dead code after refactor"
  - "200ms setTimeout debounce preserved unchanged on both Path A (NIP-01 OK) and Path B (ENVELOPE) tap.onMessage branches"

patterns-established:
  - "Status-sentinel update pattern: document.getElementById(napplet.statusId).textContent = 'authenticated'; .style.color = '#39ff14' — applied data-driven to all DEMO_NAPPLETS entries"

requirements-completed: [DEMO-01]

# Metrics
duration: 15min
completed: 2026-04-19
---

# Phase 29 Plan 01: DEMO-01 Status-Text Display Bug Fix Summary

**Single DEMO_NAPPLETS for-of loop replaces the hardcoded chat+bot-only if-chain in refreshAclPanelsIfNeeded() — all 10 napplets now get their outer topology status sentinel updated to 'authenticated' when their NappletInfo.authenticated flag flips true**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19T22:09:37Z
- **Completed:** 2026-04-19T22:25:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Rewrote `refreshAclPanelsIfNeeded()` in `apps/demo/src/main.ts` as a single `for (const napplet of DEMO_NAPPLETS)` loop — closes the "7/10 stuck on LOADING" user-visible bug
- Removed the stale `if (aclRendered.size < 8)` code guard from the Path B tap.onMessage branch (comment referencing the removal preserved for auditability)
- Deleted 8 orphaned `*Info` const declarations (chatInfo, botInfo, composerInfo, preferencesInfo, toasterInfo, feedInfo, profileViewerInfo, themeSwitcherInfo) — all dead code after refactor
- Build, type-check, and 49/0/0 e2e baseline all pass

## Before / After Shape of refreshAclPanelsIfNeeded()

**Before (lines 757-800 of main.ts, pre-29-01):**
```ts
function refreshAclPanelsIfNeeded(): void {
  const chatStatus = document.getElementById('chat-status');
  const botStatus = document.getElementById('bot-status');

  if (chatInfo?.authenticated && chatStatus && !aclRendered.has('chat')) {
    chatStatus.textContent = 'authenticated';
    chatStatus.style.color = '#39ff14';
    aclRendered.add('chat');
  }
  if (botInfo?.authenticated && botStatus && !aclRendered.has('bot')) {
    botStatus.textContent = 'authenticated';
    botStatus.style.color = '#39ff14';
    aclRendered.add('bot');
  }
  // 6 more if-blocks for composer/preferences/toaster/feed/profile-viewer/theme-switcher
  // that only called aclRendered.add() — NO DOM update for those 6
  // hotkey-chord + media-controller: completely missing (not mentioned at all)

  if (aclRendered.size > 0) {
    renderAclPanels(aclRendered);
  }
  refreshNodeSummaries();
}
```

**After (post-29-01):**
```ts
// Phase 29 (Plan 29-01, DEMO-01): Data-driven status refresh.
// ...
function refreshAclPanelsIfNeeded(): void {
  for (const napplet of DEMO_NAPPLETS) {
    if (aclRendered.has(napplet.name)) continue;
    const info = nappletInfos.find((entry) => entry.name === napplet.name);
    if (!info?.authenticated) continue;
    const statusEl = document.getElementById(napplet.statusId);
    if (statusEl) {
      statusEl.textContent = 'authenticated';
      statusEl.style.color = '#39ff14';
    }
    aclRendered.add(napplet.name);
  }

  if (aclRendered.size > 0) {
    renderAclPanels(aclRendered);
  }

  refreshNodeSummaries();
}
```

**Path B stale guard removed — before:**
```ts
  if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
    // Quick bail if all panels already rendered (8 napplets total after Phase 20)
    if (aclRendered.size < 8) {
      setTimeout(() => {
        refreshAclPanelsIfNeeded();
      }, 200);
    }
  }
```

**Path B — after:**
```ts
  if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
    setTimeout(() => {
      refreshAclPanelsIfNeeded();
    }, 200);
  }
```

## 200ms Debounce Preserved (Both Branches)

**Path A (NIP-01 OK) — unchanged:**
```ts
if (msg.verb === 'OK' && msg.parsed.success === true && msg.direction === 'shell->napplet') {
  setTimeout(() => {
    refreshAclPanelsIfNeeded();
  }, 200);
}
```

**Path B (ENVELOPE) — guard removed, debounce preserved:**
```ts
if (msg.verb === 'ENVELOPE' && msg.direction === 'napplet->shell' && msg.windowId) {
  setTimeout(() => {
    refreshAclPanelsIfNeeded();
  }, 200);
}
```

## Evidence: Acceptance Criteria Grep Counts

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "for (const napplet of DEMO_NAPPLETS)"` | 1 | 1 |
| `grep -c "if (aclRendered.size < 8)"` (code guard) | 0 | 0 |
| `grep -c "chatStatus.textContent = 'authenticated'"` | 0 | 0 |
| `grep -c "botStatus.textContent = 'authenticated'"` | 0 | 0 |
| `grep -c "napplet.statusId"` | ≥1 | 1 |
| `grep -c "renderAclPanels(aclRendered)"` | 1 | 1 |
| `grep -c "refreshNodeSummaries()"` | ≥1 | 4 |
| `grep -c ", 200)"` (200ms debounce) | ≥2 | 2 |
| Anti-feature grep (window.nostr, signer-service etc.) | 0 | 0 |
| `DEMO_NAPPLETS` imported from shell-host | yes | yes (line 10, pre-existing) |

## Build / Type-check / E2E Evidence

**Build:**
```
> @kehto/demo@0.0.1 build /home/sandwich/Develop/kehto/apps/demo
> vite build

vite v6.4.2 building for production...
dist/assets/main-CLoUiXuP.js   276.40 kB │ gzip: 89.02 kB
built in 855ms
```
(filter used: `--filter @kehto/demo`; `@kehto/demo-app` does not match — actual package name is `@kehto/demo`)

**Type-check:** `Tasks: 8 successful, 8 total` — exit 0

**E2E (pnpm test:e2e):** `49 passed (18.6s)` — exit 0 (two isolated runs confirmed 49/0/0; one flaky run of unrelated specs `demo-node-inspector.spec.ts:50` and `media-controller.spec.ts:72` observed; both confirmed flaky against pre-change baseline via `git stash` comparison)

## Task Commits

1. **Task 1: Rewrite refreshAclPanelsIfNeeded() as DEMO_NAPPLETS loop and remove stale guard** - `d27133b` (feat)

## Files Created/Modified

- `apps/demo/src/main.ts` — refreshAclPanelsIfNeeded() rewritten as data-driven DEMO_NAPPLETS loop; stale size guard removed; 8 orphaned *Info consts deleted

## Optional Edit 3 Result (*Info const cleanup)

All 8 per-napplet `*Info` const declarations (chatInfo, botInfo, composerInfo, preferencesInfo, toasterInfo, feedInfo, profileViewerInfo, themeSwitcherInfo) at lines 584-595 were the only read sites for those variables after Edit 1 removed all their consumers. They were deleted entirely. `nappletInfos` (line 583) was retained — it is the backing array used by the new loop via `.find()`.

## Decisions Made

- Chose `nappletInfos.find(e => e.name === napplet.name)` over index-based zip (DEMO_NAPPLETS.map order matches nappletInfos array, but name-based lookup is more explicit and defensive)
- Comment left in Path B branch documenting the stale guard removal with phase attribution — intent is to maintain an audit trail consistent with Phase 20's original comment pattern
- Build filter corrected from `@kehto/demo-app` (PLAN.md) to `@kehto/demo` (actual package.json name) — documented deviation

## Deviations from Plan

**1. [Rule 1 - Bug] Build filter name corrected**
- **Found during:** Task 1 verification step
- **Issue:** PLAN.md specified `pnpm --filter @kehto/demo-app build` but the package name in `apps/demo/package.json` is `@kehto/demo`
- **Fix:** Used `pnpm --filter @kehto/demo build` — build exited 0 with this filter
- **Files modified:** none (documentation correction only)
- **Verification:** Build output shows `> @kehto/demo@0.0.1 build`

All other plan directives executed exactly as written.

## Known Stubs

None — all 10 napplets are now fully wired through the data-driven loop. No hardcoded empty values or placeholder text introduced.

## Issues Encountered

Suite-level flakiness (pre-existing, not introduced by this plan): `demo-node-inspector.spec.ts:50` and `media-controller.spec.ts:72` occasionally fail due to timing in parallel Playwright workers. Both confirmed flaky against the pre-change baseline via `git stash` + `pnpm test:e2e` comparison. Not caused by this plan's changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DEMO-01 fix is committed and verified: all 10 napplets will now display 'authenticated' status in the outer topology DOM when their NappletInfo.authenticated flag flips true
- Ready for Plan 29-02: DEMO-02 investigation — media Play/Pause behavior after this fix, manual UAT at `:4174`
- E2E-15 automated regression spec (`demo-concurrent-boot.spec.ts`) remains Phase 31 scope

---
*Phase: 29-concurrent-boot-auth-fix-demo-stability*
*Completed: 2026-04-19*
