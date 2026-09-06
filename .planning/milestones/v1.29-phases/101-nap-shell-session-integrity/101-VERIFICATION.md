---
phase: 101-nap-shell-session-integrity
verified: 2026-07-23T17:25:27Z
status: passed
score: 25/25 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 101: NAP-SHELL Session Integrity Verification Report

**Phase Goal:** Napplets can establish one isolated shell session and synchronously discover only the domains that are both granted and live.
**Verified:** 2026-07-23T17:25:27Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Before `shell.init`, `supports(domain)` is false; afterwards it is true only for granted, live domains. | ✓ VERIFIED | `makeShell()` has no environment before the parent-only first init, and `supports()` does exact membership; `shell-supports-conformance.test.ts` and `napplet-namespace.test.ts` pass. |
| 2 | One bare `shell.ready` produces one uncorrelated `shell.init`; duplicate ready creates neither a second session nor init. | ✓ VERIFIED | Bridge-local `handleShellReady()` is registration-id idempotent; bridge tests pass duplicate, reload, and stable-WindowProxy vectors. |
| 3 | A frame cannot use a capability before a session, change trusted creation identity/source, or observe another frame's environment. | ✓ VERIFIED | Runtime returns before ACL/firewall/service/domain dispatch without a session; registry identity/environment snapshots are copied and frozen; dispatch and bridge isolation tests pass. |
| 4 | Shell, Paja, and playground omit unavailable/disabled domains. | ✓ VERIFIED | Resolver intersects live wiring, grants, and disabled controls before prelude/init; Paja and playground browser scenarios pass. |
| 5 | Registered frames cannot reach ACL, firewall, service, or domain dispatch before trusted first ready. | ✓ VERIFIED | `packages/runtime/src/runtime.ts:createMessageHandler` gates before all those branches; `dispatch.test.ts` spies pass. |
| 6 | A trusted registration creates at most one session/init, while a new registration after reload receives one new init. | ✓ VERIFIED | `shell-ready.ts` records registration IDs and replaces old session state only on re-registration; bridge reload tests pass. |
| 7 | Identity-less registered sources establish neither session nor init. | ✓ VERIFIED | `resolveNip5dIdentity()` returns null without registry/hook identity before registration or posting; dedicated bridge test passes. |
| 8 | Ready payload fields cannot replace source, window ID, d-tag, aggregate hash, or session identity. | ✓ VERIFIED | Bridge resolves `event.source` through `originRegistry`; forged ready-payload regression passes. |
| 9 | `ShellCapabilities` is domain-only and `shell.init` contains only `capabilities` and `services`. | ✓ VERIFIED | `buildShellCapabilities()` returns frozen `{ domains }`; `postShellInit()` builds only those normative fields; conformance/static tests pass. |
| 10 | Host resolution advertises only live/wired services and intersects grants/disabled controls without additions. | ✓ VERIFIED | `resolveShellEnvironment()` computes live availability then ordered intersection; shell-init matrix covers unwired, unavailable, disabled, alias, case, and duplicate inputs. |
| 11 | Each identity receives a fresh immutable environment. | ✓ VERIFIED | Resolver copies/freezes every list; same-input resolver regression proves equal but distinct snapshots. |
| 12 | One frame cannot observe or mutate another frame's environment. | ✓ VERIFIED | Two-frame bridge regressions prove isolated membership and mutation resistance. |
| 13 | Public type, wire shape, receiver, tests, and README expose one domain-only contract. | ✓ VERIFIED | Active-source legacy scan found no binary supports/numbered fields; `shell-supports-conformance` and NIP-5D guard pass. |
| 14 | Exact membership rejects adjacency, prefix, suffix, and case variants. | ✓ VERIFIED | Unary `includes` after string validation; namespace exact-membership vectors pass. |
| 15 | Empty, unknown, and invalid support inputs return false without acquiring support. | ✓ VERIFIED | `typeof domain === 'string'` guard plus pre-init cache; namespace vectors pass. |
| 16 | Support is invariant under environment ordering and duplicate inputs. | ✓ VERIFIED | Init cache de-duplicates/freeze-copies values; namespace ordering/duplicate fixtures pass. |
| 17 | The injected receiver precedes one bare ready, accepts only first parent init, and exposes frozen domains/services. | ✓ VERIFIED | `makeShell()` installs parent-only listener before posting ready, closes after first valid init, and freezes cached values; namespace tests pass. |
| 18 | Paja prelude and init use the same trusted identity/live resolver but retain independent immutable snapshots. | ✓ VERIFIED | `browser-target-frame.ts` resolves then registers/stores environment before `srcdoc`; Paja parity unit and browser tests pass. |
| 19 | Disabled/unavailable Paja domains/services are absent; manifest requirements cannot grant them. | ✓ VERIFIED | Paja resolver takes current shell wiring, and browser coverage proves disabled membership parity; targeted tests pass. |
| 20 | Paja registers source/identity before executable `srcdoc`, preserving reload invalidation. | ✓ VERIFIED | `registerFrameForGeneration()` precedes both `srcdoc` assignments; Paja reload browser scenario passes. |
| 21 | Rebuilding Paja's environment does not resurrect an absent domain. | ✓ VERIFIED | Paja parity tests exercise repeated resolution with disabled domains; targeted tests pass. |
| 22 | Playground resolves each frame from immutable trusted identity and live current wiring. | ✓ VERIFIED | `shell-host.ts` resolves identity/environment before requirement check, registry binding, and `srcdoc`; gateway guard and browser tests pass. |
| 23 | Playground prelude, `shell.init`, and unary `supports` agree; disabled/unwired items are absent while shell remains mandatory. | ✓ VERIFIED | Shared stored environment feeds prelude and ready response; service-toggle and gateway browser tests pass. |
| 24 | Playground verified artifact bytes remain the identity-bearing `srcdoc` payload; gateway/bootstrap do not become identity authority. | ✓ VERIFIED | Source guard plus `gateway-artifact-parity` browser test pass opaque-origin/verified-byte assertions. |
| 25 | Concurrent playground frames retain isolated live/granted snapshots. | ✓ VERIFIED | Per-frame stored frozen environment and concurrent disabled-service browser scenario pass. |

