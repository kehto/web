---
phase: 13-theme-nub-implementation
plan: 02
subsystem: shell
tags: [nip-5d, theme, nub, shell-adapter, tdd, vitest, broadcast, fanout]

requires:
  - phase: 13-theme-nub-implementation
    provides: "@kehto/services createThemeService with ThemeChangedMessage envelope shape; @kehto/runtime case 'theme' with ACL gate; mirrored default theme constants (Plan 13-01)"
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: "keys-forwarder.ts multi-napplet fanout pattern (sessionRegistry.getAllEntries + originRegistry.getIframeWindow) — verbatim template for publishTheme; theme-proxy.ts exists but is napplet-facing and explicitly NOT used here"
provides:
  - "ShellBridge.publishTheme(theme: Theme): void — host-facing broadcast API that pushes theme.changed envelope to every registered napplet"
  - "First test file for shell-bridge.ts: packages/shell/src/shell-bridge.test.ts (3 tests covering broadcast, stale-session skip, surface type)"
  - "Phase 13 audit closure: DRIFT-RT-05, DRIFT-SHELL-05, DRIFT-SVC-06 all annotated Resolved; Phase 13 closure section added to docs/v1.2-NIP-5D-AUDIT.md"
affects:
  - 14-dispatch-refactor (publishTheme is orthogonal to the switch → createDispatch migration; stays as bridge method after refactor)
  - v1.2 milestone closure (Theme NUB complete end-to-end; TH-01..TH-04 all [x] in REQUIREMENTS.md)

tech-stack:
  added: []
  patterns:
    - "Host-facing broadcast API colocated on ShellBridge factory return — not a separate proxy. publishTheme sits alongside handleMessage/injectEvent/destroy/registerConsentHandler as a first-class bridge method rather than being hidden behind createThemeProxy composition"
    - "Runtime-owned session registry as the authoritative registered-napplet list for broadcasts (not the shell's `./session-registry.js` singleton) — publishTheme reads runtime.sessionRegistry.getAllEntries() because the runtime is the canonical session authority; shell singleton remains for legacy code paths"
    - "beforeEach/afterEach originRegistry.clear() as the canonical test-isolation pattern for shell-bridge tests that touch module-level singletons — mirrors the explicit-teardown style keys-forwarder.test.ts avoids by injecting target EventTarget"

key-files:
  created:
    - packages/shell/src/shell-bridge.test.ts
  modified:
    - packages/shell/src/shell-bridge.ts
    - docs/v1.2-NIP-5D-AUDIT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "publishTheme uses runtime.sessionRegistry.getAllEntries() rather than the shell singleton sessionRegistry — the runtime is the canonical registered-napplet authority and the plan's `<interfaces>` block cites Runtime.sessionRegistry explicitly. Tests seed bridge.runtime.sessionRegistry accordingly"
  - "Broadcast envelope shape is { type: 'theme.changed', theme } — matches @napplet/nub-theme ThemeChangedMessage (no id, no windowId — this is a fire-and-forget shell-initiated push). Matches Plan 13-01's ThemeService.publishTheme envelope shape verbatim"
  - "publishTheme does NOT use theme-proxy.ts — CONTEXT.md pinned this decision. theme-proxy is napplet-facing (dispatch + emit); publishTheme is host-facing (broadcast). Keeping them distinct avoids conflating the proxy role with the host-publisher role"
  - "Type-only import of Theme from @napplet/nub-theme — preserves types-only peer-dep rule (zero runtime footprint from the nub packages). Same pattern as identity-proxy.ts, keys-proxy.ts, etc."
  - "No barrel export change — publishTheme propagates through existing `export type { ShellBridge } from './shell-bridge.js'` at index.ts:9 via TypeScript structural typing. Verified present in dist/index.d.ts line 419"

patterns-established:
  - "Host-facing bridge broadcast method pattern: for any shell-originated push envelope that targets ALL registered napplets (vs. a single addressable napplet), add the method directly on ShellBridge. Signature `publishXxx(payload): void`. Implementation iterates runtime.sessionRegistry.getAllEntries(), resolves each windowId via originRegistry.getIframeWindow, posts envelope, skips unresolved. Precedent for future broadcast APIs (e.g., identity.changed if/when that push type lands)"
  - "ACL-at-recipient documentation contract: JSDoc on broadcast methods explicitly documents that ACL is enforced BY THE RECIPIENT via @napplet/shim + acl themeMap recipientCap, NOT by the host on send. Prevents future maintainers from adding redundant host-side filtering that would duplicate (and diverge from) the shim's enforcement"

requirements-completed: [TH-03]

duration: 5 min
completed: 2026-04-17
---

# Phase 13 Plan 02: Shell Adapter publishTheme Broadcast API Summary

