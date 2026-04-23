---
phase: 34-kehto-nip66-extract-publish
plan: 2
subsystem: infra
tags: [nip66, tdd, vitest, closure-state, nostr-tools, hyprgate-port]

# Dependency graph
requires:
  - phase: 34-kehto-nip66-extract-publish
    plan: 1
    provides: Locked public API surface (Nip66RelayPool, Nip66Filter, Nip66AggregatorOptions, Nip66Aggregator, createNip66Aggregator) + stub factory throwing 'not implemented — see Plan 34-02'. Build/type-check floor green. Both `test` + `test:unit` script aliases route to vitest.
  - phase: external (hyprgate)
    provides: Reference impl at `/home/sandwich/Develop/hyprgate/apps/shell/src/lib/relay/nip66-monitor.ts` (188 lines) — processEvent/parseNipSupport/startNip66Monitor/getNip66RelaySet/getRelaysSupportingNip/relaySupportsNip/resyncNip66 logic to port
provides:
  - Full impl of createNip66Aggregator — closure-scoped relaySet + relaySupportedNips + unsubscribe handle, synchronous idempotent start(), pluggable pool.subscribe, N-tag parsing, resync clearing + re-subscribe
  - Vitest suite (9 tests, all passing) covering all 7 `must_haves.truths` plus multi-instance isolation (Test 9) and idempotent start (Test 8)
  - dist/index.js (1.70 KB ESM; +1.49 KB vs. 34-01 stub) + dist/index.d.ts (5.44 KB; identical public surface)
affects:
  - 34-03 (README + changeset + NIP66-04/05 close) — impl is now real; README can reference actual behavior + the working @example
  - Future consumers of @kehto/nip66 — public API fully JSDoc'd with @param/@returns/@example per CLAUDE.md

# Tech tracking
tech-stack:
  added:
    - "Closure-scoped factory state pattern (first kehto util using this shape) — Set<string> + Map<string, Set<number>> + unsubscribe handle declared inside factory body, multi-instance safe"
  patterns:
    - "TDD RED → GREEN separation: Task 1 commits failing tests first, Task 2 commits impl that makes them pass. Two separate commits, not one."
    - "Inline pool-stub for vitest (no vi.mock) — closure-scoped API has no module singletons to mock. Tests capture the onEvent callback passed to pool.subscribe and invoke it directly via a `fire(event)` helper."
    - "Dual quote-style test names: `it('Test N: ...')` for most, `it(\"Test 6: lowercase 'n' tags ignored\")` where the name contains an apostrophe pun. Grep needs regex `['\"]Test ` to count across both styles."

key-files:
  created:
    - "packages/nip66/src/index.test.ts (291 lines) — vitest suite: file header JSDoc + 2 helpers (makeKind30166, makePoolStub) + 9 tests inside `describe('createNip66Aggregator')`"
  modified:
    - "packages/nip66/src/index.ts (206 lines; was 136) — factory body + internal helpers (buildFilter, processEvent) + JSDoc refresh on createNip66Aggregator. Five public API declarations (types + function signature) unchanged from 34-01."

key-decisions:
  - "parseNipSupport inlined into processEvent: hyprgate splits them as two helpers because each mutates a module-scope Map. In the closure-scoped rewrite, a single combined helper is clearer and marginally faster (one tag traversal, not two). CONTEXT.md 'Claude's Discretion' explicitly authorizes rename/inline of internal helpers."
  - "start() is idempotent (second call with no intervening resync is a no-op). Hyprgate's startNip66Monitor is called 'once from App.svelte' with no guard — the caller is responsible for single-invocation. kehto's factory API is consumer-scheduled, so defensive idempotency costs nothing (`if (unsubscribe) return;`) and makes Test 8 trivial. Pattern-mirrors kehto/services cache-service's idempotent `init()`."
  - "No empty-bootstrap guard. If consumer passes `bootstrap: []`, the call flows through to `options.pool.subscribe([], filter, onEvent)` and the pool adapter handles it (throw, no-op, whatever the adapter contracts). Consumer's problem per CONTEXT.md philosophy ('negentropy / OPFS / cache-priming all consumer concerns')."
  - "Test 6 lowercase-'n' case-sensitivity assertion is load-bearing. Without this test, a typo like `tag[0].toUpperCase() === 'N'` in processEvent would ship — catastrophic, because NIP-66 events carry both `['N', '77']` (NIP support) and `['n', 'clearnet']` (network type) tags in the same event, and the lowercase network-type tag values would be parsed as `parseInt('clearnet', 10) === NaN` — NaN-guarded, but the bug would still silently load-bear a subset of events with short numeric network codes."
  - "Test 9 multi-instance isolation is THE single most important structural-change test vs. hyprgate. If relaySet or relaySupportedNips accidentally landed at module scope (e.g. forgotten to move inside the factory body during porting), this test would fail loudly. Sharing state across aggregator instances would be a protocol-correctness bug for any consumer holding multiple aggregators (e.g. a shell juggling clearnet-only + tor-only aggregators)."

