---
phase: 81-runtime-container-choke-point-integration
verified: 2026-06-15T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 81: Runtime Container & Choke-Point Integration Verification Report

**Phase Goal:** Integrate the pure `@kehto/firewall` engine into `@kehto/runtime`: `firewall-state.ts` container, optional `RuntimeAdapter` hooks (`firewallPersistence`/`onFirewallEvent`/`getFocusContext`), the post-ACL firewall gate in `createMessageHandler`, allow/deny/ask consent-and-remember (hoisted `ConsentHandler` + `firewall-policy` variant), shell-sourced focus, ephemeral counters + persisted config, and runtime integration tests. The 819-test baseline must stay green.
**Verified:** 2026-06-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the 8 phase requirement IDs)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | RUNTIME-01: firewall gate runs after ACL success, before dispatch; reject drops + sends `firewall:` error envelope | ✓ VERIFIED | `runtime.ts:298-313` — `enforceNub` ACL block (298-308), then `firewallGate(...)` (310), `if (verdict === 'drop') return;` (311), else `dispatchNubEnvelope` (313). Gate reject/prompt path (`runtime.ts:259-273`) sends `{ type, id, error: 'firewall: ${reason}' }` then returns `'drop'`. Tests assert `relay.publish.error` with `/firewall:/`. |
| 2 | RUNTIME-02: three new RuntimeAdapter hooks exist and are OPTIONAL | ✓ VERIFIED | `types.ts:742` `firewallPersistence?`, `:748` `onFirewallEvent?`, `:759` `getFocusContext?` — all three declared with `?:` (optional). `createFirewallState(hooks.firewallPersistence)` accepts undefined. |
| 3 | RUNTIME-03: container persists config only; counters in-memory (counters=newState) | ✓ VERIFIED | `firewall-state.ts:127` `counters = result.newState` on every evaluate; `:153` `persist()` serializes `config` only; `:162` load explicitly does NOT restore counters (comment + code). |
| 4 | RUNTIME-04: flag emits onFirewallEvent AND dispatches | ✓ VERIFIED | `runtime.ts:277-281` — `if (action === 'flag')` → `hooks.onFirewallEvent?.(...)` then `return 'dispatch'` (not dropped). Test "flag dispatches and audits": spy called with `action:'flag'`, `decision:'pass'`, no error envelope. |
| 5 | POLICY-01: per-napplet policy overrides rules | ✓ VERIFIED | Pure engine `evaluate.ts:142-173` — Tier 1 per-napplet policy is the most-specific hard override (allow→pass, deny→reject, ask→prompt) evaluated before rate/burst/content. Container exposes `setPolicy`. |
| 6 | POLICY-02: ask → reject + consent handler invoked (not the old dead-end) + choice persisted (no re-prompt) | ✓ VERIFIED | `void consentHandler` dead-end removed (grep: NONE FOUND). `consentHandlerRef` hoisted (`runtime.ts:415`), set in `registerConsentHandler` (`:354`), `fireConsent` invokes handler and on `resolve` calls `setPolicy(napplet, allow/deny)` + `persist()` (`:420-433`). Test: consent called exactly once, message 2 dispatches, no re-prompt. |
| 7 | FOCUS-01: focus only from getFocusContext (default {focused:true}); never napplet-self-reported | ✓ VERIFIED | `runtime.ts:222` `const focus = getFocusContext?.(windowId) ?? { focused: true };` in `buildObservation`. Focus is read only from the hook; envelope is never consulted for focus. |
| 8 | VERIFY-02: integration tests cover all six named attacks, deterministically | ✓ VERIFIED | `firewall-dispatch.test.ts` (470 lines, 12 tests): publish flood (flag→block), init-burst block, backgrounded+burst, kind-5 content matcher, ask reject+consent+remember, unfocused multiplier, + RUNTIME-04 flag. Volume-based assertions; 12/12 pass. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/runtime/src/firewall-state.ts` | container mirroring acl-state.ts | ✓ VERIFIED | 174 lines, `createFirewallState` + `FirewallStateContainer`, counters=newState, config-only persist |
| `packages/runtime/src/types.ts` | 3 optional hooks + FirewallPersistence/FirewallEvent + ConsentRequest variant | ✓ VERIFIED | hooks at 742/748/759 (all optional); `FirewallPersistence` (183), `FirewallEvent` (201); `ConsentRequest.event?` (378), `type?: 'firewall-policy'` (370), `napplet?` (386) |
| `packages/runtime/src/runtime.ts` | gate + observation builder + consent hoist | ✓ VERIFIED | `buildObservation` (211), `createFirewallGate` (249), gate insertion (310), `consentHandlerRef`/`fireConsent` (415-433), `firewallState` getter (380) |
| `packages/runtime/src/firewall-dispatch.test.ts` | six named attacks via handleMessage | ✓ VERIFIED | 12 tests driving `runtime.handleMessage`, all green |
| `packages/runtime/src/index.ts` | barrel exports new surface | ✓ VERIFIED | `FirewallPersistence`/`FirewallEvent` (29-30), `createFirewallState`/`FirewallStateContainer` (53-54) |
| `packages/runtime/package.json` | @kehto/firewall workspace dep | ✓ VERIFIED | line 24 `"@kehto/firewall": "workspace:*"` |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| createMessageHandler | firewallGate | verdict check after ACL success, before dispatch | ✓ WIRED (runtime.ts:310-313) |
| firewallGate | firewallState.evaluate | buildObservation → evaluate | ✓ WIRED (runtime.ts:253-254) |
| firewallGate (prompt) | consentHandlerRef.current | fireConsent → setPolicy on resolve | ✓ WIRED (runtime.ts:271, 420-433) |
| firewall-state.ts | @kehto/firewall | import evaluate/serialize/setPolicy/... | ✓ WIRED (firewall-state.ts:26-36) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Repo-wide type-check (forced, no cache) | `pnpm type-check --force` | 13/13 tasks successful, 0 cached, exit 0 | ✓ PASS |
| Runtime package tests | `npx vitest run packages/runtime` | 144/144 passed (12 files) | ✓ PASS |
| Full unit suite | `pnpm test:unit` | 840/840 passed (57 files); 819 baseline + 9 + 12 = 840, no regression | ✓ PASS |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| POLICY-01 | ✓ SATISFIED | evaluate.ts Tier-1 policy override |
| POLICY-02 | ✓ SATISFIED | consent hoist + persist-on-resolve + no-re-prompt test |
| FOCUS-01 | ✓ SATISFIED | buildObservation focus from hook only |
| RUNTIME-01 | ✓ SATISFIED | gate after ACL, before dispatch; reject envelope + drop |
| RUNTIME-02 | ✓ SATISFIED | 3 optional hooks |
| RUNTIME-03 | ✓ SATISFIED | config-only persist; counters=newState |
| RUNTIME-04 | ✓ SATISFIED | flag → audit + dispatch |
| VERIFY-02 | ✓ SATISFIED | 12 integration tests, all six attacks |

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`TBD`/`HACK`/`PLACEHOLDER` in any phase-81 file. No stubs — all decision paths wired. `fireConsent` no-op when no handler registered is correct host-opt-out behavior, not a stub.

### Phase Boundary Compliance

| Boundary | Status | Evidence |
|----------|--------|----------|
| No edits leaked into `packages/firewall/` (Phase 80) | ✓ CLEAN | `git status --short packages/firewall/` empty |
| Changeset NOT added here (Phase 82) | ✓ CORRECT | No `.changeset/*.md` files (only README) — closeout is Phase 82 |
| E2E closeout NOT done here (Phase 82) | ✓ CORRECT | VERIFY-03 (suite + E2E + changeset) remains Pending/Phase 82 in REQUIREMENTS.md |

### Public API Note (informational, for Phase 82 changeset)

`ConsentRequest.event` was relaxed from required to optional (`event?: NostrEvent`) and a `firewall-policy` variant added. SUMMARY 81-01 flagged this as a semver-minor change for the Phase 82 changeset. Not a gap — correctly deferred.

### Human Verification Required

None. All truths are verifiable programmatically and confirmed via test execution + code inspection.

### Gaps Summary

No gaps. All 8 phase requirement IDs are implemented and proven in code and tests. Type-check is clean repo-wide (the pre-existing acl-state.ts concern noted by the executor does NOT reproduce under a forced, non-cached run). The full unit suite is 840/840 with no regression against the 819 baseline. Phase boundaries (no firewall/ edits, no changeset/E2E closeout) are respected.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