**Host-facing `bridge.publishTheme(theme)` method on ShellBridge that fans out `theme.changed` envelopes to every registered napplet via `runtime.sessionRegistry.getAllEntries()` + `originRegistry.getIframeWindow()`, closing TH-03 and DRIFT-SHELL-05 to complete Phase 13 end-to-end.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-17T20:09:22Z
- **Completed:** 2026-04-17T20:14:49Z
- **Tasks:** 2 (TDD RED + GREEN; no REFACTOR needed)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **TH-03 (shell adapter API):** Added `publishTheme(theme: Theme): void` to the `ShellBridge` interface and `createShellBridge()` factory in `packages/shell/src/shell-bridge.ts`. The implementation iterates `runtime.sessionRegistry.getAllEntries()`, resolves each windowId via the module-level `originRegistry.getIframeWindow()`, and posts a canonical `{ type: 'theme.changed', theme }` envelope to every resolved iframe. Napplets whose windowId does not resolve (stale session) are silently skipped; the method never throws.
- **First shell-bridge test file:** Created `packages/shell/src/shell-bridge.test.ts` — 3 tests covering the full contract: (1) broadcasts to every registered napplet window with the exact envelope shape, (2) silently skips unresolvable windowIds while still delivering to resolvable ones, (3) surfaces `publishTheme` as a typed callable on the `ShellBridge` type (compile-time check) and as a function at runtime.
- **Phase 13 audit closure:** Annotated DRIFT-RT-05 (resolved in Plan 13-01), DRIFT-SVC-06 (resolved in Plan 13-01), and DRIFT-SHELL-05 (resolved in Plan 13-02) in `docs/v1.2-NIP-5D-AUDIT.md`; added a Phase 13 status block mirroring the Plan 12-10 closure precedent; updated the Summary distribution line to show Phases 11/12/13 all resolved, Phase 14 remaining.
- **TH-01..TH-04 all closed:** Flipped `TH-03` from `[ ]` to `[x]` in `.planning/REQUIREMENTS.md` (TH-01/TH-02/TH-04 were closed in Plan 13-01). Updated the traceability table: TH-01/TH-02/TH-04 → `13 (Plan 13-01)`, TH-03 → `13 (Plan 13-02)`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): failing bridge.publishTheme broadcast test** — `e0b172d` (test)
2. **Task 2 (TDD GREEN): publishTheme adapter + audit closure + REQUIREMENTS flip** — `265f575` (feat)

_Note: No REFACTOR commit — GREEN implementation matched the fanout pattern verbatim from keys-forwarder.ts with no cleanup needed._

## Files Created/Modified

- `packages/shell/src/shell-bridge.test.ts` (created, 197 lines) — first test file for shell-bridge.ts. Defines `makeTestHooks()` factory producing a minimal `ShellAdapter` with no-op hooks; `makeFakeIframe()` fabricates `{ postMessage: vi.fn() }` spies; `makeSessionEntry()` builds SessionEntry objects. `beforeEach`/`afterEach` clears `originRegistry` singleton. Three `describe('ShellBridge.publishTheme', ...)` tests seed `bridge.runtime.sessionRegistry` (runtime instance, not shell singleton) and assert `postMessage` call counts + envelope shape.
- `packages/shell/src/shell-bridge.ts` (modified, +34 lines): added `import type { Theme } from '@napplet/nub-theme'`; extended `ShellBridge` interface with `publishTheme(theme: Theme): void` member and full JSDoc describing fanout, ACL-at-recipient semantics, and never-throw contract; added `publishTheme` implementation to `createShellBridge()` return object, placed between `registerConsentHandler` and the `get runtime()` accessor.
- `docs/v1.2-NIP-5D-AUDIT.md` (modified): DRIFT-RT-05 row gets ` **Status:** ✅ Resolved in Phase 13 (Plan 13-01).`; DRIFT-SVC-06 row gets the same; DRIFT-SHELL-05 row gets `Resolved in Phase 13 (Plan 13-02) — \`bridge.publishTheme(theme)\` on ShellBridge broadcasts theme.changed ...`. Summary distribution line updated. New Phase 13 closure block added after the Phase 12 closure block, listing 3/3 rows resolved with per-plan ownership table.
- `.planning/REQUIREMENTS.md` (modified): TH-03 checkbox flipped from `[ ]` to `[x]`. Traceability table rows updated for TH-01/02/03/04 (all point to Phase 13 + their plan IDs).

## Decisions Made

