---
phase: 13-theme-nub-implementation
verified: 2026-04-17T22:20:00Z
status: passed
score: 9/9 must-haves verified
---

# Phase 13: Theme Nub Implementation Verification Report

**Phase Goal:** Add the `theme` NUB end-to-end — runtime route, reference service, shell adapter API, plus theme-specific tests. ACL mapping for theme already landed in Phase 12's NUB-10 work.
**Verified:** 2026-04-17T22:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A napplet that sends `theme.get` through the shell receives a `theme.get.result` envelope from @kehto/runtime. (SC-1 / TH-01) | VERIFIED | `runtime.ts:1086` adds `case 'theme':` to the dispatch switch; `handleThemeMessage` at `runtime.ts:1034-1054` routes to the registered theme service (or fallback). `dispatch.test.ts:781-820` proves TH-01 happy path with a registered handler returning `theme.get.result`; `dispatch.test.ts:853-873` proves the fallback path emits `theme.get.result` with canonical defaults. |
| 2 | The reference theme service in @kehto/services answers `theme.get` with the current theme and broadcasts `theme.changed` when the host updates it. (SC-2 / TH-02) | VERIFIED | `theme-service.ts` defines `createThemeService` that returns `{ handler, publishTheme, getCurrentTheme }`. Handler answers `theme.get` at lines 159-166 with `{ type: 'theme.get.result', id, theme: currentTheme }`. `publishTheme` at lines 187-192 updates state and invokes `onBroadcast` with `{ type: 'theme.changed', theme }`. `theme-service.test.ts` covers defaults, initialTheme, publishTheme broadcast, getCurrentTheme, ACL envelope shape, unknown actions. |
| 3 | The hosting application can call a documented @kehto/shell adapter API to publish a theme change, and all registered napplets observe a `theme.changed` event. (SC-3 / TH-03) | VERIFIED | `shell-bridge.ts:111-134` adds JSDoc-documented `publishTheme(theme: Theme): void` to the ShellBridge interface. Implementation at `shell-bridge.ts:243-251` iterates `runtime.sessionRegistry.getAllEntries()` and posts `{ type: 'theme.changed', theme }` to each resolved iframe window. `shell-bridge.test.ts:111-146` asserts fanout to every registered napplet; `:148-178` asserts silent skip of stale sessions; `:180-196` asserts the API is a typed callable. Method visible in generated `packages/shell/dist/index.d.ts:419`. |
| 4 | A napplet without the `theme` capability is denied via @kehto/acl with the same error shape used by the other seven nubs. (SC-4 / TH-04) | VERIFIED | `acl/resolve.ts:164-167` `themeMap` returns `senderCap: 'theme:read'` for non-changed actions (already landed in Phase 12). Runtime ACL gate at `runtime.ts:1068-1076` emits `{ type: 'theme.get.error', id, error: formatDenialReason(...) }` for denied calls BEFORE dispatch. `dispatch.test.ts:822-851` proves end-to-end: `aclState.block(...)` causes `theme.get` to produce `theme.get.error` with error matching `/denied\|theme:read/i` and the registered service is NEVER invoked (`expect(serviceCalls).toHaveLength(0)`). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/services/src/theme-service.ts` | createThemeService factory returning `{ handler, publishTheme, getCurrentTheme }` with default theme | VERIFIED | 199 lines. Exports `createThemeService`, `ThemeServiceOptions`, `ThemeService`. DEFAULT_THEME at lines 57-65 matches canonical `#0a0a0a / #e0e0e0 / #7aa2f7`. Handler emits `theme.get.result`; unknown action emits `.error`. |
| `packages/services/src/theme-service.test.ts` | Vitest suite covering theme.get round-trip, defaults, publishTheme broadcast, ACL envelope, unknown action | VERIFIED | 192 lines, 8 tests across 5 describe blocks. All pass in vitest run. |
| `packages/services/src/index.ts` | Barrel exports createThemeService + types | VERIFIED | Lines 75-76: `export { createThemeService }` and `export type { ThemeServiceOptions, ThemeService }`. |
| `packages/runtime/src/runtime.ts` | `case 'theme':` + `handleThemeMessage` helper + fallback | VERIFIED | `THEME_FALLBACK_DEFAULT` constant at `:1030-1032`; `handleThemeMessage` at `:1034-1054`; `case 'theme':` added as 8th switch arm at `:1086` alongside relay/identity/keys/media/notify/storage/ifc. Fallback emits spec-correct `theme.get.result` when no service registered. |
| `packages/runtime/src/dispatch.test.ts` | TH-04 end-to-end ACL test + TH-01 happy path + fallback test | VERIFIED | `describe('theme NUB dispatch (TH-01 + TH-04)', ...)` at `:780-874` contains 3 tests: happy path, ACL denial, fallback. All pass. |
| `packages/shell/src/shell-bridge.ts` | publishTheme method on ShellBridge interface + implementation | VERIFIED | Interface member with JSDoc at `:111-134`. Implementation at `:243-251` iterates `runtime.sessionRegistry.getAllEntries()`, resolves windowId via `originRegistry.getIframeWindow`, posts envelope. |
| `packages/shell/src/shell-bridge.test.ts` | 3 publishTheme tests | VERIFIED | 197 lines, 3 tests in `describe('ShellBridge.publishTheme ...')`. Uses `makeTestHooks`, `makeFakeIframe`, `makeSessionEntry` helpers + beforeEach/afterEach `originRegistry.clear()`. |
| `docs/v1.2-NIP-5D-AUDIT.md` | DRIFT-RT-05, DRIFT-SHELL-05, DRIFT-SVC-06 annotated Resolved in Phase 13 | VERIFIED | Lines 74, 93, 111: all three rows show `Status: ✅ Resolved in Phase 13 (Plan 13-0{1\|2})`. Summary distribution at `:170` confirms Phase 13: 3 rows resolved. Plan ownership table at `:202-203` lists 13-01 → RT-05/SVC-06 and 13-02 → SHELL-05. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `runtime.ts` handleMessage switch | `serviceRegistry['theme'].handleMessage` | `case 'theme': return handleThemeMessage(windowId, envelope)` | WIRED | Line 1086 adds the switch case; `handleThemeMessage` at 1034-1054 calls `themeService.handleMessage(windowId, msg, send)` when registered. |
| `runtime.ts` ACL gate | `theme:read` capability check | `enforceNub(windowId, 'theme:read' as Capability, envelope)` | WIRED | Gate at 1068-1076 runs BEFORE the dispatch switch; `themeMap` in acl/resolve.ts:164 returns senderCap='theme:read' for `theme.get`. `dispatch.test.ts:822-851` proves end-to-end denial emits `theme.get.error`. |
| `services/index.ts` barrel | `theme-service.ts` | `export { createThemeService }` + `export type { ThemeServiceOptions, ThemeService }` | WIRED | Lines 75-76 match pattern in plan. |
| `shell-bridge.ts publishTheme` | `originRegistry.getIframeWindow(windowId).postMessage(...)` | `runtime.sessionRegistry.getAllEntries()` fanout loop | WIRED | Implementation at shell-bridge.ts:243-251 matches keys-forwarder.ts fanout pattern. Tests confirm fanout and stale-session skip. |
| `createShellBridge()` return | publishTheme closure | Added to returned object literal between `registerConsentHandler` and `get runtime()` | WIRED | Line 243 inside the returned object. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `theme-service.ts` handler | `currentTheme` | `options.initialTheme ?? DEFAULT_THEME`, updated by `publishTheme` | Yes — literal default OR host-provided initialTheme; mutated by publishTheme | FLOWING |
| `runtime.ts handleThemeMessage` fallback | `THEME_FALLBACK_DEFAULT` | Module-level const (mirrors services default) | Yes — spec-correct canonical theme | FLOWING |
| `shell-bridge.ts publishTheme` | `entries` | `runtime.sessionRegistry.getAllEntries()` (live runtime state) | Yes — real runtime session registry iteration | FLOWING |
| `shell-bridge.ts publishTheme` | `envelope` | `{ type: 'theme.changed', theme }` constructed from host-passed theme | Yes — flows from host call site through postMessage | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Monorepo type-check | `pnpm type-check` | 8/8 tasks successful (cached) | PASS |
| Full test suite | `npx vitest run` | 30 files passed / 1 skipped; 447 passed / 19 skipped / 0 failed in 1.24s | PASS |
| `publishTheme` on ShellBridge type in dist | `grep publishTheme packages/shell/dist/index.d.ts` | Found at line 419 (interface method) + lines 413-418 (JSDoc example) | PASS |
| `createThemeService` exported in dist | `grep publishTheme packages/services/dist/index.d.ts` | Found at 784 (ThemeService.publishTheme), plus JSDoc occurrences | PASS |
| `case 'theme':` in runtime source | `grep "case 'theme':" packages/runtime/src/runtime.ts` | Single match at line 1086 | PASS |
| DRIFT-RT-05 markers absent from source | `grep -rn DRIFT-RT-05 packages/` | Zero matches — only doc-level annotations remain | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TH-01 | 13-01 | @kehto/runtime registers a `theme` dispatch route that accepts `theme.get` and returns `theme.get.result` | SATISFIED | `runtime.ts:1086` case + `handleThemeMessage` + fallback emitting `theme.get.result`. `dispatch.test.ts` happy-path + fallback tests pass. REQUIREMENTS.md line 52 shows `[x]`. |
| TH-02 | 13-01 | @kehto/services provides a reference theme service that handles `theme.get` and broadcasts `theme.changed` on updates | SATISFIED | `theme-service.ts` provides `createThemeService` with `handler` + `publishTheme(theme): ThemeChangedMessage`. Tests in `theme-service.test.ts` cover the broadcast + get round-trip. REQUIREMENTS.md line 53 shows `[x]`. |
| TH-03 | 13-02 | @kehto/shell exposes an adapter API for the hosting application to publish theme changes to registered napplets | SATISFIED | `shell-bridge.ts:134` interface method + `:243-251` implementation. `shell-bridge.test.ts` covers broadcast + stale skip + type surface. Method visible in dist .d.ts line 419. REQUIREMENTS.md line 54 shows `[x]`. |
| TH-04 | 13-01 | @kehto/acl enforces capability gates for the `theme` domain consistent with the other seven nubs | SATISFIED | `acl/resolve.ts:164-167` themeMap (from Phase 12) + runtime ACL gate at `:1068-1076` + end-to-end test at `dispatch.test.ts:822-851` proving denied napplet receives `theme.get.error` with matching error shape. REQUIREMENTS.md line 55 shows `[x]`. |

