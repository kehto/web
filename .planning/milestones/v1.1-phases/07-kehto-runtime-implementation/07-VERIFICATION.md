---
phase: 07-kehto-runtime-implementation
verified: 2026-04-07T22:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 7: Kehto Runtime Implementation Verification Report

**Phase Goal:** @kehto/runtime dispatches exclusively via NUB domain-prefix, with no AUTH machinery and envelope-only message handling
**Verified:** 2026-04-07T22:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                 | Status     | Evidence                                                                        |
|----|-----------------------------------------------------------------------|------------|---------------------------------------------------------------------------------|
| 1  | runtime.ts has no AUTH code                                           | VERIFIED   | Grep for pendingChallenges/authInFlight/VERB_REGISTER/sendChallenge returns 0   |
| 2  | handleMessage accepts only NappletMessage envelopes (no array)        | VERIFIED   | Guard at line 746: `typeof msg !== 'object' || !('type' in msg)` — silent drop  |
| 3  | handleRelayMessage implemented (subscribe/close/publish/query)        | VERIFIED   | Lines 446–597 — full switch with all 4 cases, no "not implemented" stub         |
| 4  | handleSignerMessage implemented (7 signer methods)                    | VERIFIED   | Lines 599–693 — full action dispatch: getPublicKey/signEvent/getRelays/nip0x    |
| 5  | handleStorageMessage delegates to handleStorageNub                    | VERIFIED   | Line 695–697 — single delegation call, handleStorageNub in state-handler.ts     |
| 6  | handleIfcMessage implemented (subscribe/emit/unsubscribe)             | VERIFIED   | Lines 699–740 — ifcSubscriptions Map, 3-case switch, cross-window delivery      |
| 7  | SessionEntry has identitySource discriminant 'auth' | 'source'        | VERIFIED   | types.ts lines 398–418 — field present with JSDoc explaining NIP-5D vs legacy   |
| 8  | SessionRegistry has getEntryByWindowId method                         | VERIFIED   | session-registry.ts lines 52, 122–124 — interface + implementation              |
| 9  | pnpm --filter @kehto/runtime build succeeds                           | VERIFIED   | Build output: ESM dist/index.js 48.02 KB, DTS dist/index.d.ts 48.93 KB, exit 0 |
| 10 | Tests exist and pass (dispatch.test.ts with 15+ tests)                | VERIFIED   | 61 tests pass across 3 test files; dispatch.test.ts has 44 tests                |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                        | Expected                                            | Status     | Details                                                             |
|-------------------------------------------------|-----------------------------------------------------|------------|---------------------------------------------------------------------|
| `packages/runtime/src/runtime.ts`               | NUB-only handleMessage, 4 domain handlers, no AUTH  | VERIFIED   | 847 lines; all 4 handlers implemented; AUTH code absent             |
| `packages/runtime/src/types.ts`                 | SessionEntry.identitySource, widened SendToNapplet  | VERIFIED   | identitySource: 'auth' | 'source'; SendToNapplet accepts NappletMessage |
| `packages/runtime/src/session-registry.ts`      | getEntryByWindowId method                           | VERIFIED   | byWindowIdEntry Map with register/unregister/clear maintenance      |
| `packages/runtime/src/enforce.ts`               | resolveCapabilitiesNub re-export, createNubEnforceGate | VERIFIED | Both exported; createNubEnforceGate takes windowId-based identity   |
| `packages/runtime/src/state-handler.ts`         | handleStorageNub function                           | VERIFIED   | New NUB envelope handler alongside legacy handleStateRequest        |
| `packages/runtime/src/dispatch.test.ts`         | NUB dispatch test suite                             | VERIFIED   | 44 tests covering all 4 domains, ACL, lifecycle                     |

### Key Link Verification

