---
phase: 26-real-keys-backend
plan: 02
subsystem: services
tags: [keys, host-bridge, hostKeysBridge, interface, os-hotkey, nub-keys, vitest]

requires:
  - phase: 26-01-real-keys-backend
    provides: real document-listener keys-service (Plan 26-01 Branch B body) + per-window send-callback capture + keys.action envelope emission
  - phase: 24-drift-core-06-cleanup
    provides: napplet/core@0.2.x peer dep + cleaned service-handler contract
provides:
  - HostKeysBridge TypeScript interface (required subscribe + optional registerGlobalHotkey/onGlobalHotkey) exported from @kehto/services
  - HostKeyEvent structural-minimum DOM event subset type exported from @kehto/services
  - hostBridge?: HostKeysBridge field on KeysServiceOptions — when provided, createKeysService delegates subscription lifecycle to the bridge (Branch A) instead of attaching a document keydown listener (Branch B, unchanged)
  - Branch-A bookkeeping per-window (bridgeWindowActions + unsubscribeHandles) with onWindowDestroyed + destroy() cleanup semantics mirroring Branch B
  - 5 new describe-wrapped tests covering the Branch-A delegation path (subscribe chord-string capture, callback fan-out to onForward, unsubscribe on unregisterAction, bypass of default document listener, onWindowDestroyed scoped cleanup)
affects: [26-03, 26-04, E2E-12, host-app-integrations]

tech-stack:
  added: []
  patterns:
    - "Optional-backend branch pattern: early-return gate (if options.hostBridge) that returns a fully-formed ServiceHandler — keeps Branch B (the Plan 26-01 default listener body) untouched, wire-transparent, and backward-compatible"
    - "Bridge-delegated lifecycle: actionId → unsubscribe handle Map mirrors Branch B's actionId → ActionEntry Map. Per-window Set<actionId> parallel to Branch B's windowActions. Same cleanup idioms on unregister/onWindowDestroyed/destroy — only the chord-dispatch mechanism differs"
    - "Structural-subset event typing: HostKeyEvent is a 7-field subset of DOM KeyboardEvent (key, code, {ctrl,alt,shift,meta}Key, optional repeat). DOM KeyboardEvent satisfies it structurally with zero adapters; OS-bridge impls synthesize a plain object that also satisfies it"
    - "Autorepeat filter moved into the subscribe callback in Branch A — bridges that don't filter autorepeat themselves get the same semantics as Branch B (ev.repeat → drop)"

key-files:
  created: []
  modified:
    - packages/services/src/keys-service.ts — Added `HostKeyEvent` type + `HostKeysBridge` interface (exported) at module top; extended `KeysServiceOptions` with `hostBridge?: HostKeysBridge`; added Branch-A early-return gate inside `createKeysService` handling keys.forward/registerAction/unregisterAction/default/onWindowDestroyed/destroy; Branch B (Plan 26-01 body) wrapped in a comment header, zero behaviour change
    - packages/services/src/index.ts — Extended the keys-section `export type { ... }` block to re-export `HostKeysBridge` + `HostKeyEvent` alongside `KeysServiceOptions`; updated the section header comment to reflect the host-bridge contract
    - packages/services/src/keys-service.test.ts — Appended type-only import `{ HostKeysBridge, HostKeyEvent }`; appended one new `describe('HostKeysBridge integration', …)` block with 5 tests (createFakeBridge helper + subscribe-chord-capture + callback-fans-to-onForward + unsubscribe-on-unregisterAction + hostBridge-bypasses-default-listener + onWindowDestroyed-scoped-unsubscribe)

key-decisions:
  - "[v1.4-26-02] Branch A is an early-return inside createKeysService (not a parallel factory). Keeps a single public entry point (createKeysService) and preserves Branch B's body verbatim — host apps opt into the bridge path by passing `hostBridge` in options; omitting it restores Plan 26-01 behaviour exactly."
  - "[v1.4-26-02] keys.action envelope in Branch A omits the `chord` extension field that Branch B adds. Rationale: Branch B can emit the parsed ChordSpec struct because it parses the chord string at registerAction time; bridges deliver pre-parsed chord events without exposing any internal chord representation to the service. The base envelope shape ({ type: 'keys.action', actionId }) matches @napplet/nub-keys canonically — SDK consumers that only read { type, actionId } are bit-compatible across both branches."
  - "[v1.4-26-02] Branch A's descriptor.description string becomes 'host-bridge delegated' instead of 'document-level chord listener' when hostBridge is provided. Surfaces the override cleanly through the service descriptor (runtime registers this descriptor; downstream debuggers / service-list UIs can distinguish the two paths)."
  - "[v1.4-26-02] `registerGlobalHotkey?` + `onGlobalHotkey?` are declared optional on HostKeysBridge. Browser reference impl (Branch B) structurally satisfies the interface — it implements subscribe-semantics via document keydown but CAN'T provide OS-level global hotkeys. Electron/Tauri bridges (out of v1.4 scope per CONTEXT Deferred Ideas) provide all three. JSDoc explicitly documents this browsers-omit-optional contract."
  - "[v1.4-26-02] Branch A keeps its own `bridgeWindowActions` map instead of sharing Branch B's `windowActions`. Even though both are scoped to either-or (hostBridge provided XOR default listener), keeping them separate avoids accidental state bleed if future refactors collapse the branches — and makes the unused-map declaration in the opposite branch a dead-code removal candidate rather than a shared-ref trap."

