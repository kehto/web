---
phase: 20-expanded-domain-napplets
plan: "04"
subsystem: demo-napplets
tags: [napplet, theme-switcher, NAP-08, postMessage, outbound-only]
dependency_graph:
  requires:
    - 19-core-domain-napplets (composer/toaster patterns)
  provides:
    - apps/demo/napplets/theme-switcher/ (5-file napplet skeleton)
    - outbound demo.publishTheme postMessage shape consumed by Plan 20-06
  affects:
    - Plan 20-06 (demo host installs listener for demo.publishTheme)
    - Plan 20-07 (anti-term grep: 0 window.addEventListener verified here)
tech_stack:
  added: []
  patterns:
    - D-04 storage.getItem AUTH probe (same as composer/preferences/toaster)
    - Plan 19-03 SDK gap exemption — outbound parent-frame postMessage only
key_files:
  created:
    - apps/demo/napplets/theme-switcher/package.json
    - apps/demo/napplets/theme-switcher/vite.config.ts
    - apps/demo/napplets/theme-switcher/tsconfig.json
    - apps/demo/napplets/theme-switcher/index.html
    - apps/demo/napplets/theme-switcher/src/main.ts
  modified: []
decisions:
  - "theme-switcher is OUTBOUND-ONLY: no window message listener installed; buttons use element.addEventListener('click')"
  - "Single dispatchTheme() helper is the sole window.parent.postMessage call site (1 occurrence in live code)"
  - "Empty aggregateHash acceptable per Phase 18 decision (VITE_DEV_PRIVKEY_HEX not set in env)"
metrics:
  duration: "176s"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 5
---

# Phase 20 Plan 04: Theme-Switcher Napplet Summary

**One-liner:** theme-switcher napplet with 3 preset buttons (light/dark/custom) that dispatch outbound `{ type: 'demo.publishTheme', theme }` postMessages to the demo host (Plan 20-06 listener).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create theme-switcher scaffolding (package.json, vite.config.ts, tsconfig.json, index.html) | 215fb1a |
| 2 | Implement theme-switcher src/main.ts (3 button handlers + outbound postMessage) | b21cf9e |

## What Was Built

### postMessage Envelope Shape (Plan 20-06 host listener reads this)

```typescript
window.parent.postMessage({ type: 'demo.publishTheme', theme }, '*');
```

Where `theme` is one of:

```typescript
// LIGHT_THEME
{ colors: { background: '#fafafa', text: '#0a0a0a', primary: '#5a3aff' } }

// DARK_THEME
{ colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' } }

// Custom (from #theme-custom-color picker)
{ colors: { background: '<picker-value>', text: '#e0e0e0', primary: '#7aa2f7' } }
```

The plan 20-06 host listener filters for `event.data.type === 'demo.publishTheme'` and calls `relay.publishTheme(event.data.theme)` to fan-out `theme.changed` envelopes to all registered napplets.

### DOM Contract (Plan 20-07 spec assertions)

| Element ID | Default | After auth | On button click |
|------------|---------|------------|-----------------|
| `#theme-status` | `connecting...` | `authenticated` | (unchanged) |
| `#theme-light-btn` | `data-active` absent | — | `data-active='true'` when active |
| `#theme-dark-btn` | `data-active` absent | — | `data-active='true'` when active |
| `#theme-custom-btn` | `data-active` absent | — | `data-active='true'` when active |

Clicking any button sets `data-active='true'` on the target and `data-active='false'` on the other two (via `setActive()` helper).

### Status Sentinel Contract

- `'connecting...'` — HTML default (before `init()` runs)
- `'authenticated'` — after `storage.getItem('theme-switcher-auth-probe')` resolves/rejects
- `'auth failed'` — if `init()` throws unexpectedly

### Anti-Term Grep Evidence (OUTBOUND-ONLY)

```
grep -c "window.addEventListener" apps/demo/napplets/theme-switcher/src/main.ts
→ 0  (CONFIRMED — no global message listener installed)

grep -c "window.parent.postMessage" apps/demo/napplets/theme-switcher/src/main.ts
→ 1  (CONFIRMED — single dispatch helper)

grep -c "demo.publishTheme" apps/demo/napplets/theme-switcher/src/main.ts
→ 4  (JSDoc description + log string + payload type literal + postMessage call)

grep -c "window.nostr|signer-service|BusKind" apps/demo/napplets/theme-switcher/src/main.ts
→ 0  (CONFIRMED)
```

theme-switcher is OUTBOUND-ONLY per Plan 19-07 anti-term rules. Unlike toaster (which required the Plan 19-03 exemption for its inbound notify.created/notify.listed reply handler), theme-switcher uses only element-scoped button click listeners and the single outbound postMessage — no global message listener exemption needed or installed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical behavior] JSDoc neutral phrasing to satisfy grep criteria**
- **Found during:** Task 2 verification
- **Issue:** Initial JSDoc draft mentioned exact anti-terms (`window.addEventListener`, `signer-service`, `BusKind`) in comment text, causing `grep -c` done-criteria counts to be non-zero
- **Fix:** Rewrote JSDoc to use neutral phrasing per Phase 18 decision ("Anti-feature JSDoc comments must use neutral phrasing to avoid false-positive grep matches")
- **Files modified:** `apps/demo/napplets/theme-switcher/src/main.ts`
- **Commit:** b21cf9e (included in same commit)

## Known Stubs

None — all DOM elements are wired and functional. The `napplet-aggregate-hash` in `dist/index.html` is empty because `VITE_DEV_PRIVKEY_HEX` is not set in the build environment; this is acceptable per Phase 18 decision (ACL keys on `dTag:''` consistently; E2E suite green confirms functional correctness).

## Self-Check: PASSED

- [x] `apps/demo/napplets/theme-switcher/package.json` exists with `@kehto/demo-theme-switcher`
- [x] `apps/demo/napplets/theme-switcher/vite.config.ts` exists with `nappletType: 'demo-theme-switcher'`
- [x] `apps/demo/napplets/theme-switcher/tsconfig.json` exists (byte-for-byte copy of composer's)
- [x] `apps/demo/napplets/theme-switcher/index.html` exists with DOM IDs: theme-status, theme-light-btn, theme-dark-btn, theme-custom-btn, theme-custom-color, theme-log
- [x] `apps/demo/napplets/theme-switcher/src/main.ts` exists (146 lines, > plan's min_lines: 60)
- [x] `pnpm --filter @kehto/demo-theme-switcher build` exits 0 and produces `dist/index.html`
- [x] Commit 215fb1a exists (Task 1)
- [x] Commit b21cf9e exists (Task 2)
