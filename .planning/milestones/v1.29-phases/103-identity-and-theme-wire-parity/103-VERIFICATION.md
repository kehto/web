---
phase: 103-identity-and-theme-wire-parity
verified: 2026-07-23T22:30:45Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 103: Identity and Theme Wire Parity Verification Report

**Phase Goal:** Napplets receive private identity and theme state through only the result and change messages sanctioned by their NAP contracts.
**Verified:** 2026-07-23T22:30:45Z
**Status:** passed
**Re-verification:** No — initial verification

## Authority and Scope

Verified against the draft authority requested for this phase:
`napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f` —
`naps/NAP-IDENTITY.md`, `naps/NAP-THEME.md`, and `projections/web.md`.

That authority requires the nine read-only identity request/result pairs, an
empty public key on no signer, automatic `identity.changed` including `""` on
sign-out, a complete theme payload, automatic `theme.changed`, and no theme
subscription protocol.  The explicitly documented Kehto policy of returning a
complete non-sensitive theme fallback without `error` is a stricter permitted
host policy than NAP-THEME's optional error-only result example; it introduces
no new wire type.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `identity.getPublicKey` always produces one correlated `.result`; missing/rejected signer yields `pubkey: ""` with no error. | ✓ VERIFIED | `domain-results.ts`, `identity-handler.ts`, and `identity-service.ts` shape the empty sentinel; runtime and service tests cover success, absence, rejection, exact shape, and cardinality. |
| 2 | All other sanctioned identity reads use matching safe result shapes and all unknown identity actions are silent. | ✓ VERIFIED | `IDENTITY_SAFE_DEFAULTS` allowlists all nine reads; `identity-service.ts` handles `getList`, `getZaps`, `getMutes`, `getBlocked`, and `getBadges`; namespace test invokes every binding read including `listType`; dispatch tests cover unavailable/denied/registered-service ingress. |
| 3 | Identity is read-only, parent-bound, session-scoped, and cannot be forged, reassigned, or carried via shell/intent/INC traffic. | ✓ VERIFIED | `napplet-namespace.ts` freezes identity operations, verifies `event.source === target.parent`, and uses a non-configurable root descriptor. Its executable regressions reject assignment/descriptor/deletion attacks and forged direct, intent, and INC messages. |
| 4 | Normal identity transitions and sign-out reach each eligible live recipient exactly once, without proxy bypass. | ✓ VERIFIED | `createIdentityTransitionPublisher` deduplicates transitions; `ShellBridge.publishIdentityChanged` enumerates live session entries and checks frozen domain plus current ACL immediately before posting. Unit tests exercise normal, repeat, sign-out, revocation, destroyed/pre-session, and concurrent recipients; the submitted isolated IPv6 browser proof covers real normal/sign-out transitions. |
| 5 | Every supported `theme.get` path returns exactly one complete `theme.get.result`; unavailable/denied paths use the fixed no-error fallback. | ✓ VERIFIED | Runtime canonical shaping precedes ACL/firewall generic errors; unavailable handler and reference service use complete normalized themes. Dispatch and service tests verify normal, unavailable, ACL/firewall-denied, incomplete-state, exact-cardinality, and no-error behavior. |
| 6 | Unknown/denied theme actions do not manufacture `theme.*.error` or subscribe/unsubscribe behavior. | ✓ VERIFIED | Runtime drops non-allowlisted identity/theme input; service ignores unknown/subscribe/unsubscribe; protected binding has only `get` and `onChanged`; active-source guard rejects error wires and subscription surfaces. |
| 7 | One host theme update stores the complete value before emitting exactly one equal `theme.changed` to eligible sessions. | ✓ VERIFIED | `ThemeService.publishTheme` normalizes and assigns `currentTheme` before its sole callback. ShellBridge supplies recipient eligibility. Service, bridge, Paja-link, and playground browser tests prove ordering, one-push cardinality, same-value immediate read, forged-readiness silence, and recipient filtering. |
| 8 | Paja and playground use the single retained ThemeService-to-ShellBridge delivery path; alternate identity/theme proxy delivery fails closed. | ✓ VERIFIED | Paja's broadcast link forwards only through attached `ShellBridge.publishTheme`; playground creates the service with persisted initial theme and has one preference publish route. `IdentityProxy.emit()` and `ThemeProxy.emit()` throw before posting. Paja/browser and active-source guard regressions cover the route. |

