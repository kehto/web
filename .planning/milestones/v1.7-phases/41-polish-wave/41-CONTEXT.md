# Phase 41: Polish Wave - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Smart discuss (grey-area batch — all 8 recommendations accepted by user)

<domain>
## Phase Boundary

Three independent carryover items ship in parallel as the polish wave: `@kehto/nip66` demo wiring goes live with mock kind-30166 fixtures, `@kehto/wm` gains structural primitives for consumer layout implementations, and `HostCacheBridge` naming parity closes the kehto#1 cosmetic gap. All low-risk, all independent, no new NUB domains.

</domain>

<decisions>
## Implementation Decisions

### Grey Area 1: `@kehto/wm` LayoutStrategy API
- **D1**: `LayoutStrategy.arrange(windows: ReadonlyArray<WindowState>, containerRect: Rect): ReadonlyArray<WindowPlacement>` — pure function, no side effects.
- **D2**: `WindowState = { id: WindowId; focused: boolean; minimized: boolean; rect: Rect }` — minimal universal fields.
- **D3**: `WindowPlacement = { id: WindowId; rect: Rect }` — id+rect only; consumers track focus/stacking externally.
- **D4**: `createWmService` default strategy = **no-op identity** (returns windows unchanged). Replaces the Phase 35 throwing stub. Consumers can ship working shells before implementing real layouts.

### Grey Area 2: nip66 demo integration
- **D5**: UI surface = **shell-chrome panel** (not inside a napplet). New DOM element with id `#nip66-suggestions-list` rendering the aggregator output as an unordered list of relay URLs + metadata.
- **D6**: Mock fixture count = **3 kind-30166 events** hardcoded in `apps/demo/src/mock-relay-pool.ts`.
- **D7**: E2E-26 assertion = `page.waitForFunction(() => document.querySelectorAll('#nip66-suggestions-list li').length >= 1, null, { timeout: 5000 })`. Single test.
- **D8**: `Nip66Aggregator.stop()` invoked on `window.addEventListener('beforeunload', () => aggregator.stop())` + unit-tested in Vitest.

### Claude's Discretion
- Exact DOM layout of the `#nip66-suggestions-list` panel (list vs table; styling); follow existing demo shell chrome conventions
- File size budget for `packages/wm/src/index.ts` (<200 lines per WM-06) — Claude packages helper types if it runs close to the limit
- Exact wording of JSDoc @example blocks
- Order of parallel plan execution within Wave 1 (all 3 items are independent)
- Whether to introduce a separate Vitest file for `Nip66Aggregator.stop()` or co-locate with existing nip66 tests

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (pre-existing)
- `packages/wm/src/index.ts` — Phase 35 WM-01/02/03 skeleton + `createWmService` throwing stub (to replace with no-op default)
- `packages/nip66/src/index.ts` — Phase 34 `createNip66Aggregator` + `Nip66Aggregator` interface (add `stop()` method)
- `packages/services/src/cache-service.ts` — v1.2+ `createCacheService` + `CacheServiceOptions` (add `HostCacheBridge = CacheServiceOptions` alias)
- `apps/demo/src/mock-relay-pool.ts` — existing mock pool (extend with kind-30166 fixtures)

### Established Patterns
- Additive type aliases (HostKeysBridge, HostMediaBridge from v1.4) — consumers can migrate opt-in
- `beforeunload` cleanup pattern for resource-owning factories
- mock-relay-pool fixture extension pattern (v1.3+)

### Integration Points
- `createDemoHooks()` exposes `getNip66Suggestions` (currently `() => null`; Phase 41 wires to real aggregator)
- `apps/demo/index.html` gets a new `<section id="nip66-panel">` — chrome DOM, outside any iframe
- `apps/demo/src/main.ts` instantiates the aggregator via `createNip66Aggregator({ pool: mockRelayPool })` + populates the panel

</code_context>

<specifics>
## Specific Ideas

- Polish-phase discipline: each item has a small changeset (CACHE = patch; WM = patch; nip66 = minor for new `stop()` method). Single `.changeset/phase-41-polish-wave.md` covering all three OR three separate changesets — Claude decides based on release-note clarity.
- `HostCacheBridge = CacheServiceOptions` — NEVER delete `CacheServiceOptions`. It remains the primary name; `HostCacheBridge` is aliasing for cross-pattern consistency with HostKeysBridge / HostMediaBridge.
- Phase 41 close iteration loop expected: **72 passed / 0 failed / 0 skipped** (71 entering Phase 41 + 1 new E2E-26 nip66-suggestions spec).

</specifics>

<deferred>
## Deferred Ideas

- Concrete layout algorithms in `@kehto/wm` (BSP, master-stack, floating) — consumer-driven; stays out of `@kehto/wm`
- Default BSP-style strategy built into kehto — anti-feature; consumers build their own
- Live NIP-66 aggregation against real relays in demo — mock fixtures sufficient
- `@kehto/wm` multiple strategies per service (strategy registry) — single strategy is enough

</deferred>

---

*Phase: 41-polish-wave*
*Context gathered: 2026-04-24 via smart-discuss (8 decisions accepted wholesale)*
