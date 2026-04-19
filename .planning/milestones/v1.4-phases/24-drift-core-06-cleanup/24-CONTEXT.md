# Phase 24: DRIFT-CORE-06 Cleanup - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Infrastructure-only (pure internal refactor; no design grey areas)

<domain>
## Phase Boundary

Delete `packages/runtime/src/core-compat.ts` and every live type it shimmed is re-imported from its rightful home. Delete dead NIP-01 code paths (`BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS`) from `enforce.ts`, `state-handler.ts`, `service-discovery.ts`, and `@kehto/services` files. No behavior change — v1.2 made NIP-5D canonical; these NIP-01 code paths haven't executed since.

In scope (DRIFT-01):
- Delete `packages/runtime/src/core-compat.ts`
- Re-home live types to rightful homes:
  - `Capability` → re-import from `@kehto/acl/capabilities` (canonical source)
  - `ServiceDescriptor` → relocate to `@kehto/runtime/types` (or keep where used, since it's a runtime internal)
  - `REPLAY_WINDOW_SECONDS` → inline in `replay.ts` or move to a `@kehto/runtime/constants` module
- `@kehto/runtime/src/index.ts`: remove the re-export line `export type { Capability, BusKindValue, ServiceDescriptor } from './core-compat.js';` and replace with direct re-exports from the new homes. Drop `BusKindValue` re-export entirely.

In scope (DRIFT-02):
- Delete all `BusKind` / `AUTH_KIND` / `DESTRUCTIVE_KINDS` / `STATE_TOPICS` imports and code paths in:
  - `packages/runtime/src/enforce.ts` (uses `BusKind`, `STATE_TOPICS`)
  - `packages/runtime/src/runtime.ts` (uses `BusKind`, `ALL_CAPABILITIES`)
  - `packages/runtime/src/acl-state.ts` (uses `DESTRUCTIVE_KINDS`)
  - `packages/runtime/src/state-handler.ts` (uses `BusKind`)
  - `packages/runtime/src/service-discovery.ts` (uses `BusKind`)
  - `packages/runtime/src/event-buffer.ts` (uses `Capability`)
  - `packages/runtime/src/replay.ts` (uses `REPLAY_WINDOW_SECONDS`)
  - `packages/runtime/src/types.ts` (uses `Capability`, `ServiceDescriptor`)
  - `packages/services/src/media-service.ts`, `audio-service.ts`, `notification-service.ts`, `notify-service.ts` (JSDoc comments only, per 22-ITERATION-LOG patterns)

Out of scope:
- Any runtime behavior change. Post-refactor test counts, E2E pass counts, and ACL behavior MUST match Phase 23 baseline exactly.
- Any new public API (`ServiceDescriptor` re-location is internal; no new exports from `@kehto/runtime/index.ts` beyond what's already exported under different paths).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (pure refactor conventions)

- **`ServiceDescriptor` relocation:** Move to `packages/runtime/src/types.ts` (already the canonical type module for runtime). Add an export in `packages/runtime/src/index.ts` so existing consumers of `import { ServiceDescriptor } from '@kehto/runtime'` still resolve.
- **`REPLAY_WINDOW_SECONDS`:** Inline at the single consumer (`replay.ts`) as `const REPLAY_WINDOW_SECONDS = 60;` — it's a small constant used in one file; dedicated `constants.ts` is over-engineering.
- **`Capability` import path:** Every former `core-compat` consumer now imports from `@kehto/acl/capabilities` directly (workspace package path already supported by current tsconfig + bundler setup). No intermediate re-export through `@kehto/runtime` is needed.
- **Dead code removal strategy:** Where `BusKind`/`AUTH_KIND`/etc. were used in runtime guards (e.g., `if (msg.kind === BusKind.XYZ)` branches), those branches are DEAD — NIP-5D envelopes don't use integer kinds for dispatch. Delete the branches entirely. Do NOT keep them as defensive fallbacks; dead code is liability not insurance.
- **Comment cleanup:** JSDoc comments referencing removed symbols (`BusKind`, `signer-service`, etc.) — if the surrounding code documents current behavior, edit the comment to remove the obsolete reference. If the comment is a post-mortem (e.g., "was removed in Phase 12 because X"), keep it — institutional memory.
- **Anti-term grep scope:** After refactor, `grep -rEn 'BusKind|AUTH_KIND|DESTRUCTIVE_KINDS|STATE_TOPICS' packages/runtime/src packages/services/src` must return 0 matches. Matches in `.planning/` (historical docs), `milestones/` (archived), and `tests/` (if testing the absence of these) are NOT in scope.
- **Test file status:** Unit tests that reference these symbols (if any remain) should already have been cleaned up in Phase 23-05 (stale test pruning). Phase 24 verifies the grep is clean but doesn't touch tests unless a new failure surfaces.

### Migration Safety Net

- **Run `pnpm type-check` after each file edit:** catches removed-symbol references immediately.
- **Build + test:e2e iteration loop** per v1.3 E2E-11 canon — recorded in the phase iteration log per roadmap criterion 5.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `@kehto/acl/capabilities` already exports `Capability` string union + `ALL_CAPABILITIES` readonly array (canonical source per v1.2 Plan 12-10).
- `packages/runtime/src/types.ts` already exists and exports runtime types — `ServiceDescriptor` relocation is a local move.
- `packages/runtime/src/replay.ts` is the single consumer of `REPLAY_WINDOW_SECONDS`.

### Established Patterns

- `@kehto/runtime` uses `.js` extensions in import specifiers (ESM + TypeScript moduleResolution: "nodenext"). Re-home imports use `.js` suffix.
- JSDoc comments in src files follow neutral-phrasing convention from Phase 18 decision (explanatory comments referencing banned terms permitted, but dead-code JSDocs get pruned when the code is removed).
- turbo caches builds per-package; a source file change in `packages/runtime` invalidates cache for runtime + downstream dependents (acl, services, shell). Expect ~5s full rebuild post-refactor.

### Integration Points

- `packages/runtime/src/index.ts` currently exports `Capability`, `BusKindValue`, `ServiceDescriptor` from `core-compat.js` (lines 85-95 area). This export MUST be rewritten:
  - `Capability` → re-export from `@kehto/acl/capabilities`
  - `ServiceDescriptor` → re-export from `./types.js`
  - `BusKindValue` → DELETE (no external consumers remain)
- `@kehto/runtime` consumers that import `Capability` from `@kehto/runtime` will continue to work via the re-export. If they import from `@kehto/runtime/core-compat.js`, the import will break and must be updated — verify with grep before the refactor.
- `@kehto/services/media-service.ts` etc. only have JSDoc references — no code changes, just comment refresh.

</code_context>

<specifics>
## Specific Ideas

- **Turbo-cache busting:** After all edits, run `pnpm clean && pnpm build && pnpm test && pnpm test:e2e` to produce the iteration-log evidence. `pnpm clean` forces a cold build; cache-hit runs don't catch recompile regressions.
- **Commit granularity:** 2 commits — `refactor(24-01): re-home types + delete core-compat.ts (DRIFT-01)` then `refactor(24-02): delete dead NIP-01 code paths (DRIFT-02)`. Or as a single commit if the dep ordering is trivially 24-01-first → 24-02-second. Planner decides.
- **CI verification:** After push, confirm all 3 workflows stay green against the post-refactor commit (continued proof of the green-bar floor).

</specifics>

<deferred>
## Deferred Ideas

- **ServiceDescriptor schema changes:** Current `ServiceDescriptor` type is whatever `core-compat.ts` re-exported from v0.1. If it's a subset of what v1.2 actually uses, surface the delta to a follow-up phase — don't enlarge the type contract in this refactor.
- **`@kehto/runtime/constants` module:** If Phase 26/27 needs other runtime constants (chord debounce, media setup timings), that's when the module becomes justified. Don't create it speculatively in Phase 24.

</deferred>