patterns-established:
  - "HostKeysBridge interface is the v1.4 extension seam for host-app keyboard backends. Host apps that want OS-level hotkeys implement this interface and pass it via createKeysService({ hostBridge }) — no service fork required, no breaking change to existing browser consumers. The same contract applies to future ServiceHandler extension points (media, notify) if those ever need OS-level escapes."
  - "Structural-subset types for browser-vs-OS event shapes: declaring a minimal 6-field key-event type (HostKeyEvent) alongside KeyboardEvent in the callback signature lets browser impls pass DOM events directly AND lets OS-bridge impls pass plain-object synthesis. Adapter-free on the hot path."

requirements-completed: [KEYS-02]

duration: 10 min
completed: 2026-04-19
---

# Phase 26 Plan 02: KEYS-02 HostKeysBridge Interface + hostBridge Option Summary

**Defined and exported the `HostKeysBridge` interface + `HostKeyEvent` type from @kehto/services and extended `createKeysService` with an optional `hostBridge` option that — when provided — delegates chord subscription lifecycle to the bridge (Branch A) and leaves the default document-listener body from Plan 26-01 untouched (Branch B).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-19T13:45:30Z (immediately after Plan 26-01 SUMMARY)
- **Completed:** 2026-04-19T13:51:30Z
- **Tasks:** 2 (both autonomous, both TDD)
- **Files modified:** 3 (keys-service.ts, index.ts, keys-service.test.ts)

## Accomplishments

- Added two exported type declarations at the top of `keys-service.ts`:
  - `HostKeyEvent` — 7-field structural subset of the DOM `KeyboardEvent` (key, code, ctrlKey, altKey, shiftKey, metaKey, optional repeat). JSDoc explains that DOM `KeyboardEvent` satisfies it structurally and OS-bridge impls synthesize a plain object.
  - `HostKeysBridge` — 3-field interface: required `subscribe(chord, callback) => unsubscribe`, optional `registerGlobalHotkey(chord) => boolean`, optional `onGlobalHotkey(callback) => unsubscribe`. JSDoc covers the browser-omits-optional contract, the host-app usage pattern, and a worked Electron-bridge example.
- Extended `KeysServiceOptions` with `hostBridge?: HostKeysBridge` (optional, non-breaking). Updated the `listenerTarget` JSDoc to note it is ignored when `hostBridge` is provided.
- Added Branch A early-return gate inside `createKeysService`:
  - When `options.hostBridge` is truthy: returns a fully-formed `ServiceHandler & { destroy(): void }` that delegates chord subscription to `bridge.subscribe(chord, cb)` and stores the returned unsubscribe handle in `unsubscribeHandles: Map<actionId, () => void>` + `bridgeWindowActions: Map<windowId, Set<actionId>>` for per-window scoping.
  - `handleMessage`: `keys.forward` → `onForward` (identical to Branch B); `keys.registerAction` → `bridge.subscribe` + bookkeeping + emit `keys.registerAction.result`; `keys.unregisterAction` → invoke stored unsubscribe + prune maps; default → `{type}.error` envelope.
  - `onWindowDestroyed(windowId)`: invokes every stored unsubscribe for that window and prunes both maps — mirrors Branch B's scoping.
  - `destroy()`: invokes every stored unsubscribe and clears both maps.
  - Autorepeat filter (`if ('repeat' in e && e.repeat) return;`) lives inside the subscribe callback so bridges that don't filter autorepeat get the same semantics as Branch B.
  - `descriptor.description` string swaps to `'host-bridge delegated'` when `hostBridge` is provided.
