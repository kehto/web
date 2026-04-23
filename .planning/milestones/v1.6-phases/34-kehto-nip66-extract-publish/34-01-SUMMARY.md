---
phase: 34-kehto-nip66-extract-publish
plan: 1
subsystem: infra
tags: [nip66, tsup, esm, workspace, nostr-tools, turbo]

# Dependency graph
requires:
  - phase: 32-nub-dep-consolidation
    provides: Established `@napplet/nub` consolidation floor — new package scaffold avoids split `@napplet/nub-*` peer deps entirely (CONTEXT.md Decision §NIP66-03 framework-agnostic)
  - phase: 00-foundation
    provides: Root `tsconfig.json`, `turbo.json`, `pnpm-workspace.yaml` (`packages/*` glob) — new workspace auto-registers
provides:
  - packages/nip66 workspace registered, publish-shaped, ESM-only, tsup build + turbo type-check green
  - @kehto/nip66@0.1.0 manifest with nostr-tools peer dep >=2.23.3 <3.0.0 (mirrors @kehto/shell range), vitest dev dep, both `test` and `test:unit` script aliases routing to shared vitest.config.ts
  - Locked public API surface per CONTEXT.md <specifics> — Nip66RelayPool, Nip66Filter, Nip66AggregatorOptions, Nip66Aggregator interfaces + createNip66Aggregator factory stub (throws 'not implemented — see Plan 34-02')
  - dist/index.js (213B ESM) + dist/index.d.ts (4.95KB) artifacts — downstream type-checks can resolve against the locked surface before Plan 34-02 ports the real logic
affects:
  - 34-02 (port hyprgate processEvent/parseNipSupport into closure-scoped state behind this locked factory signature)
  - 34-03 (README + changeset + NIP66-05 close)
  - 35 (WM skeleton can reference this scaffold pattern for a second new framework-agnostic package)
  - v1.7+ demo wiring (SimplePool adapter example already embedded in createNip66Aggregator @example)

# Tech tracking
tech-stack:
  added:
    - "@kehto/nip66 workspace (new publishable package, first kehto package with nostr-tools as sole peer dep)"
    - "nostr-tools NostrEvent type-only import in a kehto framework-agnostic util (precedent for future utils)"
  patterns:
    - "Framework-agnostic kehto util: zero @napplet/* deps, nostr-tools-only peer. Mirrors CONTEXT.md Decision §NIP66-03."
    - "Stub-first scaffolding: factory throws 'not implemented — see Plan N' sentinel; types lock the public surface; impl lands in follow-up plan against a green build floor."
    - "Both `test` and `test:unit` script aliases on new packages — quality-gate invocations (`pnpm --filter <pkg> test`) route correctly without downstream needing a second install."

key-files:
  created:
    - "packages/nip66/package.json (50 lines) — @kehto/nip66@0.1.0, ESM, tsup, nostr-tools peer dep, vitest dev dep, zero @napplet/* deps"
    - "packages/nip66/tsconfig.json (9 lines) — extends ../../tsconfig.json, lib ES2022+DOM+DOM.Iterable, rootDir src, outDir dist"
    - "packages/nip66/tsup.config.ts (9 lines) — verbatim mirror of packages/services/tsup.config.ts (entry src/index.ts, format esm, dts, sourcemap, clean)"
    - "packages/nip66/src/index.ts (136 lines) — stub barrel with 5 public API exports + JSDoc on every symbol + @example on factory"
  modified:
    - "pnpm-lock.yaml — new importer block for packages/nip66 (workspace auto-picked by packages/* glob)"

