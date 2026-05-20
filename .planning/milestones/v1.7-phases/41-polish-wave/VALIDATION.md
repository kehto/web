---
phase: 41-polish-wave
validated_at: 2026-05-20
validator: gsd-nyquist-auditor (retroactive — v1.8 Phase 43)
status: passed
score: 5/5
---

# Phase 41: Polish Wave — Retroactive Validation

## Validation Source
Validated against `.planning/milestones/v1.7-ROADMAP.md` Phase 41 Success Criteria (canonical) plus shipped evidence in the working tree and per-plan SUMMARY.md files under `.planning/milestones/v1.7-phases/41-polish-wave/`.

## Per-Criterion Verdicts

### Criterion 1: `getNip66Suggestions()` is live in the demo (not `() => null`); demo shell surfaces at least one relay suggestion from mock kind-30166 fixtures fed through `createNip66Aggregator` (asserted by `nip66-suggestions.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `apps/demo/src/shell-host.ts:714` returns `Array.from(nip66Aggregator.getRelaySet())` — live, not stub. Anti-stub scan: `grep 'getNip66Suggestions.*null' apps/demo/src/shell-host.ts` = 0 matches. `apps/demo/src/mock-relay-pool.ts:233-261` provides 3 kind-30166 fixtures via `createMockNip66Pool` (3 occurrences of `kind: 30166` at lines 237, 246, 255). `apps/demo/index.html:425` declares `<section id="nip66-panel">` with `<ul id="nip66-suggestions-list">` at line 432. `tests/e2e/nip66-suggestions.spec.ts` asserts wss:// URL surfaces within 5s. Recorded GREEN in `41-ITERATION-LOG.md` 72/0/0 close.

### Criterion 2: `Nip66Aggregator.stop()` method exists, disposes pool subscription + timers, and is tested via Vitest (M-03 resource-leak prevention).
- **Verdict:** PASS
- **Evidence:** `packages/nip66/src/index.ts` declares `stop(): void` on interface (line 98) and implementation (lines 202-207). `packages/nip66/src/index.test.ts` Tests 10-12 (lines 292-351) cover: after-start dispose, no-op without prior start, re-start after stop. 12/12 Vitest tests pass per `41-01-SUMMARY.md`. `apps/demo/src/main.ts:135-138` calls `aggregator.stop()` in `beforeunload` handler. Cross-verified `41-VERIFICATION.md` Observable Truth #2.

### Criterion 3: `@kehto/wm` exports `LayoutStrategy`, `WindowState`, and `WindowPlacement` with no concrete algorithm types in the public surface; `wc -l packages/wm/src/index.ts` < 200.
- **Verdict:** PASS
- **Evidence:** `packages/wm/src/index.ts` = 179 lines (behavioral spot-check `wc -l` confirms). All three interfaces present: `WindowState` (line 31), `WindowPlacement` (line 42), `LayoutStrategy` (line 68). Algorithm-literal anti-feature scan: `grep -E "'dwindle'|'master-stack'|'floating'" packages/wm/src/index.ts` = 0 matches. README has required "What this package is / is not" sections + `masterStackStrategy` consumer example marked "lives in your shell repo".

### Criterion 4: `createWmService` accepts `{ hooks, strategy? }` where `strategy` defaults to a no-op (returning windows unchanged) — no longer throws unconditionally.
- **Verdict:** PASS
- **Evidence:** `packages/wm/src/index.ts:135-179` declares `createWmService` factory using `opts.strategy ?? noOpStrategy`. `noOpStrategy` defined at line 110 (returns windows unchanged). Phase 35 `throw new Error(...)` stub replaced. Cross-verified `41-VERIFICATION.md` Observable Truth #4 and `41-02-SUMMARY.md`.

### Criterion 5: `packages/services/src/cache-service.ts` exports `type HostCacheBridge = CacheServiceOptions` as an additive alias; `CacheServiceOptions` export is preserved unchanged; changeset is `patch`.
- **Verdict:** PASS
- **Evidence:** `packages/services/src/cache-service.ts:73` declares `export type HostCacheBridge = CacheServiceOptions;` immediately following the preserved `CacheServiceOptions` interface (line 25, unchanged). `packages/services/src/index.ts:58` barrel re-exports `export type { CacheServiceOptions, HostCacheBridge } from './cache-service.js';`. `.changeset/phase-41-cache-alias.md` declares `@kehto/services: patch`. Cross-verified `41-VERIFICATION.md` Observable Truth #5.

## Summary
- Total criteria: 5
- PASS: 5
- FAIL: 0
- N/A: 0
- Overall: **passed** — all three independent polish items shipped cleanly: nip66 demo wiring is live with mock fixtures + E2E coverage, `@kehto/wm` exposes structural primitives only (179 lines, no algorithm literals), and `HostCacheBridge` alias is purely additive. E2E baseline 71 → 72 (+1 = nip66-suggestions). Milestone close at 72/0/0.

## Notes
Plan 41-04 included a human-verify checkpoint for nip66 panel visual fidelity that was auto-approved under `workflow._auto_chain_active=true` during milestone execution. The E2E gate (72/0/0) is real; visual confirmation remains a soft open item per `41-VERIFICATION.md` Human Verification Required section.
