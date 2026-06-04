---
slug: nip5d-session-not-registered
status: resolved
trigger: "GitHub issue #15 — NIP-5D source-identity napplets never added to sessionRegistry — runtime storage/state handler returns 'not registered'"
created: 2026-06-04
updated: 2026-06-04
---

# Debug: NIP-5D Source-Identity Napplets Never Registered (issue #15)

## Symptoms

**Expected:** Establishing a NIP-5D napplet's identity (via `originRegistry.register(...)` at iframe creation / the `onNip5dIframeCreate` hook) should produce a corresponding `runtime.sessionRegistry` entry with `provenance: 'nip-5d'`, so runtime domain handlers (storage/state, ifc, etc.) can resolve it via `getEntryByWindowId(windowId)`.

**Actual:** `originRegistry` and `runtime.sessionRegistry` are populated independently. The shell fills only `originRegistry`; nothing ever calls `runtime.sessionRegistry.register(...)` for source-identity napplets. So `getEntryByWindowId(windowId)` is always `undefined` and every storage operation returns `not registered`.

**Error messages:** `not registered` (then masked as `State request timed out` due to issue #14's error-envelope bug).

**Timeline:** Present in `@kehto/shell@0.2.0` / `@kehto/runtime@0.2.0`.

**Reproduction:** Mount a NIP-5D napplet, register via `originRegistry.register(contentWindow, windowId, { dTag, aggregateHash })`. From `@napplet/sdk` call `storage.setItem('k','v')`. Handler returns `not registered` because `runtime.sessionRegistry.getEntryByWindowId(windowId)` is `undefined`.

## Current Focus

hypothesis: CONFIRMED (validated against live source). `runtime.sessionRegistry` (created internally by `createRuntime`, runtime.ts:266) is the registry that `handleStorageNub` reads via `getEntryByWindowId`. Grep shows ZERO `sessionRegistry.register(...)` call sites for the source-identity path in `@kehto/shell` src. The `onNip5dIframeCreate` hook (shell types.ts:303) returns `{ dTag, aggregateHash, class }` intended for `originRegistry.register()`, but nothing bridges that into `runtime.sessionRegistry`. The shell-bridge comment (shell-bridge.ts:218-223) even claims the session entry "is always present by the time shell.ready arrives (registration happens at iframe creation time)" — but no such registration code exists.
test: Add the integration glue so NIP-5D identity establishment also registers a `runtime.sessionRegistry` entry (`provenance: 'nip-5d'`, pubkey `''`, dTag/aggregateHash/class from the iframe-create identity). Verify `getEntryByWindowId` resolves and storage round-trips. Clean break — align to the documented contract.
expecting: After registering a source-identity napplet, `runtime.sessionRegistry.getEntryByWindowId(windowId)` returns a populated entry and storage get/set/remove/keys succeed instead of returning `not registered`.
next_action: COMPLETE — integration seam implemented in shell-bridge shell.ready handler and verified.

## Evidence

- timestamp: 2026-06-04
  finding: `runtime.ts:266` `const sessionRegistry = createSessionRegistry(hooks.onPendingUpdate)` — the runtime owns its sessionRegistry; `handleStorageNub` and `shell-bridge.ts:224` both read `runtime.sessionRegistry.getEntryByWindowId(windowId)`.
  confirms: The runtime's internal registry is the authority for windowId→entry resolution.
- timestamp: 2026-06-04
  finding: `grep -rn "sessionRegistry.register\|\.register(" packages/*/src` (excluding tests) shows NO source-identity registration call site. `originRegistry.register` only populates the origin Window↔windowId map (origin-registry.ts:30-36).
  confirms: Source-identity napplets are never inserted into `runtime.sessionRegistry`.
- timestamp: 2026-06-04
  finding: `shell/src/types.ts:303` declares `onNip5dIframeCreate?: (windowId) => { dTag, aggregateHash, class } | null` but it is never invoked in shell src (only referenced in doc comments) and its return value is never bridged into `runtime.sessionRegistry`.
  confirms: The documented "identity at iframe creation" path has no implementation linking it to the runtime registry.
- timestamp: 2026-06-04
  finding: `SessionEntry` (runtime types.ts:398-425) requires `provenance: 'nip-5d' | 'legacy-auth'` (renamed from `identitySource: 'auth' | 'source'` in v1.8). The fix must set `provenance: 'nip-5d'`.
  confirms: Correct field/value for source-identity entries.

## Eliminated

- Shell's standalone `sessionRegistry`/`nappKeyRegistry` module being the authority. It is a separate map (lacks `getEntryByWindowId`), passed into adaptHooks but never read by the runtime for storage — vestigial for this path. The authority is `runtime.sessionRegistry` (created internally at runtime.ts:266).
- A missing AUTH/legacy registration call site as the cause. There is no such call site for any provenance; the runtime by design expects the integration layer (shell) to register. The gap was specific to wiring NIP-5D identity in.

## Resolution

root_cause: NIP-5D source-identity napplets were never inserted into `runtime.sessionRegistry`. Hosts call `originRegistry.register(win, windowId, {dTag, aggregateHash})` and the `onNip5dIframeCreate` hook returns identity, but nothing bridged either into `runtime.sessionRegistry`. Because `handleStorageNub` (and other domain handlers) resolve identity via `runtime.sessionRegistry.getEntryByWindowId(windowId)`, every source-identity napplet resolved to `undefined` and returned `not registered`. The shell-bridge's own comment claimed the entry "is always present by the time shell.ready arrives" — but no code made that true.

fix: In `packages/shell/src/shell-bridge.ts`, the `shell.ready` handler now ensures a `runtime.sessionRegistry` entry exists for the windowId. When `getEntryByWindowId(windowId)` is undefined it resolves identity (1) from `hooks.onNip5dIframeCreate?.(windowId)` — preferred, supplies `class` — else (2) from `originRegistry.getIdentity(win)`, and registers a source-identity `SessionEntry` (`pubkey: ''`, `provenance: 'nip-5d'`, `origin: event.origin`, `type: 'nip5d'`, `dTag`/`aggregateHash` from identity, `registeredAt: Date.now()`, `instanceId: crypto.randomUUID()`, `class` from the hook `?? null`). If neither source yields identity, registration is skipped (genuinely non-NIP-5D / no identity supplied), so existing identity-less tests are unaffected. The existing `resolvedClass` lookup naturally picks up the class from the freshly-registered entry. Clean break — realizes the documented "registered by shell.ready" contract with no legacy shim.

verification: `pnpm build`; `pnpm test:unit` — 569 tests across 35 files pass (includes new shell-bridge tests: originRegistry-identity registration, onNip5dIframeCreate-hook registration, storage.get returns canonical `storage.get.result` with no `not registered` error post-handshake, and a set→get round-trip). `pnpm type-check` — clean.

files_changed:
  - packages/shell/src/shell-bridge.ts (shell.ready handler registers source-identity SessionEntry into runtime.sessionRegistry; imports SessionEntry from @kehto/runtime)
  - packages/shell/src/shell-bridge.test.ts (4 new tests covering both identity-resolution paths + storage round-trip)

followup: `instanceId` uses `crypto.randomUUID()` per shell.ready, so it does not "survive page reloads" as the SessionEntry doc describes. It does NOT affect storage scoping (which keys on dTag+aggregateHash, not instanceId), so it is non-blocking for these issues. A durable-instanceId derivation is a separate enhancement.