key-decisions:
  - "Stub factory throws sentinel `Error('createNip66Aggregator: not implemented — see Plan 34-02')` — decouples workspace-scaffolding risk from code-port risk; types lock the public surface now, impl lands in 34-02 against a green build floor."
  - "Both `test` and `test:unit` script aliases (quality-gate invocation `pnpm --filter @kehto/nip66 test` per CONTEXT.md routes correctly; `test:unit` preserved for monorepo consistency with sibling @kehto/* packages that only ship `test:unit`)."
  - "No default bootstrap relay list in package (even in stub comments) — CONTEXT.md Decision §'Bootstrap relay list': policy (which monitors are trusted?) belongs to the shell, not the library."
  - "NostrEvent imported as type-only (`import type { NostrEvent } from 'nostr-tools'`) — load-bearing under verbatimModuleSyntax; type-only imports are fully erased by tsup, keeping dist/index.js at 213B (stub body only)."
  - "5 public API symbols locked: Nip66RelayPool, Nip66Filter, Nip66AggregatorOptions, Nip66Aggregator, createNip66Aggregator. No internal helpers exported (parseNipSupport, processEvent, etc. — those land internal-only in 34-02)."

patterns-established:
  - "Framework-agnostic util manifest shape: ESM-only, nostr-tools sole peer, vitest dev dep, both test aliases, `repository.directory` set, keywords include domain + ecosystem (nostr, nip66, relay-discovery, kehto, napplet)."
  - "Stub-first discipline: full public API shape committed pre-implementation with types + throwing factory; downstream type-checks + turbo graph stay green through follow-up implementation plans."
  - "JSDoc with @example on every public export satisfies CLAUDE.md Code Conventions (`All public API exports have JSDoc with @param, @returns, @example`); factory @example doubles as README integration sketch."

requirements-completed: [NIP66-01, NIP66-03]

# Metrics
duration: 2min
completed: 2026-04-23
---

# Phase 34 Plan 01: Scaffold `@kehto/nip66` Workspace Summary

**New publishable `@kehto/nip66@0.1.0` workspace — ESM-only tsup build, nostr-tools peer dep, 5-symbol locked public API with stub factory throwing `not implemented — see Plan 34-02`.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-23T09:42:41Z
- **Completed:** 2026-04-23T09:44:41Z
- **Tasks:** 2 (1 scaffold + 1 verification)
- **Files modified:** 4 created + 1 modified (pnpm-lock.yaml)

## Accomplishments

- **New workspace `packages/nip66/` registered** — pnpm auto-picked via `packages/*` glob (23 → 24 workspace projects); zero edits to `pnpm-workspace.yaml`.
- **`@kehto/nip66@0.1.0` manifest shipped** — ESM-only, tsup build, `nostr-tools >=2.23.3 <3.0.0` sole peer dep (matches `@kehto/shell` range verbatim), vitest dev dep, zero `@napplet/*` footprint (framework-agnostic per CONTEXT.md Decision §NIP66-03).
- **5-symbol locked public API** — `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions`, `Nip66Aggregator` interfaces + `createNip66Aggregator` factory stub. Types match CONTEXT.md `<specifics>` block character-for-character. JSDoc on every export per CLAUDE.md Code Conventions.
- **Build + type-check green end-to-end** — `pnpm --filter @kehto/nip66 build` produces `dist/index.js` (213B) + `dist/index.d.ts` (4.95KB); full-repo `pnpm build` grew from 22 → **23 turbo tasks** (22 cached + `@kehto/nip66#build` fresh); full-repo `pnpm type-check` at 9/9 successful.
- **NIP66-01 + NIP66-03 closed** — workspace exists + buildable; `nostr-tools` sole peer, no `@napplet/core` dep.

## Task Commits

1. **Task 1: Scaffold packages/nip66 workspace** + **Task 2: Verify builds + type-checks + joins turbo graph** — `27cbf3a` (feat)
   - Consolidated commit per plan guidance ("Do NOT commit anything yet — this task is scaffold verification. The Plan 34-01 commit happens at the end of this plan's execution flow, consolidating both tasks into a single `feat(34-01): scaffold @kehto/nip66 workspace` commit.")

**Plan metadata commit (to follow):** `docs(34-01): complete @kehto/nip66 workspace scaffold plan`

## Files Created/Modified