**Score:** 8/8 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/runtime/src/domain-results.ts` | Canonical safe result allowlist | ✓ VERIFIED | Contains all nine identity defaults plus complete theme fallback. |
| `packages/runtime/src/runtime.ts`, `domain-handlers.ts`, `identity-handler.ts` | Denial, unavailable, and fallback wiring | ✓ VERIFIED | Canonical response selection occurs before generic errors; unknown identity/theme envelopes are dropped. |
| `packages/services/src/identity-service.ts`, `theme-service.ts` | Exact service results and state-before-push owner | ✓ VERIFIED | Explicit action branches, safe values, one normalized current theme, one callback. |
| `packages/shell/src/shell-bridge.ts`, `napplet-namespace.ts` | Eligible delivery and protected binding | ✓ VERIFIED | Runtime session/ACL fan-out plus frozen, parent-only identity/theme objects and root descriptor protection. |
| `packages/paja/src/theme-broadcast.ts`, `browser-host.ts` | Retained Paja theme path | ✓ VERIFIED | Attachment link routes a service callback to `publishTheme`; host has exactly one `publishTheme` mutation call. |
| `apps/playground/src/main-preferences.ts`, `shell-host.ts`, `main-signer.ts` | Single playground theme/identity paths | ✓ VERIFIED | Persisted theme seeds service before boot; one publish route; transition publisher suppresses duplicate and connecting snapshots. |
| `tests/unit/identity-theme-conformance-guard.test.ts` | Active-surface drift guard | ✓ VERIFIED | Covers prohibited error/subscription/raw-proxy and required route/documentation seams. |

`verify.artifacts` passed all declared artifacts except a non-semantic textual
pattern check for `browser-host.test.ts` looking for the literal phrase
`"theme broadcast"`. The substantive test exists, imports and calls
`createPajaThemeBroadcastLink`, proves state-before-forwarding, and passed in
the focused and full suites; this is not a missing or stubbed artifact.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Runtime ingress | canonical result helper | ACL/firewall/unavailable result shaping | ✓ WIRED | All declared links verified. |
| ShellBridge | session registry + current ACL | per-window recipient delivery | ✓ WIRED | Enumerates `getAllEntries()`, validates frozen domain and live `check()` before every post. |
| ThemeService | ShellBridge | callback → eligible automatic push | ✓ WIRED | Paja and playground feed the retained service callback into bridge publication, not raw proxy posts. |
| Injected API | `window.parent` | request settlement and changed events | ✓ WIRED | Source check precedes both result correlation and listener calls. |

All plan key links pass the automated verifier.  The Plan 103-02 ordering
pattern was also directly inspected: `currentTheme = normalizeTheme(theme)`
precedes `options.onBroadcast?.(envelope)` in `publishTheme`, and the callback
ordering test passed.

### Behavioral Spot-Checks

| Behavior | Command / evidence | Result | Status |
| --- | --- | --- | --- |
| Cross-layer identity/theme behavior | `pnpm exec vitest run` for runtime, services, shell, Paja, playground guards | 11 files, 251 passed | ✓ PASS |
| All unit regressions at current HEAD | `pnpm test:unit` | 112 files, 1,421 passed | ✓ PASS |
| Real browser identity/theme/Paja behavior | Submitted current-HEAD isolated IPv6 Playwright proof at `http://[::1]:4174` | 4 Phase 103 tests passed | ✓ PASS |
| Browser-test availability in this verifier process | `curl -g 'http://[::1]:4174'` | Preview intentionally not running; no server started or modified | ℹ️ not rerun locally |

The only retained browser failure cited by phase artifacts is the separate
Phase 102 Paja INC post-reload timeout. It does not exercise an identity or
theme requirement and no Phase 103 workaround altered it.

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| IDENTITY-01 | ✓ SATISFIED | Exact public-key fallback/result/cardinality coverage in runtime and reference service. |
| IDENTITY-02 | ✓ SATISFIED | Nine-read allowlist, matching binding/service results, safe defaults, and unknown silence. |
| IDENTITY-03 | ✓ SATISFIED | Readonly API, transition deduplication, eligible recipient push, and sign-out `""`. |
| IDENTITY-04 | ✓ SATISFIED | Parent provenance, immutable root/domain operations, live-session ACL fan-out, intent/INC isolation, fail-closed proxies. |
| THEME-01 | ✓ SATISFIED | Complete normal/fallback results in service, runtime unavailable, ACL, and firewall paths. |
| THEME-02 | ✓ SATISFIED | Unknown actions are silent; no error wire or invented API surface. |
| THEME-03 | ✓ SATISFIED | State-before-one-callback/service, recipient filtering, Paja forwarding, and playground read-after-change proof. |
| THEME-05 | ✓ SATISFIED | No subscribe/unsubscribe request, handler, or injected method; automatic change only. |

No Phase 103 requirement is orphaned from plan coverage.

### Anti-Patterns Found

No blocking debt markers (`TBD`, `FIXME`, or `XXX`), placeholder implementations,
or hard-coded empty user-facing stubs were found in the Phase 103 production
surface. Safe empty identity values are deliberate NAP-required fallback data,
not stubs.

## Out-of-Scope, Retained Work

- Phase 102 remains blocked on the repeated unopened-channel overflow ambiguity
  upstream and has a separate Paja INC-after-reload timeout. Neither is an
  identity/theme regression and Phase 103 intentionally leaves it unchanged.
- Phase 105 package publication/adoption remains dependent on released upstream
  convention-capable Napplet packages. It does not change the Phase 103 code
  contract verified here.

## Gaps Summary

No Phase 103 gaps found. The phase goal is achieved at current HEAD.

---

_Verified: 2026-07-23T22:30:45Z_
_Verifier: gsd-verifier_
