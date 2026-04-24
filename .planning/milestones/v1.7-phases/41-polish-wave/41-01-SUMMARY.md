---
phase: 41
plan: "01"
subsystem: nip66
tags: [nip66, demo, aggregator, stop, lifecycle, kind-30166]
dependency_graph:
  requires: []
  provides: [Nip66Aggregator.stop, createMockNip66Pool, nip66-suggestions-list]
  affects: [apps/demo, packages/nip66]
tech_stack:
  added: []
  patterns: [closure-scoped teardown, queueMicrotask fixture fan-out, setInterval polling]
key_files:
  created:
    - .changeset/phase-41-nip66-stop.md
  modified:
    - packages/nip66/src/index.ts
    - packages/nip66/src/index.test.ts
    - apps/demo/src/mock-relay-pool.ts
    - apps/demo/src/shell-host.ts
    - apps/demo/index.html
    - apps/demo/src/main.ts
    - apps/demo/package.json
decisions:
  - "getNip66Suggestions returns Array.from(aggregator.getRelaySet()) — plain string[] snapshot, empty array before events arrive (not null)"
  - "stop() preserves accumulated relaySet state — teardown only, not reset"
  - "_nip66Aggregator module-level let in shell-host.ts exported via getNip66Aggregator() accessor"
  - "main.ts owns aggregator start/stop lifecycle for symmetric ownership pairing"
metrics:
  duration: "4m"
  completed: "2026-04-24"
  tasks_completed: 2
  files_changed: 7
---

# Phase 41 Plan 01: NIP-66 Demo Integration — stop() + Live Wiring Summary

**One-liner:** `Nip66Aggregator.stop()` added with Vitest coverage; demo wired end-to-end with 3 kind-30166 fixtures, live `getNip66Suggestions`, `#nip66-suggestions-list` panel, and `beforeunload` cleanup.

## What Was Built

### Task 1: Nip66Aggregator.stop() + Vitest coverage + changeset (NIP66-06)

Added `stop(): void` to the `Nip66Aggregator` interface and implementation:

```typescript
// packages/nip66/src/index.ts (final interface — lines 81–119):
export interface Nip66Aggregator {
  start(): void;
  resync(): void;
  stop(): void;  // NEW — idempotent teardown, preserves accumulated state
  getRelaySet(): ReadonlySet<string>;
  getRelaysSupportingNip(nip: number): string[];
  relaySupportsNip(url: string, nip: number): boolean;
}
```

Implementation (closure-scoped, lines ~202-207):
```typescript
function stop(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
```

Final index.ts line count: **226 lines** (up from 206).

Tests 10–12 added, all 12 pass:
- Test 10: `stop()` after `start()` — unsubscribeCalls=1, relaySet preserved
- Test 11: `stop()` without `start()` — no-op, no throw, 0 calls
- Test 12: `start()` after `stop()` — re-subscribes (subscribeCalls=2)

Changeset: `.changeset/phase-41-nip66-stop.md` with `@kehto/nip66: minor`.

### Task 2: Mock pool + shell-host wiring + panel DOM + main.ts lifecycle (NIP66-07, D5, D6, D8)

**3 kind-30166 fixture URLs** (for E2E-26 reference):
```
wss://relay.fixture-one.test    (N-tags: 1, 11)
wss://relay.fixture-two.test    (N-tags: 44)
wss://relay.fixture-three.test  (N-tags: 9, 50)
```

All emitted via `queueMicrotask` after `subscribe()` returns — matches real relay async behaviour.

**`createMockNip66Pool()`** exported from `apps/demo/src/mock-relay-pool.ts` — `Nip66RelayPool`-shaped adapter.

**`createDemoHooks()`** in `shell-host.ts` now:
- Instantiates `createNip66Aggregator({ pool: createMockNip66Pool(), bootstrap: ['wss://demo-monitor.local'] })`
- Returns `getNip66Suggestions: () => Array.from(nip66Aggregator.getRelaySet())` (not `null`)
- Exports `getNip66Aggregator()` accessor

**`#nip66-suggestions-list`** panel added to `apps/demo/index.html` (outside any iframe):
- `<section id="nip66-panel">` with `<ul id="nip66-suggestions-list">`
- Initial placeholder: `<li>no suggestions yet</li>` — replaced on first poll

**`main.ts`** NIP-66 lifecycle block:
- `_nip66Aggregator.start()` at boot
- `setInterval` poll (100ms, max 10 attempts) renders `<li>` entries
- `window.addEventListener('beforeunload', () => { clearInterval(nip66PollId); _nip66Aggregator.stop(); })` (D8)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c0f1a44 | feat(41-01): add Nip66Aggregator.stop() with Vitest coverage + changeset |
| 2 | 43a0be4 | feat(41-01): wire nip66 demo integration — mock pool, shell-host, panel DOM, main.ts lifecycle |

## Deviations from Plan

None — plan executed exactly as written.

The only deviation from the mechanical plan text: `pnpm --filter @kehto/nip66 test` failed because the filter-level test runner used a different config path. Used `pnpm vitest run packages/nip66/src/index.test.ts` from root instead — functionally identical outcome.

## Verification Results

- `pnpm vitest run packages/nip66/src/index.test.ts`: 12/12 tests pass
- `pnpm --filter @kehto/nip66 build`: clean, dist/index.d.ts includes `stop(): void`
- `pnpm --filter @kehto/demo build`: clean build (106 modules, no TS errors)
- `pnpm type-check`: 11 tasks successful
- `grep -n 'stop()' packages/nip66/src/index.ts`: 2 matches (interface + impl)
- `grep -n 'kind: 30166' apps/demo/src/mock-relay-pool.ts`: 3 matches
- `grep -n 'getNip66Suggestions.*null'`: no match (stub gone)
- `grep -n 'aggregator.stop\|_nip66Aggregator.stop' apps/demo/src/main.ts`: 1 match (beforeunload)
- `nip66-suggestions-list` present in both index.html and main.ts

## Known Stubs

None — all NIP-66 integration points are wired live.

## Self-Check: PASSED