| From                                    | To                              | Via                          | Status   | Details                                                      |
|-----------------------------------------|---------------------------------|------------------------------|----------|--------------------------------------------------------------|
| `runtime.ts handleMessage`              | `enforce.ts`                    | `resolveCapabilitiesNub`     | WIRED    | Line 754: `const caps = resolveCapabilitiesNub(envelope);`   |
| `runtime.ts handleMessage`              | `enforce.ts`                    | `createNubEnforceGate`       | WIRED    | Lines 177–185: enforceNub created via createNubEnforceGate   |
| `runtime.ts handleMessage`              | `session-registry.ts`           | `getEntryByWindowId`         | WIRED    | Line 181: `sessionRegistry.getEntryByWindowId(windowId)`     |
| `runtime.ts handleStorageMessage`       | `state-handler.ts handleStorageNub` | function call            | WIRED    | Line 696: `handleStorageNub(windowId, msg, ...)`             |
| `runtime.ts handleRelayMessage`         | `hooks.relayPool`               | subscribe/publish calls      | WIRED    | Lines 505–531: pool.subscribe, pool.trackSubscription        |
| `runtime.ts handleSignerMessage`        | `hooks.auth.getSigner()`        | signer method delegation     | WIRED    | Line 637: `hooks.auth.getSigner()` with 7-method dispatch    |
| `runtime.ts handleIfcMessage`           | `hooks.sendToNapplet`           | `ifc.event` delivery         | WIRED    | Line 715: `hooks.sendToNapplet(subscriberWindowId, ...)`     |
| `packages/runtime/src/index.ts`         | `enforce.ts`                    | createNubEnforceGate export  | WIRED    | Line 43: exports createNubEnforceGate, resolveCapabilitiesNub |
| `packages/runtime/src/index.ts`         | `state-handler.ts`              | handleStorageNub export      | WIRED    | Confirmed by grep on index.ts                                |

### Data-Flow Trace (Level 4)

| Artifact                    | Data Variable       | Source                            | Produces Real Data | Status   |
|-----------------------------|---------------------|-----------------------------------|--------------------|----------|
| `runtime.ts relay handler`  | eventBuffer         | createEventBuffer + relayPool     | Yes — pool.subscribe or bufferAndDeliver | FLOWING |
| `runtime.ts storage handler`| statePersistence    | hooks.statePersistence (injected) | Yes — real get/set/keys operations | FLOWING |
| `runtime.ts signer handler` | signer methods      | hooks.auth.getSigner()            | Yes — delegates to real signer adapter | FLOWING |
| `runtime.ts ifc handler`    | ifcSubscriptions    | Map<topic, Set<windowId>>         | Yes — populated by ifc.subscribe messages | FLOWING |

### Behavioral Spot-Checks

| Behavior                                    | Command                                             | Result                                  | Status  |
|---------------------------------------------|-----------------------------------------------------|-----------------------------------------|---------|
| Build succeeds                              | pnpm --filter @kehto/runtime build                  | ESM 48.02KB, DTS 48.93KB, exit 0        | PASS    |
| 61 tests pass                               | pnpm vitest run packages/runtime/src/               | 61 passed (3 files), 254ms              | PASS    |
| AUTH symbols absent from runtime.ts         | grep pendingChallenges/authInFlight/sendChallenge   | 0 matches                               | PASS    |
| NUB handlers defined + referenced 8x        | grep -c handleRelayMessage/...                      | 8 (4 definitions + 4 switch cases)      | PASS    |
| Response type patterns present              | grep -c \.result/\.error/\.eose etc.                | 23 matches in runtime.ts                | PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                     | Status    | Evidence                                                            |
|-------------|-------------|------------------------------------------------------------------|-----------|---------------------------------------------------------------------|
| RT-I01      | 07-02       | Replace NIP-01 verb switch with NUB domain-prefix dispatch       | SATISFIED | handleMessage uses domain switch, no array fallback; 61 tests prove |
| RT-I02      | 07-02       | Remove AUTH machinery entirely (~24% of runtime.ts)              | SATISFIED | Zero matches for all AUTH symbols in runtime.ts                     |
| RT-I03      | 07-03       | Rewrite relay/signer/storage/ifc handlers for envelope format    | SATISFIED | All 4 handlers fully implemented; 44 dispatch tests cover all paths |
| RT-I04      | 07-01       | Implement SessionEntry identity anchor (identitySource field)    | SATISFIED | identitySource: 'auth' | 'source' in types.ts; 9 types.test.ts tests |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | —    | —       | —        | —      |

No stub markers, TODOs, or placeholder patterns found in the implementation files. The grep for `not implemented` in runtime.ts returns 0 matches. All handler functions have full implementations.

Note: `handleShellCommand` and `handleHotkeyForward` remain in runtime.ts but are intentionally unreachable from NUB dispatch (they handle legacy NIP-01 IPC_PEER events). This is a documented deferral to Phase 8 (shell migration), not a stub.

### Human Verification Required

None — all behaviors are verifiable programmatically given the test suite coverage and code analysis.

### Gaps Summary

No gaps. All must-haves are verified at all four levels (exists, substantive, wired, data-flowing). The build succeeds, 61 tests pass, AUTH machinery is absent, and NUB domain dispatch is fully operational.

---

_Verified: 2026-04-07T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