**Score:** 25/25 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/runtime/src/runtime.ts` | Total pre-session ingress gate | ✓ VERIFIED | Substantive early session lookup before authorization or dispatch. |
| `packages/shell/src/{shell-ready.ts,shell-bridge.ts,shell-init.ts}` | Trusted exactly-once handshake and immutable environment | ✓ VERIFIED | Source identity, registration lifecycle, resolver, and normative init payload are wired. |
| `packages/shell/src/{types.ts,index.ts,napplet-namespace.ts}` | Domain-only public/host/injected contract | ✓ VERIFIED | Resolver is host-exported; receiver remains unary and parent/first-init-bound. |
| `packages/*/src/*{bridge,init,namespace,dispatch}*.test.ts` | Handshake, isolation, and support regressions | ✓ VERIFIED | 175 targeted Vitest assertions passed. |
| `packages/paja/src/{browser-target-frame.ts,browser-host.ts,parity.ts}` | Paja identity/environment/srcdoc flow | ✓ VERIFIED | Resolver result is stored at registration before executable document construction. |
| `apps/playground/src/{demo-hooks.ts,shell-host.ts}` | Playground identity/environment/srcdoc flow | ✓ VERIFIED | One environment is resolved, stored, and used for prelude plus later init. |
| `tests/unit/{nip5d-conformance-guard,playground-gateway-guard}.test.ts` and Phase 101 E2E specs | Cross-surface and browser proof | ✓ VERIFIED | Static guards and 12 targeted browser scenarios passed. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Shell bridge | `handleShellReady` | Registered `event.source`, registration ID | ✓ WIRED | `shell.ready` remains bridge-local; unregistered sources are dropped. |
| Ready transition | Runtime session registry | First trusted identity | ✓ WIRED | `registerNip5dSessionIfNeeded()` calls `runtime.sessionRegistry.register()`. |
| Runtime handler | ACL/firewall/service/domain dispatch | Session gate | ✓ WIRED | Gate is structurally before every later branch and covered by dispatch spies. |
| Ready transition | Environment resolver and `Window.postMessage` | Identity-bound snapshot | ✓ WIRED | Stored/resolved environment is the sole source of `capabilities` and `services` in `shell.init`. |
| Paja target frame | Shared resolver and origin registry | Before `srcdoc` | ✓ WIRED | Registration and `setEnvironment()` precede both target-document paths. |
| Playground host | Shared resolver and origin registry | Before `srcdoc`/on replacement | ✓ WIRED | Environment is captured by creation identity and rebound to a replacement content window. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Shell ready/init | `ShellEnvironment` | Live adapter wiring + identity grant resolver | Domains/services are filtered, ordered, copied, and frozen | ✓ FLOWING |
| Paja frame | `environment` | `resolveShellEnvironment(adapter, identity)` | Persisted in origin registry and injected into verified `srcdoc` | ✓ FLOWING |
| Playground frame | `environment` | `getPlaygroundShellEnvironment(identity)` | Persisted per iframe and used by prelude/ready lifecycle | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Handshake, pre-session gate, exact support, resolver, Paja/playground static wiring | `pnpm exec vitest run …` (9 Phase 101 files) | 9 files, 175 tests passed | ✓ PASS |
| Paja reload/mandatory-shell lifecycle | Playwright `paja-single-window.spec.ts` | 5 passed | ✓ PASS |
| Playground live-disabled environment, isolation, and provenance | Playwright `demo-service-toggle.spec.ts`, `gateway-artifact-parity.spec.ts` | 6 passed | ✓ PASS |
| Playground injected-domain behavior | Playwright `naps-path-conformance.spec.ts` | 1 passed | ✓ PASS |

The repository's committed Playwright configuration targets `/usr/bin/chromium`, absent on this macOS host. The same focused browser tests were run with the installed Google Chrome through a temporary untracked config, removed immediately afterwards; no project configuration was changed. One combined run timed out waiting for the playground topology, then the single named test passed on its immediate clean rerun.

### Probe Execution

Step 7c: SKIPPED — no conventional `scripts/**/tests/probe-*.sh` files or phase-declared executable probe paths exist. The plan's “Probe 1–10” labels are covered by the focused test evidence above.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SHELL-01 | 101-02, 101-03 | Domain-only discovery; no numbered negotiation surface | ✓ SATISFIED | Types, init payload, receiver, README, static guard, and conformance tests agree. |
| SHELL-02 | 101-02–101-05 | Truthful local support before/after init | ✓ SATISFIED | Frozen first-init cache and live/granted resolver tested in unit and browser paths. |
| SHELL-03 | 101-01 | Mandatory exactly-once bare-ready handshake | ✓ SATISFIED | Source/registration ID state machine and duplicate/reload tests pass. |
| SHELL-04 | 101-01 | Pre-session isolation and non-reassignable identity/source | ✓ SATISFIED | Runtime total ingress gate and forged payload tests pass. |
| SHELL-05 | 101-01–101-05 | Per-frame read-only capability/service environments | ✓ SATISFIED | Fresh frozen snapshots, trusted registry binding, and concurrent frame tests pass. |
| SHELL-06 | 101-02, 101-04, 101-05 | Live host advertisement under disabled/simulation controls | ✓ SATISFIED | Resolver matrix and Paja/playground disabled-domain browser coverage pass. |

No orphaned Phase 101 requirements were found: all six mapped requirement IDs appear in plans and have direct implementation/test evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No Phase 101 `TBD`, `FIXME`, or `XXX` debt markers; empty returns found were defensive guards or test fixtures. | ℹ️ Info | No completion-blocking stub or debt marker. |

### Gaps Summary

No gaps found. The later milestone phases address other NAP domains and release work, not unmet Phase 101 session-integrity behavior; therefore no items were deferred.

---

_Verified: 2026-07-23T17:25:27Z_
_Verifier: the agent (gsd-verifier)_
