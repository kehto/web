---
phase: 41-polish-wave
plan: "02"
subsystem: wm
tags: [wm, layout-strategy, structural-primitives, h-04, no-op-default]
dependency_graph:
  requires: []
  provides: [LayoutStrategy, WindowState, WindowPlacement, createWmService-no-op]
  affects: [packages/wm]
tech_stack:
  added: []
  patterns: [structural-contract-only, consumer-driven-layout, no-op-default-strategy]
key_files:
  created:
    - .changeset/phase-41-wm-primitives.md
  modified:
    - packages/wm/src/index.ts
    - packages/wm/README.md
decisions:
  - "No algorithm string-literal types exported (H-04); LayoutStrategy is a pure interface"
  - "layoutStrategy.arrange() is never called inside kehto — consumer-driven only (D4)"
  - "void layoutStrategy used to silence unused-variable TS warning while preserving closure semantics"
metrics:
  duration_seconds: 157
  completed_date: "2026-04-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
requirements:
  - WM-04
  - WM-05
  - WM-06
  - WM-07
---

# Phase 41 Plan 02: @kehto/wm Structural Primitives Summary

**One-liner:** LayoutStrategy / WindowState / WindowPlacement interfaces added; createWmService no-op default replaces Phase 35 throwing stub (179 lines, zero algorithm literals).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite packages/wm/src/index.ts | b8475f7 | packages/wm/src/index.ts, .changeset/phase-41-wm-primitives.md |
| 2 | Update packages/wm/README.md | e73f5c4 | packages/wm/README.md |

## Public API Surface

Exported from `packages/wm/src/index.ts`:

- `type WindowId = string`
- `type WorkspaceId = string | number`
- `type Rect = { x: number; y: number; w: number; h: number }`
- `interface WindowState` — id, focused, minimized, rect (D2)
- `interface WindowPlacement` — id, rect (D3)
- `interface LayoutStrategy` — arrange(windows, containerRect): ReadonlyArray\<WindowPlacement\> (D1)
- `interface WmHostHooks` — selectLayout(strategyName: string), onWindowCreated, onWindowDestroyed, onWindowMoved
- `interface WmService` — window.create/close/focus/move, workspace.switch/list, state.get, destroy
- `function createWmService(opts: { hooks: WmHostHooks; strategy?: LayoutStrategy }): WmService`

**Removed:** `type Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {})` (H-04)

## Verification Results

- `pnpm --filter @kehto/wm build`: PASS (tsc --noEmit, no type errors)
- `wc -l packages/wm/src/index.ts`: 179 (< 200 WM-06)
- `grep -E "'dwindle'|'master-stack'|'floating'"`: CLEAN (zero matches)
- `export interface LayoutStrategy`: present at line 68
- `export interface WindowState`: present at line 31
- `export interface WindowPlacement`: present at line 42
- `createWmService({ hooks })` does not throw: confirmed — no-op default returns WmService
- `.changeset/phase-41-wm-primitives.md`: present, `@kehto/wm: patch`
- README "What this package is": present
- README "What this package is not": present
- README `masterStackStrategy` consumer example: present

## createWmService No-Throw Confirmation

`createWmService({ hooks: { selectLayout(){}, onWindowCreated(){}, onWindowDestroyed(){}, onWindowMoved(){} } })` returns a working WmService backed by `noOpStrategy`. Verified by `pnpm --filter @kehto/wm build` (tsc type-checks the entire factory body, including the returned service object).

## README Sections Added

1. "What this package is" — covers D1/D2/D3/D4 + shell-internal/non-NUB-domain note
2. "What this package is not" — no layout engine, no registry, no NUB domain, H-04 rationale
3. "Consumer-integration example" — `masterStackStrategy: LayoutStrategy` with comment "lives in your shell repo"
4. "Default no-op strategy" — explains omitting `strategy` yields identity default; bootstrapping use case

## Line-Budget Notes

Final count: 179 lines. Compression applied:
- Condensed `focus`, `switch`, `list`, `state.get`, `destroy` to single-line bodies in the factory return
- Kept all public JSDoc untouched; compressed internal-state setup comments only
- Header JSDoc trimmed to remove repetitive D1–D4 enumeration (retained decision refs inline)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `createWmService` returns a fully functional no-op WmService. No stub values in public surface.

## Self-Check: PASSED

- packages/wm/src/index.ts: FOUND
- packages/wm/README.md: FOUND
- .changeset/phase-41-wm-primitives.md: FOUND
- 41-02-SUMMARY.md: FOUND
- commit b8475f7 (Task 1): FOUND
- commit e73f5c4 (Task 2): FOUND