- `packages/nip66/package.json` (50 lines) — `@kehto/nip66@0.1.0`, ESM exports map, `files: ["dist"]`, `publishConfig.access: public`, peer deps `{nostr-tools: >=2.23.3 <3.0.0}` only, dev deps `{nostr-tools, tsup, typescript, vitest}`, scripts include both `test` and `test:unit`, keywords `[nostr, nip66, relay-discovery, kehto, napplet]`.
- `packages/nip66/tsconfig.json` (9 lines) — extends `../../tsconfig.json`, `rootDir: src`, `outDir: dist`, `lib: [ES2022, DOM, DOM.Iterable]`, `include: [src]`.
- `packages/nip66/tsup.config.ts` (9 lines) — character-for-character mirror of `packages/services/tsup.config.ts`: `entry: ['src/index.ts']`, `format: ['esm']`, `dts: true`, `sourcemap: true`, `clean: true`.
- `packages/nip66/src/index.ts` (136 lines) — stub barrel:
  - `import type { NostrEvent } from 'nostr-tools'` (type-only; load-bearing under `verbatimModuleSyntax`)
  - `export interface Nip66RelayPool { subscribe(relays, filter, onEvent): () => void }`
  - `export type Nip66Filter = { kinds: [30166]; '#n'?: ReadonlyArray<string> }`
  - `export interface Nip66AggregatorOptions { pool; bootstrap; networks? }`
  - `export interface Nip66Aggregator { start(); resync(); getRelaySet(); getRelaysSupportingNip(nip); relaySupportsNip(url, nip) }`
  - `export function createNip66Aggregator(_options): Nip66Aggregator { throw new Error('createNip66Aggregator: not implemented — see Plan 34-02'); }`
- `pnpm-lock.yaml` — new importer block for `packages/nip66` (no new transitive resolutions; `tsup`/`typescript`/`vitest`/`nostr-tools` already resolved from sibling packages).

## Public API Exports (Locked for Plan 34-02)

| Symbol | Shape | Purpose |
|--------|-------|---------|
| `Nip66RelayPool` | interface — `subscribe(relays, filter, onEvent): () => void` | Pluggable relay-pool adapter consumers implement against their pool library |
| `Nip66Filter` | type — `{ kinds: [30166]; '#n'?: ReadonlyArray<string> }` | Minimal kind-30166 filter shape, optional `#n` network narrowing |
| `Nip66AggregatorOptions` | interface — `{ pool; bootstrap; networks? }` | Factory options |
| `Nip66Aggregator` | interface — `{ start; resync; getRelaySet; getRelaysSupportingNip; relaySupportsNip }` | Aggregator handle with closure-scoped state |
| `createNip66Aggregator` | factory — `(options) => Aggregator` | **Stub throws `not implemented — see Plan 34-02`** |

## Scripts Declared

```json
{
  "build": "tsup",
  "type-check": "tsc --noEmit",
  "test:unit": "vitest run --config ../../vitest.config.ts",
  "test": "vitest run --config ../../vitest.config.ts"
}
```

Both `test` and `test:unit` aliases route to vitest so downstream `pnpm --filter @kehto/nip66 test` (quality-gate invocation) and monorepo convention (`test:unit`) both resolve. 34-02 adds actual test files; root `vitest.config.ts` picks them up via `packages/*/src/**/*.test.ts` glob.

## Turbo Task Count Delta

- **Pre-Plan 34-01 (v1.5 close / Phase 33-03 baseline):** 22 turbo tasks
- **Post-Plan 34-01:** **23 turbo tasks** (+1 for `@kehto/nip66#build`)
- **Cache behavior:** Full-repo `pnpm build` after scaffolding = 22 cached + 1 fresh (the new `@kehto/nip66:build`). Existing packages untouched — no regression.

## Decisions Made

- **Stub factory sentinel wording (`'createNip66Aggregator: not implemented — see Plan 34-02'`)** — includes plan reference so a consumer (or downstream agent) hitting the throw knows exactly where the impl is coming from. Plan 34-02 will replace the body but keep the signature.
- **Both `test` and `test:unit` script aliases** — CONTEXT.md downstream_consumer quality-gate expects `pnpm --filter @kehto/nip66 test`; kehto monorepo convention uses `test:unit`. Shipping both avoids forcing a downstream install round-trip and keeps sibling-package consistency.
- **No default bootstrap relay list** — not shipped in any form (code, comment, or example comment). Policy decision per CONTEXT.md Decision §"Bootstrap relay list": belongs to the shell, not the library.
- **Type-only `NostrEvent` import** — `import type { NostrEvent } from 'nostr-tools'` is load-bearing under `verbatimModuleSyntax`; without `type` keyword, tsup would emit a runtime `import` that breaks when consumers don't ship `nostr-tools` at runtime. Type-only imports are fully erased, keeping `dist/index.js` at 213B.
- **Factory `@example` embedded in JSDoc** — doubles as a README integration sketch. Shows the recommended SimplePool adapter shape (`pool.subscribeMany(...)`) for Plan 34-03 README authoring.