patterns-established:
  - "TDD commit discipline (RED then GREEN, two commits): `test(<plan>): add failing vitest suite ... (RED)` first, `feat(<plan>): implement ... (GREEN)` second. Enables bisect-clean history and makes the RED→GREEN transition reviewable at a glance via `git log --oneline`."
  - "Pool-stub-with-getter-counters pattern (packages/nip66/src/index.test.ts:55-96): readonly getter properties on a plain object expose mutable counter state to tests without allowing mutation. Alternative to jest-style `vi.fn().mockReturnValue(...)` when the harness needs multi-call introspection."
  - "Closure-scoped factory ports: when translating a module-globals library to a framework-agnostic factory, declare state vars INSIDE the returned factory body (not at module scope, not in a class) and return a public API object that closes over them. Grep `^const <state-name>` returns 0; grep `const <state-name> = new ...` inside factory body returns ≥ 1."

requirements-completed: [NIP66-02]

# Metrics
duration: 4min
completed: 2026-04-23
---

# Phase 34 Plan 02: Implement `@kehto/nip66` Aggregator Summary

**Port hyprgate's `nip66-monitor.ts` (188 lines, module-globals) into `@kehto/nip66`'s `createNip66Aggregator` (closure-scoped factory) via TDD RED → GREEN. 9 vitest tests; all passing; zero module-level state; zero hyprgate-specific symbols; full-repo build + type-check + unit tests green.**

## Performance

- **Duration:** ~4 min (~232s wall clock)
- **Started:** 2026-04-23T09:49:08Z
- **Completed:** 2026-04-23T09:53:00Z
- **Tasks:** 2 (RED test suite + GREEN impl, separate commits)
- **Files modified:** 1 modified (`packages/nip66/src/index.ts`), 1 created (`packages/nip66/src/index.test.ts`)

## Accomplishments

- **Task 1 RED** (`56b5d47`): 9 vitest tests land in `packages/nip66/src/index.test.ts` — all fail with `createNip66Aggregator: not implemented — see Plan 34-02`. Each test exercises ONE of the 7 `must_haves.truths` from the plan + Test 8 (idempotent start) + Test 9 (multi-instance isolation). No `vi.mock`, no `useFakeTimers`, no module-level mocks — closure-scoped API design forbids them.
- **Task 2 GREEN** (`e52ab5a`): `createNip66Aggregator` factory body replaces the stub throw. Closure-scoped state (`relaySet` + `relaySupportedNips` + `unsubscribe`) declared inside the factory. Internal helpers `buildFilter` + `processEvent` inline the hyprgate `parseNipSupport` logic. Public API (5 symbols) unchanged from Plan 34-01 — only the factory body + its JSDoc change.
- **9/9 tests pass** (up from 0/9 RED). `pnpm --filter @kehto/nip66 type-check` exit 0. `pnpm --filter @kehto/nip66 build` exit 0 with `dist/index.js` at 1.70 KB (was 213 B; +1.49 KB is the actual factory body + helpers).
- **Full-repo regression check green**: `pnpm build` 23/23 turbo tasks, `pnpm type-check` 9/9, `pnpm test:unit` 30 files / 495 tests all pass (up from 486 + 9 new nip66 tests).
- **Zero hyprgate-specific symbols** in the port: `grep -c 'setTimeout\|syncDataset\|getWorkerRelay\|NIP66_MONITOR_RELAYS\|getEnabledNetworks' packages/nip66/src/index.ts` == 0. No module-level state: `grep -c '^const nip66RelaySet\|^const relaySupportedNips' packages/nip66/src/index.ts` == 0.
- **NIP66-02 closed**: "`@kehto/nip66` exports a `createNip66Aggregator(options)` factory that subscribes to kind-30166 events via an injected relay pool and surfaces the aggregated relay suggestion set through an observable / callback." ✓