- Branch B (the Plan 26-01 body) wrapped with a `// ─── Branch B: default document-listener ───` header comment — zero logic change, byte-identical to Plan 26-01 aside from the comment header.
- Extended `packages/services/src/index.ts` `export type { ... }` block for the keys section to re-export `HostKeysBridge` + `HostKeyEvent` alongside `KeysServiceOptions`. Updated the section header comment to reflect the host-bridge contract.
- Appended one new `describe('HostKeysBridge integration', …)` block in `keys-service.test.ts` with 5 tests:
  1. `bridge.subscribe is called with the chord string on keys.registerAction`
  2. `bridge callback fans into onForward with DOM-shape fields`
  3. `unsubscribe handle is invoked on keys.unregisterAction`
  4. `hostBridge path bypasses the default document listener` — mock `listenerTarget.addEventListener` records zero keydown attachments when `hostBridge` is provided
  5. `onWindowDestroyed invokes every stored unsubscribe for that window only` — asserts scoped cleanup (win-A unsubscribed, win-B still live)
- Added type-only import `import type { HostKeysBridge, HostKeyEvent } from './keys-service.js';` to the test file to support the new describe block.

## Task Commits

Per the execution prompt, no commits were created in this plan. The working-tree changes from Plan 26-01 (keys-service.ts, keys-service.test.ts, packages/services/tsconfig.json) + this plan's additions (keys-service.ts extensions, index.ts barrel update, keys-service.test.ts HostKeysBridge describe block) + the two SUMMARY files remain staged for a later-plan atomic commit per the serial-wave execution model.

- **Task 1:** Add HostKeysBridge + HostKeyEvent + hostBridge option + Branch A gate in keys-service.ts — uncommitted
- **Task 2:** Barrel re-export + 5 new bridge-path tests — uncommitted

**Plan metadata:** uncommitted — SUMMARY.md awaits atomic commit alongside code changes.

## Files Created/Modified

- `packages/services/src/keys-service.ts` — 25,887 bytes / 630 lines (was 16,159 / 384 in Plan 26-01). Added `HostKeyEvent` interface, `HostKeysBridge` interface, `hostBridge?` option field, Branch-A early-return gate covering handleMessage/onWindowDestroyed/destroy for the bridge-delegated path. Branch B body unchanged.
- `packages/services/src/index.ts` — 4,454 bytes / 83 lines. Extended keys-section `export type { ... }` block to include `HostKeysBridge` + `HostKeyEvent`; updated section-header comment.
- `packages/services/src/keys-service.test.ts` — 22,834 bytes / 714 lines (was 17,999 / 561 in Plan 26-01). Appended type-only import and one new describe block (5 tests using the createFakeBridge helper). All 11 pre-existing describe blocks preserved verbatim.

## Decisions Made

- **Early-return gate over parallel factory** — single `createKeysService` entry point with a `if (options.hostBridge) { return ...; }` early-return at the top of the function body. Branch B body preserved byte-identically. Alternative (parallel `createBridgedKeysService` factory) would have duplicated descriptor/options-plumbing boilerplate and complicated the barrel export.
- **`chord` extension field dropped in Branch A's `keys.action` envelope** — Branch B parses the chord string at registerAction time and has the `ChordSpec` struct on hand for the envelope extension; bridges deliver pre-parsed events without exposing any internal chord representation. The base envelope ({ type, actionId }) matches @napplet/nub-keys canonically and is bit-compatible between branches. If a future host-app bridge needs to ship the chord struct, we can extend the subscribe callback signature to include it — out of scope for v1.4.
- **Separate `bridgeWindowActions` map rather than sharing `windowActions` with Branch B** — even though the two paths are mutually exclusive (hostBridge provided XOR default listener), keeping the maps branch-local avoids any future shared-ref surprises and makes Branch A a self-contained unit.
- **JSDoc on optional fields explicitly documents "browsers omit these"** — the interface itself says `?` but the prose nails why: "Browsers cannot register OS-level global hotkeys without privileged APIs. Electron (`globalShortcut`) and Tauri (`GlobalShortcut`) provide this." Makes the browser-as-reference-impl structural-satisfaction contract explicit.
- **Autorepeat filter moved into the subscribe callback in Branch A** — rather than assume bridges filter autorepeat themselves, the callback wrapper checks `'repeat' in e && e.repeat` and drops. Matches Branch B semantics ("I pressed it once"). Bridges that do filter autorepeat pay nothing; bridges that don't get free correctness.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps return the expected counts; type-check + test suite green; Branch B logic identical to Plan 26-01.

## Issues Encountered

