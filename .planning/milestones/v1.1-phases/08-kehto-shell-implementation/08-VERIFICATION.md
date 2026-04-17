---
phase: 08-kehto-shell-implementation
verified: 2026-04-07T22:48:10Z
status: gaps_found
score: 5/7 must-haves verified
re_verification: false
gaps:
  - truth: "aclStore.load() calls migrateAclState() from @kehto/acl and migrated entries use 2-segment keys throughout the store"
    status: partial
    reason: "migrateAclState() is imported and called in load() (SH-I04 wired), but aclKey() on line 33 still generates 3-segment pubkey:dTag:aggregateHash keys. After migration converts persisted keys to 2-segment format, any subsequent getOrCreate/check/grant/revoke call passes pubkey+dTag+hash through aclKey() and produces a 3-segment key that never matches the migrated 2-segment store entries. Newly written entries immediately re-create the old format."
    artifacts:
      - path: "packages/shell/src/acl-store.ts"
        issue: "aclKey() returns '${pubkey}:${dTag}:${aggregateHash}' (line 33) — still 3-segment. All public methods (check, grant, revoke, block, isBlocked, getEntry, getStateQuota) use aclKey(), so they cannot find entries persisted under 2-segment keys after migration. The file's own header comment says '2-segment composite key' but implementation contradicts this."
    missing:
      - "Change aclKey() to return '${dTag}:${aggregateHash}' (drop pubkey segment) to match the NIP-5D 2-segment format"
      - "Audit all callers of aclStore.check/grant/revoke/block to confirm pubkey is not semantically needed (it should not be — NIP-5D anchors identity to dTag:hash)"
human_verification:
  - test: "Verify shell.supports() surface is queryable from a napplet iframe"
    expected: "After shell.ready handshake, napplet can call window.napplet.shell.supports('signer') and get true synchronously (populated from shell.init capabilities)"
    why_human: "The shell.init message is sent but the @napplet/shim side that populates window.napplet.shell.supports() is in a different package — cannot verify end-to-end without a running iframe"
  - test: "Verify generateNostrBootstrap() script executes in a sandboxed iframe context"
    expected: "window.nostr is defined with all 7 method groups (getPublicKey, signEvent, getRelays, nip04.encrypt/decrypt, nip44.encrypt/decrypt) after script injection"
    why_human: "Script correctness requires browser execution — static analysis confirms the shape but cannot verify runtime behavior in a sandboxed iframe"
---

# Phase 08: Kehto Shell Implementation Verification Report

**Phase Goal:** @kehto/shell accepts only NappletMessage envelopes, injects window.nostr into sandboxed iframes, and advertises supported capabilities
**Verified:** 2026-04-07T22:48:10Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ShellBridge rejects any incoming message that is not a NappletMessage envelope | VERIFIED | `shell-bridge.ts:161` guard: `typeof msg !== 'object' \|\| msg === null \|\| typeof msg.type !== 'string'`. Array.isArray count = 0. |
| 2 | sendChallenge is removed from ShellBridge interface and implementation | VERIFIED | `grep -c sendChallenge packages/shell/src/shell-bridge.ts` = 0. Interface has no sendChallenge method. |
| 3 | Shell handles shell.ready handshake and responds with shell.init containing capabilities and services | VERIFIED | `shell-bridge.ts:164-173` handles `msg.type === 'shell.ready'`, calls `buildShellCapabilities(hooks)`, posts `{ type: 'shell.init', capabilities, services }` back to the iframe window. |
| 4 | generateNostrBootstrap() produces a script string installing window.nostr as a postMessage proxy | VERIFIED | `shell-init.ts:76-131` — returns IIFE string with pending-map request routing, window.nostr with all 7 NIP-07 methods covered. |
| 5 | buildShellCapabilities() returns ShellCapabilities from runtime config | VERIFIED | `shell-init.ts:42-47` — returns `{ nubs: ['relay'?, 'signer', 'storage', 'ifc'], sandbox: [] }` conditional on `hooks.relayPool`. |
| 6 | aclStore.load() calls migrateAclState() from @kehto/acl | VERIFIED (wired) | `acl-store.ts:13` imports `migrateAclState`, `acl-store.ts:259` calls it inside `load()`. Wiring is present. |
| 7 | aclStore post-migration uses 2-segment dTag:hash keys throughout (not 3-segment pubkey:dTag:hash) | FAILED | `aclKey()` at line 33 still generates `${pubkey}:${dTag}:${aggregateHash}`. Migration converts loaded keys to 2-segment, but every write path (getOrCreate, check, grant, revoke, block) calls `aclKey()` and produces 3-segment keys. Keys never match migrated entries. |