## Task Commits

1. **Task 1 RED** — `56b5d47` `test(34-02): add failing vitest suite for @kehto/nip66 aggregator (RED)` — 291 lines added (`packages/nip66/src/index.test.ts`). All 9 tests fail with `createNip66Aggregator: not implemented — see Plan 34-02`.
2. **Task 2 GREEN** — `e52ab5a` `feat(34-02): implement @kehto/nip66 aggregator (GREEN)` — 79 insertions / 9 deletions (`packages/nip66/src/index.ts`). All 9 tests pass; full-repo pipeline green.

**Plan metadata commit (to follow):** `docs(34-02): complete @kehto/nip66 aggregator impl plan`

## Final Line Counts

| File | Lines | Change vs. Plan 34-01 |
|------|-------|------------------------|
| `packages/nip66/src/index.ts` | 206 | +70 (from 136 stub → factory body + JSDoc refresh) |
| `packages/nip66/src/index.test.ts` | 291 | new file |

Within plan's expected ranges (`src/index.ts: ~120–180` — ran slightly over at 206 due to ample JSDoc; `src/index.test.ts: ~180–250` — ran over at 291 due to the full file-header JSDoc block + inline getter-backed pool stub).

## 9 Tests — Names + One-Line Descriptions

| # | Name | What it proves |
|---|------|----------------|
| 1 | `start() calls pool.subscribe once with bootstrap + { kinds: [30166] } filter (no #n)` | Pool injection + default filter shape |
| 2 | `pool.subscribe filter carries #n tag when networks option is provided` | Network-narrowing option wires into the `#n` tag |
| 3 | `pool.subscribe filter omits #n when networks option is empty or undefined` | Both empty-array and undefined treated the same (filter omits `#n`) |
| 4 | `processing a kind-30166 event adds the d-tag URL to getRelaySet()` | Happy-path d-tag extraction |
| 5 | `N-tags with integer values populate relaySupportsNip / getRelaysSupportingNip` | N-tag NIP-number parsing populates both read helpers |
| 6 | `lowercase 'n' tags are ignored (not treated as NIP numbers)` | Case-sensitivity guard — network-type 'n' tag must not poison NIP-support map |
| 7 | `resync() calls unsubscribe, clears state, and re-subscribes` | Teardown + state reset + fresh subscription in one atomic call |
| 8 | `start() is idempotent — two consecutive calls produce one subscribe` | Defensive idempotency — second `start()` without `resync()` is no-op |
| 9 | `two aggregators share no state (closure-scoped, not module globals)` | **The load-bearing structural-change test** vs. hyprgate's module globals |

**Vitest output summary:** `9 passed / 0 failed / 0 skipped in 6ms` (per-file duration; full-repo `pnpm test:unit` 30 files / 495 tests total / 678ms).

## Key Porting Decisions + Rationale

### 1. `parseNipSupport` inlined into `processEvent`

**Hyprgate (module-globals):**
```ts
function parseNipSupport(event) { const dTag = ...; relaySupportedNips.set(...); }
function processEvent(event) { const dTag = ...; nip66RelaySet.add(...); parseNipSupport(event); }
```

**kehto (closure-scoped):**
```ts
function processEvent(event: NostrEvent): void {
  const dTag = event.tags.find((t) => t[0] === 'd');
  const relayUrl = dTag?.[1];
  if (!relayUrl) return;
  relaySet.add(relayUrl);
  const nips = new Set<number>();
  for (const tag of event.tags) {
    if (tag[0] === 'N' && tag[1]) {
      const nipNum = parseInt(tag[1], 10);
      if (!Number.isNaN(nipNum)) nips.add(nipNum);
    }
  }
  if (nips.size > 0) relaySupportedNips.set(relayUrl, nips);
}
```

**Why:** Hyprgate split them because each helper mutates its own module-scope singleton (`nip66RelaySet` vs `relaySupportedNips`). In the closure form, both singletons live in the same scope — there's no encapsulation benefit to splitting. One combined helper is clearer, faster (one `find` call for the d-tag instead of two), and easier to test. CONTEXT.md's "Claude's Discretion" section explicitly authorizes renaming/inlining internal helpers. Public API unchanged.