- **publishTheme reads `runtime.sessionRegistry`, not the shell singleton.** The plan's `<interfaces>` block explicitly cites `Runtime.sessionRegistry` as the authoritative source and the `runtime` const is already in closure scope from `const runtime: Runtime = createRuntime(runtimeHooks)` at shell-bridge.ts:152. This matches how the shell's `sendToNapplet` (via hooks-adapter) also goes through `runtime`-owned plumbing. The shell's own `sessionRegistry` singleton remains for legacy code paths but is NOT read by this new method. Tests were initially written against the shell singleton (RED phase) and refactored to seed `bridge.runtime.sessionRegistry` during GREEN once the impl was in place — not a deviation, just a normal TDD tightening of the test setup to match the verified-correct integration point.
- **Do NOT use `createThemeProxy` / `theme-proxy.ts`.** CONTEXT.md pinned this decision: theme-proxy is napplet-facing (`dispatch` routes napplet→shell requests into runtime; `emit` pushes shell→napplet envelopes for a single addressable windowId). `publishTheme` is host-facing BROADCAST (shell → every napplet at once). Keeping them distinct avoids conflating the proxy role with a host-publisher role and matches the plan's explicit guard against misuse.
- **Envelope shape matches @napplet/nub-theme ThemeChangedMessage verbatim.** `{ type: 'theme.changed', theme }` — no `id`, no `windowId`, no `payload` wrapper. This mirrors Plan 13-01's `ThemeService.publishTheme` return envelope exactly, ensuring the shell adapter's envelope is indistinguishable from one the runtime's theme-service would emit if its `onBroadcast` had been wired differently. Napplet-side consumers receive the same envelope regardless of whether the push originated from host-side `bridge.publishTheme` or service-side `themeService.publishTheme`.
- **Type-only import of Theme from @napplet/nub-theme.** Preserves the types-only peer-dep rule established in Phase 11 — no runtime code from the nub packages reaches the shell bundle. Matches the pattern used by identity-proxy.ts, keys-proxy.ts, etc.
- **No barrel export change needed.** `publishTheme` propagates through the existing `export type { ShellBridge } from './shell-bridge.js'` at `packages/shell/src/index.ts:9` via TypeScript structural typing. Verified: `grep "publishTheme" packages/shell/dist/index.d.ts` finds the method on the exported `ShellBridge` type at line 419 of the generated .d.ts.

## Deviations from Plan

None - plan executed exactly as written.

The planner pre-specified the Theme type import, the exact JSDoc skeleton, the fanout-via-keys-forwarder-pattern decision, the "do not use theme-proxy" rule, and the acceptance checklist. Implementation followed the plan's `<action>` blocks verbatim. The only on-the-fly adjustment was during GREEN — the initial RED test populated the shell singleton `sessionRegistry` but the canonical implementation reads `runtime.sessionRegistry`; the test setup was tightened to seed `bridge.runtime.sessionRegistry` so the assertions exercise the real integration path. This is inside-the-TDD-cycle tightening, not a plan deviation.

## Issues Encountered

- **RED→GREEN test-seed mismatch.** The initial RED-phase test populated the shell-side `sessionRegistry` singleton (imported from `./session-registry.js`), matching the import the shell-bridge.ts file already had. Once the implementation landed and called `runtime.sessionRegistry.getAllEntries()`, the tests silently returned zero entries. Resolution: refactor the test setup to seed `bridge.runtime.sessionRegistry` directly (via `bridge.runtime.sessionRegistry.register(...)`) after bridge construction, and drop the shell-singleton seeding. All 3 tests green after the tightening. No behavioral change to the impl — this was purely a test-setup alignment.

## User Setup Required

None - no external service configuration required.

## Self-Check

- [x] `packages/shell/src/shell-bridge.test.ts` exists on disk (197 lines, 3 tests).
- [x] `grep -c "publishTheme" packages/shell/src/shell-bridge.ts` → 3 (JSDoc title reference in example, interface member, factory method).
- [x] `grep -n "publishTheme" packages/shell/dist/index.d.ts` → line 419 (method on ShellBridge type in generated .d.ts).
- [x] `npx vitest run` → 447 passed / 19 skipped / 0 failed across 30 test files.
- [x] `pnpm build` → 11/11 tasks successful.
- [x] `pnpm type-check` → 8/8 tasks successful.
- [x] `docs/v1.2-NIP-5D-AUDIT.md` DRIFT-RT-05, DRIFT-SVC-06, DRIFT-SHELL-05 rows all show `Status: ✅ Resolved in Phase 13`.
- [x] `.planning/REQUIREMENTS.md` TH-01..TH-04 all `[x]`; traceability rows point to Phase 13 plan IDs.
- [x] Commits `e0b172d` (test RED) + `265f575` (feat GREEN) present in `git log --oneline`.

## Self-Check: PASSED

## Next Phase Readiness

- **Phase 13 complete end-to-end:** All 3 DRIFT rows (DRIFT-RT-05, DRIFT-SHELL-05, DRIFT-SVC-06) closed; all 4 requirements (TH-01, TH-02, TH-03, TH-04) closed. The theme NUB has full round-trip coverage: napplet → shell → runtime → theme-service → shell → napplet (service-driven), plus host → bridge.publishTheme → every napplet (host-driven).
- **Phase 14 ready:** All 8 NUB domains are now wired via the hand-rolled `switch (domain)` in `packages/runtime/src/runtime.ts`. Phase 14 can now migrate the switch to `createDispatch()` / `registerNub()` with full domain coverage to validate against. The theme case is the 8th and last; no further per-domain additions are expected before the refactor.
- **v1.2 milestone tracking:** 16 of 17 plans complete. Remaining: Phase 14 (2 plans: DISPATCH-01..03) + Phase 15 (validation + release prep: DEPS-02, DEPS-03).
- **No blockers.**

---
*Phase: 13-theme-nub-implementation*
*Completed: 2026-04-17*