**Score:** 6/7 truths verified (truth 6 wired but truth 7 exposes a functional gap in the key format)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shell/src/shell-bridge.ts` | Envelope-only guard, sendChallenge removed, shell.ready handler | VERIFIED | All three present. Build succeeds (29.60 KB ESM). |
| `packages/shell/src/shell-init.ts` | generateNostrBootstrap(), buildShellCapabilities() | VERIFIED | Both functions exported. File exists with full implementations. |
| `packages/shell/src/index.ts` | ShellCapabilities, NappletMessage, generateNostrBootstrap, buildShellCapabilities exported | VERIFIED | All four accessible from barrel: `ShellCapabilities` in types block (line 27), `NappletMessage` in protocol types block (line 16), shell-init functions exported at line 45. |
| `packages/shell/src/types.ts` | SessionEntry.identitySource, ShellCapabilities, AclCheckEvent widened, onNip5dIframeCreate | VERIFIED | identitySource count=2, ShellCapabilities count=1, AclCheckEvent.message accepts `NappletMessage \| unknown[]`, onNip5dIframeCreate on ShellAdapter. |
| `packages/shell/src/acl-store.ts` | migrateAclState import and call in load() | PARTIAL | Import and call present; key format inconsistency (see gaps). |
| `packages/shell/src/origin-registry.ts` | register() with optional identity, getIdentity() | VERIFIED | OriginEntry struct, register() accepts optional identity param, getIdentity() method present. |
| `packages/shell/package.json` | @kehto/acl workspace:* dependency | VERIFIED | Line 21: `"@kehto/acl": "workspace:*"` in dependencies. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shell-bridge.ts` | `shell-init.ts` | `import { buildShellCapabilities }` | VERIFIED | Line 24 imports buildShellCapabilities; used at line 165 in shell.ready handler. |
| `shell-bridge.ts` | `@kehto/runtime handleMessage` | `runtime.handleMessage(windowId, msg)` | VERIFIED | Line 177 delegates non-shell envelopes to runtime. |
| `index.ts` | `shell-init.ts` | `export { generateNostrBootstrap, buildShellCapabilities }` | VERIFIED | Line 45 exports both functions. |
| `acl-store.ts` | `@kehto/acl migrateAclState` | `import { migrateAclState } from '@kehto/acl'` | VERIFIED | Line 13 imports, line 259 calls. |
| `types.ts` | `@napplet/core NappletMessage` | `import type { NappletMessage }` | VERIFIED | Line 11, re-exported at line 8. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `shell-bridge.ts` | `capabilities` in shell.init | `buildShellCapabilities(hooks)` | Yes — derives from hooks.relayPool presence | FLOWING |
| `shell-init.ts` | `nubs` array | `hooks.relayPool` truthiness check | Yes — conditional logic, not hardcoded | FLOWING |
| `generateNostrBootstrap()` | window.nostr methods | postMessage to parent (runtime-time) | N/A — generates proxy script, not data | N/A |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| shell package builds | `pnpm --filter @kehto/shell build` | ESM 29.60 KB, DTS 36.23 KB, 11ms | PASS |
| TypeScript type-check passes | `npx tsc --noEmit -p packages/shell/tsconfig.json` | Exit 0, no errors | PASS |
| Array.isArray absent from shell-bridge | `grep -c Array.isArray packages/shell/src/shell-bridge.ts` | 0 | PASS |
| sendChallenge absent from shell-bridge | `grep -c sendChallenge packages/shell/src/shell-bridge.ts` | 0 | PASS |
| shell.ready handler present | `grep -c shell.ready packages/shell/src/shell-bridge.ts` | 5 | PASS |
| window.nostr installed in bootstrap | `grep -c window.nostr packages/shell/src/shell-init.ts` | 6 | PASS |
| shell-init exported from barrel | `grep -c shell-init packages/shell/src/index.ts` | 1 | PASS |
| aclKey still 3-segment | `grep 'aclKey' packages/shell/src/acl-store.ts` | Line 33: `${pubkey}:${dTag}:${aggregateHash}` | FAIL (warning) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SH-I01 | 08-01, 08-02 | Replace Array.isArray envelope guard with envelope-only check | SATISFIED | shell-bridge.ts:161 object+type guard; no Array.isArray in handleMessage |
| SH-I02 | 08-02 | Implement window.nostr injection for sandboxed iframes | SATISFIED | shell-init.ts generateNostrBootstrap() covers all 7 NIP-07 method groups |
| SH-I03 | 08-01, 08-02 | Implement shell.supports() capability advertisement | SATISFIED | shell.init response includes ShellCapabilities; buildShellCapabilities() in shell-init.ts |
| SH-I04 | 08-01 | Integrate migrateAclState() trigger in acl-store.ts | PARTIAL | migrateAclState() is imported and called. However, the aclKey() function still produces 3-segment keys, causing key-mismatch between migrated (2-segment) and newly-written (3-segment) entries |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/shell/src/acl-store.ts` | 33 | `aclKey()` returns 3-segment `pubkey:dTag:aggregateHash` key while comment at line 4 states "keyed by dTag:aggregateHash — a 2-segment composite key" | Warning | After migration, entries loaded with 2-segment keys cannot be found by check/grant/revoke/block (all call aclKey with 3 args). NIP-5D sessions use empty pubkey `''`, so keys become `:dTag:hash` — still 3-segment. Migration is logically futile if new writes immediately re-create 3-segment keys. |

Note: The anti-pattern is classified Warning rather than Blocker because:
1. The build succeeds and TypeScript is clean
2. SH-I04's literal requirement (call migrateAclState() from @kehto/acl) IS met
3. The aclKey issue is a follow-on correctness bug, not a compilation or wiring failure
4. In NIP-5D flows, pubkey is always `''`, so keys become `:dTag:hash` — migration from `pubkey:dTag:hash` to `dTag:hash` has no effect when pubkey is already empty

### Human Verification Required

**1. shell.supports() queryable from napplet iframe**

**Test:** Create a test napplet iframe, send `{ type: 'shell.ready' }` postMessage, wait for `shell.init` response, verify response contains `capabilities.nubs` array and that @napplet/shim populates `window.napplet.shell.supports('signer')` as true
**Expected:** shell.init response arrives with `{ type: 'shell.init', capabilities: { nubs: ['signer', 'storage', 'ifc'], sandbox: [] }, services: [] }`
**Why human:** Requires a live iframe environment; the message-passing contract is verified statically but the handshake round-trip needs browser execution

**2. generateNostrBootstrap() executes correctly in sandboxed iframe**

**Test:** Inject `generateNostrBootstrap()` output into an iframe via srcdoc, verify `window.nostr` is defined with all 7 method groups accessible
**Expected:** `typeof window.nostr.getPublicKey === 'function'`, `typeof window.nostr.nip04.encrypt === 'function'`, etc.
**Why human:** Script requires browser execution — static analysis confirms the IIFE structure and method assignments are correct, but sandboxed iframe execution context must be validated

### Gaps Summary

One gap was identified:

**aclKey() key format mismatch:** The `aclStore` documentation states entries are keyed by `dTag:aggregateHash` (2-segment NIP-5D format), and `load()` correctly migrates persisted 3-segment keys using `migrateAclState()`. However, `aclKey()` at line 33 still generates `${pubkey}:${dTag}:${aggregateHash}` (3-segment). All public methods (`check`, `grant`, `revoke`, `block`, `isBlocked`, `getEntry`, `getStateQuota`) call `aclKey()` and therefore use 3-segment keys for all in-memory lookups and new writes. After migration converts loaded entries to 2-segment keys, those entries can never be found by the public API. In NIP-5D sessions where pubkey is `''`, the key becomes `:dTag:hash` which still differs from the 2-segment `dTag:hash` the migration targets. The fix is a one-line change: `return \`${dTag}:${aggregateHash}\``.

---

_Verified: 2026-04-07T22:48:10Z_
_Verifier: Claude (gsd-verifier)_
