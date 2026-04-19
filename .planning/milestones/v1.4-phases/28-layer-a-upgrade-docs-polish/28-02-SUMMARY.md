---
phase: 28-layer-a-upgrade-docs-polish
plan: 02
subsystem: docs
tags: [docs, readme, keys-service, media-service, host-bridge]
dependency_graph:
  requires: [28-01]
  provides: [DOCS-05]
  affects: [packages/services/README.md]
tech_stack:
  added: []
  patterns: [verbatim-interface-copy, host-bridge-sidebar, demo-cross-ref]
key_files:
  created: []
  modified:
    - packages/services/README.md
decisions:
  - "HostKeysBridge + HostMediaBridge interface blocks copied verbatim from source files to README; JSDoc comments preserved for IDE consumer clarity"
  - "Factory signatures written on single line in README code fences to satisfy grep-based acceptance criteria (createKeysService(options?) on one line)"
  - "Title tagline (stub) annotations scrubbed in addition to the plan-specified Overview + Public API stale language — same fix, broader cleanup"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-19T18:32:57Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 28 Plan 02: DOCS-05 — Services README Keys + Media Sections Summary

Extends `packages/services/README.md` with first-class documentation for the Phase 26 + Phase 27 real backends: two new H2 sections (`## Keys Service`, `## Media Service`) containing factory signatures, options tables, verbatim host-bridge interface blocks, runnable usage examples, custom-bridge guidance, and demo napplet cross-references. Stale v1.3 stub-era language scrubbed from Overview, Public API, and title tagline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Append ## Keys Service + ## Media Service H2 sections; refresh stale (stub in v1.3) language | 1433a3b | packages/services/README.md |

## What Was Built

`packages/services/README.md` now has two new top-level H2 sections inserted between `## Quick Start` and `## Public API`:

**## Keys Service** (lines 48-152):
- Factory signature: `createKeysService(options?: KeysServiceOptions): ServiceHandler & { destroy(): void }`
- `KeysServiceOptions` 3-field table: onForward, listenerTarget, hostBridge
- `HostKeysBridge` interface block copied verbatim from `packages/services/src/keys-service.ts:101-133` (JSDoc + 3 members: subscribe, registerGlobalHotkey?, onGlobalHotkey?)
- Default browser snippet: `createKeysService({ onForward })` + `runtime.registerService('keys', keys)`
- Custom bridge snippet: Electron `globalShortcut` bridge implementing `HostKeysBridge`
- "When to plug a custom bridge" sidebar (prose, no code) — covers Electron/Tauri/OS global hotkeys/X11/macOS Carbon/Win32 RegisterHotKey
- "See the demo" line linking to `apps/demo/napplets/hotkey-chord/src/main.ts`

**## Media Service** (lines 154-286):
- Factory signature: `createMediaService(options?: MediaServiceOptions): ServiceHandler & { destroy(): void }`
- `MediaServiceOptions` 8-field table: onSessionCreate, onState, onSessionDestroy, onSessionUpdate, onCapabilities, mediaSessionTarget, documentTarget, hostBridge
- `HostMediaBridge` interface block copied verbatim from `packages/services/src/media-service.ts:147-195` (JSDoc + 5 members: setMetadata, setPlaybackState, onAction, setActiveSession?, destroySession?)
- Default browser snippet: `createMediaService({ onSessionCreate, onState })` + `runtime.registerService('media', media)`
- Custom bridge snippet: Electron IPC bridge implementing `HostMediaBridge`
- "When to plug a custom bridge" sidebar (prose, no code) — covers Electron IPC/MPRIS/macOS MediaRemote/AVPlayer/ExoPlayer
- "See the demo" line linking to `apps/demo/napplets/media-controller/src/main.ts`

**Stale language updates:**
- Overview bullet: replaced "createKeysService and createMediaService are stub-only in v1.3..." with v1.4 real-backend description
- Public API `### Keys NUB (stub in v1.3)`: updated to real Phase 26 envelope surface (keys.registerAction / keys.unregisterAction / keys.forward + keys.action push)
- Public API `### Media NUB (stub in v1.3)`: updated to real Phase 27 envelope surface (media.session.create / update / destroy / media.state / media.capabilities + media.command push)
- Title tagline: removed "(stub)" annotations from keys and media entries

## Acceptance Criteria Verification

All greps passed:

```
grep -cE "^## Keys Service$"                           → 1 ✓
grep -cE "^## Media Service$"                          → 1 ✓
grep -c "export interface HostKeysBridge"               → 1 ✓
grep -c "export interface HostMediaBridge"              → 1 ✓
grep -c "subscribe(chord: string, callback"             → 1 ✓
grep -c "setMetadata(sessionId: string, metadata: MediaMetadata)" → 1 ✓
grep -c "createKeysService(options"                    → 1 ✓
grep -c "createMediaService(options"                   → 1 ✓
grep -c "apps/demo/napplets/hotkey-chord/src/main.ts"  → 1 ✓
grep -c "apps/demo/napplets/media-controller/src/main.ts" → 1 ✓
grep -c "When to plug a custom bridge"                 → 2 ✓
grep -c "import { createKeysService } from '@kehto/services'" → 2 ✓
grep -c "import { createMediaService } from '@kehto/services'" → 2 ✓
grep -c "(stub in v1.3)|are stub-only in v1.3"         → 0 ✓
grep -c "keys.registerAction|keys.action|keys.unregisterAction" → 5 ✓
grep -c "media.session.create|media.command|media.state" → 8 ✓
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Factory signatures written single-line in README code fences**
- **Found during:** Task 1 (post-write acceptance grep check)
- **Issue:** The plan's PLAN.md draft showed the factory signature split across two lines (`createKeysService(\n  options?:`), but the acceptance grep `grep -c "createKeysService(options"` requires `(options` on the same line to match. The multiline form returned 0.
- **Fix:** Collapsed both factory signatures to single-line form in the README code fences: `export function createKeysService(options?: KeysServiceOptions): ServiceHandler & { destroy(): void };`
- **Files modified:** packages/services/README.md
- **Commit:** 1433a3b (same task commit)

**2. [Rule 2 - Missing] Title tagline (stub) annotations scrubbed**
- **Found during:** Task 1 (visual review)
- **Issue:** Title tagline still read "keys (stub), media (stub)" after the plan-specified Overview + Public API updates; all other stub language was removed but the one-liner description remained inaccurate.
- **Fix:** Removed "(stub)" from keys and media entries in the tagline.
- **Files modified:** packages/services/README.md
- **Commit:** 1433a3b (same task commit)

## Known Stubs

None — all content in the two new sections is wired to real Phase 26 + Phase 27 backends. No placeholder text, no TODO markers, no hardcoded empty values.

## Self-Check: PASSED

- `packages/services/README.md` — FOUND at correct path
- Commit `1433a3b` — FOUND in git log
- All 16 acceptance grep criteria — PASSED (verified above)