All 4 Phase 13 requirements satisfied. No orphaned requirements detected: REQUIREMENTS.md traceability table lines 114-117 correctly map TH-01..TH-04 to Phase 13 with the exact plan IDs declared in the plan frontmatters.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scan coverage:
- `theme-service.ts` — no TODO/FIXME, no stub returns; handler populates real data from closure state; unknown-action path emits spec-correct `.error` envelope (not silent drop or null return).
- `runtime.ts` additions — no stubs; `THEME_FALLBACK_DEFAULT` is a deliberate canonical-default constant with JSDoc explaining the sync contract (not a placeholder).
- `shell-bridge.ts` additions — no stubs; `publishTheme` iterates live runtime state; silent-skip of unresolved windowIds is documented behavior (not a TODO).
- Tests — all tests assert concrete data shapes (envelope types, IDs, colors, call counts, error message matching).
- No `console.log` only implementations, no `return null` / `return {}` / `=> {}` placeholder handlers in the Phase 13 changes.

### Human Verification Required

None — all four success criteria are covered by deterministic automated tests.

### Gaps Summary

No gaps found. Phase 13 achieves the stated goal end-to-end:

- **Runtime route (TH-01):** 8th switch case present; happy path + fallback tested.
- **Reference service (TH-02):** `createThemeService` bundle with handler + publishTheme + getCurrentTheme; full unit coverage.
- **Shell adapter API (TH-03):** `bridge.publishTheme(theme)` on ShellBridge interface with JSDoc + implementation + 3-test coverage; visible on the exported type surface.
- **ACL enforcement (TH-04):** End-to-end test in dispatch.test.ts proves denied napplet receives `theme.get.error` with consistent error shape; service is not invoked on denial.

All three audit drift rows (DRIFT-RT-05, DRIFT-SVC-06, DRIFT-SHELL-05) annotated Resolved in `docs/v1.2-NIP-5D-AUDIT.md`. All four requirement checkboxes (TH-01..TH-04) flipped to `[x]` in `.planning/REQUIREMENTS.md` with correct traceability entries. Build + type-check + full vitest run all green (447 passed / 19 skipped / 0 failed).

---

_Verified: 2026-04-17T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