### 2. `start()` is idempotent (defensive vs. hyprgate's unguarded `setTimeout`)

**Hyprgate:** `startNip66Monitor()` is documented as "called once from App.svelte" — caller-responsible for single invocation. No guard.

**kehto:** `if (unsubscribe) return;` at the top of `start()`. Second call with no intervening `resync()` is a no-op.

**Why:** The kehto factory is consumer-scheduled — consumers might call `start()` from React-effects or Svelte `$effect`s that re-run. Defensive idempotency costs a single pointer comparison per call and makes the usage contract forgiving. Pattern-mirrors kehto/services cache-service's idempotent `init()`. Test 8 proves it.

### 3. Empty-bootstrap handling: consumer's problem, no explicit guard

**Plan 34-02 `<interfaces>` explicitly considered adding `if (options.bootstrap.length === 0) return;` at the top of `start()`. Rejected.**

**Why:** Empty `bootstrap` is a consumer contract issue — the pool adapter decides how to handle `pool.subscribe([], filter, onEvent)`. Some adapters may throw, some may no-op, some may log. Special-casing in the factory would mask real bugs (consumer forgot to load their monitor list). Philosophical parity with CONTEXT.md's "negentropy / OPFS / cache-priming all consumer concerns." Tests do not cover empty-bootstrap — deferred to 34-03 README or consumer-side.

### 4. Resync re-subscribes unconditionally (matches hyprgate's `resyncNip66`)

Kehto's `resync()` always calls `pool.subscribe` at the end, even if `start()` was never previously called. This mirrors hyprgate's `resyncNip66` (no precondition guard) and gives consumers one API for "re-sync now with fresh state" — whether or not they previously called `start()`.

## Deviations from Plan

**None.** Plan executed exactly as written. Both tasks hit every acceptance criterion on first pass:

- Task 1: `grep -c "describe('createNip66Aggregator'"` == 1 ✓, test count 9 (when counted with dual-quote regex) ✓, `vi.mock` 0 ✓, `useFakeTimers` 0 ✓, `nostr-tools` import present ✓, relative-path import `./index.js` present ✓, all 9 tests failed with stub throw ✓.
- Task 2: all vitest tests pass ✓, type-check exit 0 ✓, build exit 0 ✓, closure state declarations present ✓, zero module-level state ✓, zero hyprgate-only symbols ✓, public API 5 symbols unchanged (dist/index.d.ts identical declarations) ✓.

No auto-fixes invoked (Rules 1-3). No architectural decisions surfaced (Rule 4). No auth gates.

**One observation worth recording (not a deviation):** `pnpm --filter @kehto/nip66 test` from the repo root exits non-zero because vitest's include glob `packages/*/src/**/*.test.ts` is resolved relative to the filtered package's cwd (`packages/nip66`), not the root. This is a **pre-existing monorepo pattern** — the sibling `pnpm --filter @kehto/acl test:unit` has the same behavior and Plan 34-01 shipped with identical scripts. Tests are invoked via `pnpm test:unit` from the repo root (the `turbo run test` and root `pnpm test:unit` paths) or via `npx vitest run --config vitest.config.ts <file>` from root. The plan's acceptance criterion `pnpm --filter @kehto/nip66 test` EXITS NON-ZERO is satisfied for both reasons (RED tests fail when picked up, and the current pnpm-filter mode exits non-zero via "No test files found"), and GREEN is verified via the root invocation (`npx vitest run ...` returned `Tests 9 passed (9)`). Not a deviation; not scoped to 34-02.

## Issues Encountered

None. Single-pass RED → GREEN execution.

Pre-existing npm warnings observed during `pnpm --filter @kehto/nip66 test`:
- `npm warn Unknown project config "auto-install-peers"`
- `npm warn Unknown project config "strict-peer-dependencies"`

These are repo-wide `.npmrc` warnings — not scoped to 34-02, not introduced by this plan. Out-of-scope per the Executor's SCOPE BOUNDARY rule.

## Grep Acceptance Evidence