## Deviations from Plan

None — plan executed exactly as written. Both tasks hit every acceptance criterion on first pass:

- Task 1 file creation: 4/4 files, all grep checks pass (5 export symbols present, 0 `@napplet/core` or `@napplet/nub` strings, `nostr-tools >=2.23.3 <3.0.0` exact match).
- Task 2 verification: `pnpm --filter @kehto/nip66 build` exit 0, `dist/index.js` + `dist/index.d.ts` present, `pnpm --filter @kehto/nip66 type-check` exit 0, full-repo `pnpm build` exit 0 with exactly +1 turbo task, full-repo `pnpm type-check` exit 0.

No auto-fixes invoked. No architectural decisions surfaced. No auth gates.

**Minor adjustment worth recording (not a deviation):** The plan's acceptance-grep `grep -c 'export.*createNip66Aggregator' packages/nip66/dist/index.d.ts` returns 1 because tsup emits a bundled-export shape — `declare function createNip66Aggregator(...)` at the top and `export { ..., createNip66Aggregator };` as a terminal statement. The plan's check matches the terminal statement. This is tsup's normal output shape (observed in sibling `@kehto/services/dist/index.d.ts`) and not a divergence from the plan.

## Issues Encountered

None. Single pnpm peer-dep warning observed during `pnpm install` (unocss → oxc-parser → @napi-rs/wasm-runtime missing peer `@emnapi/core` + `@emnapi/runtime`) is **pre-existing** in the monorepo (unrelated to `@kehto/nip66`) and out-of-scope per the Executor's SCOPE BOUNDARY rule. Logged here for visibility; not added to `deferred-items.md` because it was present before this plan started.

## Next Phase Readiness

- **Plan 34-02 (next):** Port hyprgate `processEvent` / `parseNipSupport` / d-tag extraction / N-tag parsing into closure-scoped state behind the locked `createNip66Aggregator` factory signature. Reference impl: `/home/sandwich/Develop/hyprgate/apps/shell/src/lib/relay/nip66-monitor.ts` (188 lines). Tests land under `packages/nip66/src/*.test.ts` — root `vitest.config.ts` picks them up automatically.
- **Plan 34-03:** README (public API table + SimplePool integration example — factory `@example` already provides the sketch) + `.changeset/v1-6-nip66.md` initial-publish changeset. Closes NIP66-02, NIP66-04, NIP66-05.
- **Blockers:** None. Build floor is green; 34-02 can land impl without contaminating the turbo cache or regressing sibling packages.
- **Handoff:** `createNip66Aggregator` public signature frozen; impl lands behind it. Existing `dist/` can be regenerated on-demand — tsup `clean: true` means each `pnpm build` starts fresh.

## Self-Check: PASSED

- [x] `packages/nip66/package.json` — FOUND
- [x] `packages/nip66/tsconfig.json` — FOUND
- [x] `packages/nip66/tsup.config.ts` — FOUND
- [x] `packages/nip66/src/index.ts` — FOUND
- [x] `packages/nip66/dist/index.js` — FOUND (build artifact, gitignored)
- [x] `packages/nip66/dist/index.d.ts` — FOUND (build artifact, gitignored)
- [x] Commit `27cbf3a` — FOUND in git log (`feat(34-01): scaffold @kehto/nip66 workspace`)
- [x] `grep -c '@napplet/core' packages/nip66/package.json` == 0
- [x] `grep -c '@napplet/nub' packages/nip66/package.json` == 0
- [x] All 5 public API symbols exported in built `dist/index.d.ts`

---
*Phase: 34-kehto-nip66-extract-publish*
*Completed: 2026-04-23*
