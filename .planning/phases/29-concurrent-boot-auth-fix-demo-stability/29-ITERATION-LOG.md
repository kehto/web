# Phase 29 Iteration Log

**Phase:** 29-concurrent-boot-auth-fix-demo-stability
**Milestone:** v1.5
**Scope:** DEMO-01 + DEMO-02 (Plans 29-01 and 29-02)
**Note:** Phase 29 ships zero new Playwright specs — E2E-15 is Phase 31 scope per 29-CONTEXT.md Area 2.

---

## Iteration 1 — post-29-01 (DEMO-01 fix)

**Plan:** 29-01 — refreshAclPanelsIfNeeded() rewritten as data-driven DEMO_NAPPLETS loop
**Commit:** d27133b
**Date:** 2026-04-19

**Build:**
```
> @kehto/demo@0.0.1 build /home/sandwich/Develop/kehto/apps/demo
> vite build

vite v6.4.2 building for production...
dist/assets/main-CLoUiXuP.js   276.40 kB │ gzip: 89.02 kB
built in 855ms
```

**E2E result:**
```
49 passed (18.6s)
```

**Result:** 49 passed / 0 failed / 0 skipped — v1.4 baseline preserved.

**Delta:** 0 new specs (Phase 29 ships no new Playwright specs per 29-CONTEXT.md Area 2 Q1).

---

## Iteration 2 — post-29-02 (DEMO-02 cascade-fixed confirmation)

**Plan:** 29-02 — DEMO-02 no-code-change confirmation (bucket: cascade-fixed)
**Commit:** (docs-only)
**Date:** 2026-04-19

**E2E result:**
```
49 passed (19.5s)
```

**Result:** 49 passed / 0 failed / 0 skipped — baseline unchanged (no code change in 29-02).

**Delta:** 0 new specs. No delta expected — cascade-fixed bucket means no code was modified.

---

## Manual UAT Evidence

**Method:** Automated via Playwright MCP (equivalent coverage to manual browser UAT)
**Reference:** `.planning/phases/29-concurrent-boot-auth-fix-demo-stability/29-02-DIAGNOSTIC.md`

**DEMO-01 gate:** PASSED — all 10 napplets (`chat`, `bot`, `composer`, `preferences`, `toaster`, `feed`, `profile-viewer`, `theme-switcher`, `hotkey-chord`, `media-controller`) showed `authenticated` (green `rgb(57, 255, 20)`) within 12s of boot.

**DEMO-02 Play/Pause observations (post-29-01, Playwright MCP):**

| Observation | Play | Pause |
|-------------|------|-------|
| A: `#media-controller-status` | `session-ready` → `playing` | `playing` → `paused` |
| B: ACL denials | none | none |
| C: `navigator.mediaSession.playbackState` | `'none'` → `'playing'` | `'playing'` → `'paused'` |

**Bucket:** `cascade-fixed` — DEMO-02 resolved as side effect of DEMO-01 fix. No Task 2 code change needed.

---

## Phase 29 Close

**DEMO-01:** Complete (Plan 29-01, commit d27133b)
**DEMO-02:** Complete (cascade-fixed by Plan 29-01; confirmed in Plan 29-02)
**E2E baseline:** 49/0/0 (unchanged — no new specs in Phase 29)
**Next phase:** Phase 30 — Shell UI State Wiring (depends on Phase 29)