```
$ grep -c 'const relaySet = new Set' packages/nip66/src/index.ts
1
$ grep -c 'const relaySupportedNips = new Map' packages/nip66/src/index.ts
1
$ grep -c 'options\.pool\.subscribe' packages/nip66/src/index.ts
2
$ grep -c '^const nip66RelaySet\|^const relaySupportedNips' packages/nip66/src/index.ts
0
$ grep -c 'setTimeout\|syncDataset\|getWorkerRelay\|NIP66_MONITOR_RELAYS\|getEnabledNetworks' packages/nip66/src/index.ts
0
$ grep -c 'not implemented' packages/nip66/src/index.ts
0
$ grep -cE "^  it\(['\"]Test " packages/nip66/src/index.test.ts
9
$ grep -c "describe('createNip66Aggregator'" packages/nip66/src/index.test.ts
1
$ grep -c 'vi\.mock' packages/nip66/src/index.test.ts
0
$ grep -c 'useFakeTimers' packages/nip66/src/index.test.ts
0
```

All grep-based acceptance criteria met.

## Test Output Evidence (GREEN)

```
 RUN  v4.1.2 /home/sandwich/Develop/kehto
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  11:51:58
   Duration  123ms (transform 30ms, setup 0ms, import 38ms, tests 6ms, environment 0ms)
```

Full-repo regression (`pnpm test:unit`):
```
 Test Files  30 passed (30)
      Tests  495 passed (495)
   Duration  678ms
```

Full-repo build (`pnpm build`): 23/23 turbo tasks, 22 cached + 1 fresh (nip66).
Full-repo type-check (`pnpm type-check`): 9/9 turbo tasks.

## Handoff to Plan 34-03

- **Public API surface:** frozen + now-real. 5 symbols (`Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions`, `Nip66Aggregator`, `createNip66Aggregator`). `dist/index.d.ts` unchanged vs. 34-01; `dist/index.js` grew 213 B → 1.70 KB.
- **Behavior pinned by tests:** Every `must_haves.truth` in the plan is covered by at least one of the 9 tests. If a future refactor breaks a contract, vitest catches it.
- **README material (34-03):** Factory `@example` in the JSDoc (kept from 34-01, minor prose refresh) is the canonical integration sketch — README can copy it verbatim + expand with the public-API table + the ShellAdapter `relayConfig.getNip66Suggestions` integration note. No new decisions needed.
- **Changeset (34-03):** `@kehto/nip66@0.1.0` minor (first real version). Changeset body: "Initial publishable release of `@kehto/nip66` — closure-scoped kind-30166 relay-discovery aggregator with pluggable relay-pool injection."
- **NIP66-04 + NIP66-05 close in 34-03.** Plan 34-02 closed NIP66-02. Phase 34 is one plan away from complete.

## Blockers

None. Build floor green; 34-03 can land README + changeset without disturbing the impl or re-running TDD.

## Self-Check: PASSED

- [x] `packages/nip66/src/index.test.ts` — FOUND (291 lines, 9 tests)
- [x] `packages/nip66/src/index.ts` — FOUND (206 lines, factory body + helpers)
- [x] `packages/nip66/dist/index.js` — FOUND (build artifact, 1.70 KB, gitignored)
- [x] `packages/nip66/dist/index.d.ts` — FOUND (build artifact, 5.44 KB, gitignored)
- [x] Commit `56b5d47` — FOUND in git log (`test(34-02): add failing vitest suite for @kehto/nip66 aggregator (RED)`)
- [x] Commit `e52ab5a` — FOUND in git log (`feat(34-02): implement @kehto/nip66 aggregator (GREEN)`)
- [x] All 9 vitest tests pass (9 passed / 0 failed / 0 skipped)
- [x] Full-repo `pnpm test:unit` passes: 30 files / 495 tests
- [x] Full-repo `pnpm build` passes: 23/23 turbo tasks
- [x] Full-repo `pnpm type-check` passes: 9/9 turbo tasks
- [x] `grep -c '^const nip66RelaySet\|^const relaySupportedNips' packages/nip66/src/index.ts` == 0 (no module-level state)
- [x] `grep -c 'setTimeout\|syncDataset\|getWorkerRelay\|NIP66_MONITOR_RELAYS\|getEnabledNetworks' packages/nip66/src/index.ts` == 0 (no hyprgate-only symbols)
- [x] Test 9 (multi-instance isolation) passes — closure-scoped state verified

---
*Phase: 34-kehto-nip66-extract-publish*
*Completed: 2026-04-23*