- **`pnpm --filter @kehto/services test` routing issue** — same substitution documented in Plan 26-01 SUMMARY: `packages/services/package.json` has `"test:unit": "echo 'no unit tests yet'"` and no `"test"` script, so the plan's prescribed verification command is a no-op. Used root-level `pnpm test:unit packages/services/src/keys-service.test.ts` (direct vitest filter) — behaviourally equivalent, and the root-level `pnpm test:unit` (no filter) runs all 29/29 test files + 456/456 tests green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for Plan 26-03:** The HostKeysBridge interface is exported and wired into `createKeysService`. Plan 26-03 (KEYS-03 demo napplet — per CONTEXT Area 3) can consume `@kehto/services` normally (Branch B default path); no host-bridge plumbing needed for the browser demo.
- **Ready for Plan 26-04:** The extension seam is in place. If Plan 26-04's iteration loop uncovers a host-app bridge need, the interface is already public API. E2E-12 will exercise Branch B (document keydown) — Branch A's coverage is unit-test only in v1.4.
- **Ready for v1.5+ host-app integrations:** Electron and Tauri host apps can now implement `HostKeysBridge` in their own code and pass it via `createKeysService({ hostBridge: myBridge })` without forking the service. Reference implementations for Electron / Tauri remain explicitly out of v1.4 scope per CONTEXT.md Deferred Ideas.
- **No blockers.**

## Self-Check

Automated verification of SUMMARY claims:

- Files modified present on disk:
  - `packages/services/src/keys-service.ts`: FOUND (25887 bytes, 630 lines)
  - `packages/services/src/keys-service.test.ts`: FOUND (22834 bytes, 714 lines)
  - `packages/services/src/index.ts`: FOUND (4454 bytes, 83 lines)
- Type-check: `pnpm --filter @kehto/services type-check` → exit 0
- Full-repo type-check: `pnpm type-check` → 8/8 turbo tasks successful
- Full-repo build: `pnpm build` → 20/20 turbo tasks successful
- Unit tests: `pnpm test:unit` → 29/29 test files pass, 456/456 tests pass (+5 new vs 451 Plan 26-01 baseline)
- Keys-service tests alone: `pnpm test:unit packages/services/src/keys-service.test.ts` → 22/22 tests pass (was 17 baseline; +5 new bridge-path tests)
- Grep positive: `grep -c "export interface HostKeysBridge" packages/services/src/keys-service.ts` → 1 = 1 ✓
- Grep positive: `grep -c "export interface HostKeyEvent" packages/services/src/keys-service.ts` → 1 = 1 ✓
- Grep positive: `grep -c "hostBridge?: HostKeysBridge" packages/services/src/keys-service.ts` → 1 = 1 ✓
- Grep positive: `grep -cE "options\.hostBridge|bridge\.subscribe" packages/services/src/keys-service.ts` → 6 ≥ 2 ✓
- Grep positive: `grep -c "registerGlobalHotkey?" packages/services/src/keys-service.ts` → 1 ≥ 1 ✓
- Grep positive: `grep -c "onGlobalHotkey?" packages/services/src/keys-service.ts` → 1 ≥ 1 ✓
- Grep positive: `grep -c "unsubscribeHandles" packages/services/src/keys-service.ts` → 8 ≥ 2 ✓
- Grep positive: `grep -c "HostKeysBridge" packages/services/src/index.ts` → 2 ≥ 1 ✓
- Grep positive: `grep -c "HostKeyEvent" packages/services/src/index.ts` → 1 ≥ 1 ✓
- Grep positive: `grep -c "describe('HostKeysBridge integration'" packages/services/src/keys-service.test.ts` → 1 = 1 ✓
- Grep positive: `grep -c "createFakeBridge" packages/services/src/keys-service.test.ts` → 6 ≥ 2 ✓
- Grep positive: `grep -c "hostBridge:" packages/services/src/keys-service.test.ts` → 5 ≥ 4 ✓
- Barrel-surface check: built `dist/index.d.ts` contains `HostKeysBridge` 7 times (type re-export resolves through tsup DTS). `createKeysService` remains a function export.
- Describe-block preservation: 11 pre-existing describe lines in test file (1 top-level `createKeysService` + 5 nested + 5 Plan 26-01 top-level) + 1 new `HostKeysBridge integration` = 12 describe lines total. All pre-existing blocks preserved verbatim by line-for-line diff.
- Commits: N/A — plan explicitly instructed no commits; SUMMARY + code await a later-plan atomic commit.

## Self-Check: PASSED

---
*Phase: 26-real-keys-backend*
*Completed: 2026-04-19*
