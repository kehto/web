# Phase 103: Identity and Theme Wire Parity - Research

**Researched:** 2026-07-23  
**Domain:** NAP-IDENTITY and NAP-THEME browser/runtime wire conformance  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None recorded; the CONTEXT.md Decisions section contains only the discretion
entry below.

### the agent's Discretion

All implementation choices are at the agent's discretion because discuss phase
is disabled by project setting. Use the Phase 103 roadmap goal, success
criteria, exact active NAP contracts, prior session-integrity decisions, and
existing codebase patterns. Do not weaken the Phase 102 blocker or pull
published-package adoption forward from Phase 105.

### Deferred Ideas (OUT OF SCOPE)

- Published Napplet package adoption and live package-backed host flows remain
  in Phase 105.
- Phase 102 repeated unopened-handle overflow semantics remain tracked in
  `kehto/web#203` and must not be silently resolved inside this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| IDENTITY-01 | `getPublicKey` always uses `.result` and empty pubkey on failure. | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] defines the empty-string sentinel; current service and runtime fallback still have `.error` catch paths. |
| IDENTITY-02 | Other reads use safe result shapes; unknown actions are ignored. | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] enumerates each result field and optional `error`; current service/fallback emit unknown `.error` envelopes. |
| IDENTITY-03 | API is readonly; change events, including sign-out, are exactly once to affected sessions. | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] defines read-only operations and `identity.changed`; current playground sends bootstrap/poll-related duplicates. |
| IDENTITY-04 | Identity is session-scoped and cannot be forged, reassigned, or leaked through other domains. | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`; naps@896c32c `projections/web.md`] separates shell-user identity from source-bound napplet identity. |
| THEME-01 | `theme.get.result` is the only result and has complete required colors. | [VERIFIED: naps@896c32c `naps/NAP-THEME.md`] requires all three color fields in every theme payload; the existing runtime fallback supplies them. |
| THEME-02 | Unknown, denied, and unavailable paths do not create `theme.*.error`. | [VERIFIED: roadmap/requirements] makes this Kehto acceptance contract; current generic ACL/firewall and service unknown-action paths generate `.error`. |
| THEME-03 | One host update updates stored state and emits one matching changed event. | [VERIFIED: naps@896c32c `naps/NAP-THEME.md`] defines the get/change pair; current playground duplicates fan-out and does not update the service state. |
| THEME-05 | No invented theme subscription protocol. | [VERIFIED: naps@896c32c `naps/NAP-THEME.md`] explicitly says no subscribe/unsubscribe mechanism exists. |
</phase_requirements>

## Summary

[VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] NAP-IDENTITY is a read-only shell-user identity surface. `identity.getPublicKey` is exceptional: it always answers `identity.getPublicKey.result` with `pubkey: ""` when no signer exists or the signer lookup fails, and it never carries an error field. Other supported reads answer their matching `.result` with a safe default plus optional sanctioned `error`; an `identity.changed` push carries either a pubkey or `""` for sign-out. The NAP document is unchanged from the merged baseline at `6461e4b`, while the browser-projection authority is draft #90 head `896c32c92deee68dc4d10fc1132b62df20cccb6f`.

[VERIFIED: naps@896c32c `naps/NAP-THEME.md`] NAP-THEME exposes only `theme.get`/`theme.get.result` and automatic `theme.changed` pushes; it has no theme subscribe or unsubscribe wire protocol. Every normal theme payload must contain `colors.background`, `colors.text`, and `colors.primary`. The proposed web projection does not add identity/theme-specific wire fields; it preserves the source-bound `postMessage` trust boundary established by Phase 101.

**Primary recommendation:** Centralize canonical identity/theme result and host-push delivery in the runtime/shell boundary; make both hosts call the same state-then-single-broadcast theme service path, and remove per-host raw or duplicate identity/theme fan-out.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Identity request/result normalization | API / Backend (runtime) | Browser/client binding | [VERIFIED: codebase `packages/runtime/src/identity-handler.ts`, `packages/services/src/identity-service.ts`] runtime/service own replies; binding correlates only matching results. |
| Session-scoped identity and theme pushes | Frontend Server (shell bridge) | API / Backend (runtime ACL/session) | [VERIFIED: codebase `packages/shell/src/shell-bridge.ts`, `packages/shell/src/shell-ready.ts`] bridge has iframe access while runtime owns authenticated sessions and ACL state. |
| Readonly injected APIs | Browser / Client | Frontend Server | [VERIFIED: codebase `packages/shell/src/napplet-namespace.ts`] common prelude exposes `get` and change listeners and must source messages only from parent. |
| Stored theme and atomic host updates | API / Backend (theme service) | Frontend Server | [VERIFIED: codebase `packages/services/src/theme-service.ts`] one service owns `currentTheme`; the host bridge must send the one resulting push. |
| Paja/playground integration | Browser / Client host | Shared services/shell | [VERIFIED: codebase `packages/paja/src/browser-host.ts`, `apps/playground/src/main-preferences.ts`] both hosts already own user-facing theme controls but should not fork protocol behavior. |

## Project Constraints (from AGENTS.md)

- [VERIFIED: `AGENTS.md`] Read the owning NAP specification before changing any NAP surface and record the exact checked ref in tests/docs/closeout.
- [VERIFIED: `AGENTS.md`] Keep NAP changes wired through runtime, shell, Paja, playground, ACL/capability mapping, docs, and tests; do not rely on stale package exports as contract authority.
- [VERIFIED: `AGENTS.md`] Preserve the Phase 101 NAP-SHELL source-bound session gate and frozen per-frame environment; no capability traffic before a session.
- [VERIFIED: `AGENTS.md`] Use strict ESM TypeScript, lowercase-hyphenated files, public JSDoc, explicit-path staging, focused tests, and full build/type/unit/docs/AI-slop gates before shipping.
- [VERIFIED: `AGENTS.md`] Do not publish locally; package release/package adoption is GitHub Actions/tag driven. This phase must not adopt unpublished `@napplet/*` APIs reserved for Phase 105.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| Existing `@kehto/runtime`, `@kehto/shell`, `@kehto/services` workspace sources | workspace | Runtime dispatch, trusted browser bridge, reference services | [VERIFIED: codebase `package.json`, `packages/*/src`] Phase work is a correction of existing seams; no new library is needed. |
| Existing `@napplet/core` / `@napplet/nap` installed line | existing lockfile | Current local envelope and type imports | [VERIFIED: codebase `packages/services/src/{identity-service,theme-service}.ts`] Use only currently exported types; release-line adoption remains Phase 105. |
| Vitest 4.1.2 / Playwright 1.54.0 | root devDependencies | Unit, static, and opaque-origin host proof | [VERIFIED: codebase `package.json`, `vitest.config.ts`, `playwright.config.ts`] Existing project test framework and browser harness. |

**Installation:** No packages. [VERIFIED: phase boundary]

## Architecture Patterns

### System Architecture Diagram

```text
napplet iframe
  |  identity.* / theme.get (authenticated source after shell.ready)
  v
ShellBridge.handleMessage -> Runtime session/domain/ACL/firewall gate
  |                                      |
  |                                      +-- reject/deny -> canonical same-domain .result only
  v
identity handler / theme handler -> reference service current state
  |                                      |
  +-- matching *.result -----------------+--> source iframe

host identity/theme change
  |
  v
single host service update -> stored Theme / authenticated eligible-session filter
  |                                      |
  +-- one identity.changed or theme.changed per eligible iframe --> common prelude listener
```

[VERIFIED: codebase `packages/runtime/src/runtime.ts`, `packages/shell/src/shell-bridge.ts`, `packages/services/src/theme-service.ts`] The implementation should retain this split: the runtime decides whether an authenticated session may use a domain, services create canonical payloads, and the bridge performs the final browser post only to eligible source-bound frames.

### Pattern 1: Canonical result factory before service dispatch

**What:** Introduce a small, typed internal response-shaping seam for `identity.*` and `theme.get` which is usable by normal handlers and the pre-dispatch ACL/firewall denial paths. [VERIFIED: codebase `packages/runtime/src/runtime.ts:295-342`] Both denial gates currently derive `${request}.error`, so fixing only service handlers cannot satisfy denied-request behavior.

**Use:** Map each supported identity action to its exact safe default (`pubkey: ""`, `{}`, `null`, `[]`) and map `theme.get` to a complete default/current theme result. Ignore unknown actions before a generic ACL/firewall response can manufacture an unsupported envelope. [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`, `naps/NAP-THEME.md`; VERIFIED: codebase `packages/services/src/identity-service.ts`, `packages/services/src/theme-service.ts`]

### Pattern 2: One eligible-session push primitive

**What:** Replace `originRegistry.getAllWindowIds()` broadcast with a shared shell/runtime helper that iterates only live sessions, checks the frozen granted domain, then applies recipient capability policy before `sendToNapplet`. [VERIFIED: codebase `packages/shell/src/shell-bridge.ts:205-215`, `packages/shell/src/shell-ready.ts:18-35`, `packages/runtime/src/runtime.ts:304-342`]

**Use:** Have `publishIdentityChanged(pubkey)` call this primitive for `identity`, and the theme-service callback call it for `theme`. This makes the normal and sign-out identity values equally scoped and gives both Paja and playground the identical host-independent delivery path. [VERIFIED: roadmap Phase 103 success criteria]

### Pattern 3: State then exactly-one push

**What:** Keep `ThemeService.publishTheme(theme)` as the only state mutation and have its single `onBroadcast` callback reach the eligible-session primitive exactly once. [VERIFIED: codebase `packages/services/src/theme-service.ts:181-193`] The callback is synchronous after assigning `currentTheme`, so a subsequent `theme.get` sees the same payload before or alongside the one push.

**Use:** Paja must replace its no-op `onBroadcast` wiring; playground must remove its direct iframe loop and call only the shared service update. [VERIFIED: codebase `packages/paja/src/browser-adapter.ts:324-335`, `apps/playground/src/demo-hooks.ts:128-154`, `apps/playground/src/main-preferences.ts:72-78`]

### Anti-Patterns to Avoid

- **Derived `.error` envelopes:** [VERIFIED: codebase `packages/runtime/src/runtime.ts:295-302`] `${type}.error` is generic infrastructure, not an identity/theme contract.
- **Raw host fan-out:** [VERIFIED: codebase `apps/playground/src/main-preferences.ts:75-77`, `packages/shell/src/shell-bridge.ts:205-215`] Direct iframe loops bypass session/domain/ACL eligibility and can duplicate messages.
- **Initial/poll-driven identity pushes:** [VERIFIED: codebase `apps/playground/src/shell-host.ts:239-241,398-399,427`] Two scheduled pushes plus a request-tap push violate exactly-once lifecycle semantics.
- **Solving package fixture failures here:** [VERIFIED: phase 103 context] Published package adoption and live package-backed flows are Phase 105; no compatibility overload should be guessed.

## Exact Current Gaps and Likely File Set

| Gap | Evidence | Implementation direction | Likely files |
|---|---|---|---|
| `getPublicKey` failure produces two `.error` messages. | [VERIFIED: codebase `packages/services/src/identity-service.ts:183-190`] `sendSignerError` calls `sendIdentityError` twice; runtime fallback also creates `.error`. | Always produce exactly one `.result { id, pubkey: "" }`; remove error helper use for this action in both service and fallback. | `packages/services/src/identity-service.ts`, `packages/runtime/src/identity-handler.ts`, focused tests. |
| Other identity no-signer/failure/unknown shapes drift. | [VERIFIED: codebase `packages/services/src/identity-service.ts:207-216,407-419`, `packages/runtime/src/identity-handler.ts:30-53`] no signer and unknown actions use `.error`. | Supported actions return their matching safe result field, with optional error only where sanctioned; unknown actions silently do nothing. | Same identity files; `packages/acl/src/resolve.ts`; `packages/runtime/src/dispatch.test.ts`. |
| Denials/firewall paths can synthesize identity/theme `.error`. | [VERIFIED: codebase `packages/runtime/src/runtime.ts:270-302,324-334`] generic gate derives error type from inbound request. | Add a narrow canonical-denial-envelope factory, used by both ACL and firewall paths; preserve existing behavior for unrelated domains. | `packages/runtime/src/runtime.ts`, tests. |
| Theme service turns unknown messages into `.error`. | [VERIFIED: codebase `packages/services/src/theme-service.ts:168-173`] | Ignore unknown `theme.*`; keep only `theme.get.result`. | `packages/services/src/theme-service.ts`, tests. |
| Theme unavailable/denied handling is not a complete result. | [VERIFIED: codebase `packages/runtime/src/domain-handlers.ts:169-185`, `packages/runtime/src/dispatch.test.ts:1289-1318`] fallback is complete but denial is `.error`. | Return one complete `theme.get.result` via the canonical fallback/current theme source and do not create `theme.*.error`. | `packages/runtime/src/runtime.ts`, `packages/runtime/src/domain-handlers.ts`, tests. |
| Pushes bypass eligibility and are not exactly once. | [VERIFIED: codebase `packages/shell/src/shell-bridge.ts:205-215,267-275`] every origin registration is targeted, regardless of session/domain; [VERIFIED: codebase `apps/playground/src/shell-host.ts:239-241,398-399`] adds duplicates. | Shared eligible-session push helper; delete duplicate scheduling/request-tap sends. | `packages/shell/src/shell-bridge.ts`, `packages/shell/src/shell-ready.ts` or runtime API, `apps/playground/src/shell-host.ts`, bridge tests. |
| Playground theme update sends twice and misses service state. | [VERIFIED: codebase `apps/playground/src/main-preferences.ts:72-78`, `apps/playground/src/demo-hooks.ts:128-154`] service `onBroadcast` is no-op, preferences both bridge-publishes and raw-posts. | Route one host action through `ThemeService.publishTheme`, with one service callback to bridge delivery; remove raw post loop. | `apps/playground/src/demo-hooks.ts`, `apps/playground/src/main-preferences.ts`, host/unit/E2E tests. |
| Paja updates service state but does not fan out. | [VERIFIED: codebase `packages/paja/src/browser-adapter.ts:324-335`, `packages/paja/src/browser-host.ts:571-581`] `onBroadcast` is no-op. | Wire the captured service's callback to the same bridge eligible-session delivery and add browser proof. | `packages/paja/src/browser-adapter.ts`, `packages/paja/src/browser-host.ts`, Paja tests. |
| Identity/theme domain objects can be replaced after namespace assignment. | [VERIFIED: codebase `packages/shell/src/napplet-namespace.ts:1397-1459`] only INC is restored from a protected canonical implementation; nonempty identity/theme replacements are kept. | Keep objects read-only in public shape; decide whether replacement protection is needed only to preserve host-owned read APIs, without broadening Phase 102's INC-specific rule. | `packages/shell/src/napplet-namespace.ts`, tests. |
| Active examples/tests still assert forbidden error paths. | [VERIFIED: codebase `apps/playground/src/signer-modal.ts:229-235`, `tests/e2e/paja-single-window.spec.ts:272-279`, service/runtime tests] | Delete/rewrite tests and instrumentation to observe canonical result shapes. | named files plus docs/policy guards as needed. |

## Contract Clarification Requiring an Explicit Plan Note

[VERIFIED: naps@896c32c `naps/NAP-THEME.md` Error Handling] The upstream NAP permits an error-bearing `theme.get.result` in which other result fields are undefined. [VERIFIED: roadmap/requirements THEME-01/02] Phase 103 instead requires a single *complete* result even for denied/unavailable paths and forbids `theme.*.error`. These rules can be reconciled without inventing a wire type by returning a complete fallback theme and omitting `error`; however, attaching an `error` while retaining colors would be a Kehto-specific extension not shown in the NAP. The planner must record this as an upstream-spec-gap reconciliation and must not silently add a nonstandard mixed `theme`+`error` payload.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Browser message source authentication | Per-host `event.source` guesses or raw `postMessage` loops | [VERIFIED: codebase `packages/shell/src/origin-registry.ts`, `packages/shell/src/shell-ready.ts`] trusted origin registry and Phase 101 source-bound session lifecycle | Preserves immutable creation identity and session gate. |
| Theme state synchronization | Separate Paja/playground caches | [VERIFIED: codebase `packages/services/src/theme-service.ts`] existing `ThemeService.publishTheme/getCurrentTheme` | One state owner makes get/push equality testable. |
| Identity request correlation | New subscription/event protocol | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] existing shared prelude request correlation and `identity.changed` listener | NAP uses result IDs and automatic push only. |

## Common Pitfalls

### Pitfall 1: Fixing handlers but leaving ingress denials untouched

[VERIFIED: codebase `packages/runtime/src/runtime.ts:270-342`] ACL and firewall execute before domain handlers, so a service-only fix still sends `theme.get.error` on denial. Test both gate paths and the unavailable-service fallback.

### Pitfall 2: Leaking a push before `shell.ready`

[VERIFIED: codebase `packages/shell/src/shell-bridge.ts:205-215`] `originRegistry` represents iframe registration, not necessarily an authenticated runtime session. Eligibility must begin with the live session registry and frozen granted domain, not iframe existence.

### Pitfall 3: Counting host fan-out rather than protocol deliveries

[VERIFIED: codebase `apps/playground/src/main-preferences.ts:72-78`] calling `publishTheme` and then manually posting creates two indistinguishable `theme.changed` envelopes. Assert per-recipient message cardinality and that `theme.get` returns the exact emitted object.

### Pitfall 4: Treating `identity.changed` as a snapshot retry mechanism

[VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] startup snapshot is `getPublicKey`; changed is only for actual shell-user identity transitions. Remove timeout/request-tap pushes and test sign-out (`""`) once.

### Pitfall 5: Accidentally coupling this phase to Phase 102 or 105

[VERIFIED: phase 103 context] Do not change INC channel overflow behavior, and do not update package versions/fixtures to emulate unpublished APIs. The focused tests here must use the current shared prelude and host seams only.

## Code Examples

### Canonical public-key failure result

```ts
// Source: [VERIFIED: naps@896c32c naps/NAP-IDENTITY.md]
send({ type: 'identity.getPublicKey.result', id, pubkey: '' });
```

### Complete theme fallback result

```ts
// Source: [VERIFIED: roadmap THEME-01/THEME-02; naps@896c32c naps/NAP-THEME.md]
send({
  type: 'theme.get.result',
  id,
  theme: { colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' } },
});
```

### State-before-push theme update

```ts
// Source: [VERIFIED: codebase packages/services/src/theme-service.ts]
const envelope = themeService.publishTheme(nextTheme); // updates getCurrentTheme first
// The sole onBroadcast callback delivers this envelope to eligible sessions.
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Protecting a later `window.napplet.identity`/`theme` assignment is necessary to satisfy “readonly API,” rather than merely freezing the originally injected API. | Exact Current Gaps | Could overextend the Phase 102 INC-specific replacement rule. |

## Open Questions

1. **Complete denied/unavailable theme result versus upstream error-only example**
   - What we know: [VERIFIED: roadmap THEME-01/02] requires a complete `.result` without `.error` types; [VERIFIED: naps@896c32c `naps/NAP-THEME.md`] shows an optional error-only result.
   - What's unclear: Whether upstream intends complete fallback-without-error for denied/unavailable cases.
   - Recommendation: Implement the roadmap-required complete fallback without an `error` field, document the reconciliation next to the test, and retain it as an upstream spec-gap note rather than adding mixed payload fields.

2. **Identity/theme domain replacement protection**
   - What we know: [VERIFIED: codebase `packages/shell/src/napplet-namespace.ts`] INC alone is protected against post-shim reassignment.
   - What's unclear: Whether “readonly identity API” requires preservation across a napplet's own assignment.
   - Recommendation: Preserve read-only public methods and parent-source validation; only add reassignment protection if an attack test demonstrates an identity privacy or wire-integrity bypass.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | build/tests | ✓ | v25.2.1 | — |
| pnpm | workspace commands | ✓ | 10.8.0 | — |
| Chrome | Playwright browser proof | ✓ | 151.0.7922.48 | existing configured executable path |
| Local `napplet/naps` checkout | exact authority audit | ✓ | contains `896c32c` | no network dependency |

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | [VERIFIED: codebase `package.json`] Vitest 4.1.2 and Playwright 1.54.0 |
| Config file | [VERIFIED: codebase `vitest.config.ts`, `playwright.config.ts`] `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm exec vitest run packages/services/src/identity-service.test.ts packages/services/src/theme-service.test.ts packages/runtime/src/dispatch.test.ts packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-bridge.test.ts` |
| Host-focused run | `pnpm exec vitest run packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts` |
| Browser run | `KEHTO_PLAYGROUND_BASE_URL=http://[::1]:4174 pnpm exec playwright test tests/e2e/nap-identity.spec.ts tests/e2e/nap-theme.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/paja-single-window.spec.ts --workers=1` |
| Full suite | `pnpm test:unit` then relevant `pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| IDENTITY-01 | Signer absent/rejects yields exactly one `.result` with `pubkey: ''`, never `.error`. | unit/runtime | focused Vitest command | ⚠ extend existing |
| IDENTITY-02 | Every supported action uses matching default result; unknown action produces no message in service, fallback, ACL, and firewall paths. | unit | focused Vitest command | ⚠ extend existing |
| IDENTITY-03 | Immutable/read-only exposed operations; one normal and one sign-out change per eligible session, none pre-session/ungranted. | unit + host/browser | focused Vitest + host/browser run | ⚠ add regression |
| IDENTITY-04 | Forged child message and other-domain/INC/intent paths cannot alter or disclose identity; only trusted parent push is observed. | unit + browser | focused Vitest + browser run | ⚠ add regression |
| THEME-01 | Normal, unavailable, ACL-denied, and firewall-denied `theme.get` each yield one complete `.result`. | unit/runtime | focused Vitest command | ⚠ extend existing |
| THEME-02 | Unknown theme action is ignored and no `theme.*.error` is emitted. | unit/runtime | focused Vitest command | ⚠ extend existing |
| THEME-03 | One update changes later `get` state and emits one byte-equivalent changed payload in Paja and playground. | unit + browser | host/browser run | ⚠ add regression |
| THEME-05 | No theme subscribe/unsubscribe request is generated or accepted. | static + unit | focused Vitest command | ⚠ add static guard |

### Wave 0 Gaps

- [ ] Extend service/runtime tests to assert exact envelope cardinality and absence of all forbidden identity/theme `.error` types.
- [ ] Add a shell-bridge eligibility fixture with pre-session, ungranted, granted, and revoked sessions; assert identity normal/sign-out and theme pushes reach only allowed frames once.
- [ ] Add Paja browser-host/unit proof that a theme-mode update updates `theme.get` state and emits one push.
- [ ] Add playground unit/E2E proof that a theme control change has one service mutation and one outbound changed envelope, with no direct raw fan-out.
- [ ] Add prelude parent-source and readonly/replacement tests scoped to the decision reached for identity/theme API ownership.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | [VERIFIED: codebase `packages/shell/src/shell-ready.ts`] creation-time identity plus first `shell.ready` session registration. |
| V3 Session Management | yes | [VERIFIED: codebase `packages/runtime/src/runtime.ts:316-322`] drop capability envelopes before source-bound session establishment. |
| V4 Access Control | yes | [VERIFIED: codebase `packages/runtime/src/enforce.ts`, `packages/acl/src/resolve.ts`] domain/capability checks and recipient eligibility before host push. |
| V5 Input Validation | yes | [VERIFIED: codebase `packages/shell/src/napplet-namespace.ts`] parent-source and message type checks; fixed result schemas. |
| V6 Cryptography | no | [VERIFIED: naps@896c32c `naps/NAP-IDENTITY.md`] identity exposes no signing, encryption, or decryption. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Child forges identity transition | Spoofing/Tampering | [VERIFIED: naps@896c32c `projections/web.md`; codebase `packages/shell/src/napplet-namespace.ts`] accept change listener messages only from `parent`; publish only from host bridge. |
| Unready/ungranted iframe receives private identity | Information Disclosure | [VERIFIED: Phase 101/103 requirements] filter by live session and frozen domain grant before postMessage. |
| Duplicate host push causes inconsistent UI | Tampering/Availability | [VERIFIED: codebase `apps/playground/src/main-preferences.ts`] one state-owner callback and per-frame cardinality tests. |
| Generic denial manufactures unsupported wire type | Tampering | [VERIFIED: codebase `packages/runtime/src/runtime.ts`] domain-specific canonical result factory used by ACL and firewall gates. |

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `/Users/sandwich/Develop/naps` commit `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `naps/NAP-IDENTITY.md`] — identity API, safe result shapes, changed semantics, readonly/security boundary.
- [VERIFIED: `/Users/sandwich/Develop/naps` commit `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `naps/NAP-THEME.md`] — get/change-only theme protocol, required colors, no subscriptions.
- [VERIFIED: `/Users/sandwich/Develop/naps` commit `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `projections/web.md`] — browser source binding and domain surface.
- [VERIFIED: codebase] `packages/services/src/{identity-service,theme-service}.ts`, `packages/runtime/src/{identity-handler,domain-handlers,runtime}.ts`, `packages/shell/src/{napplet-namespace,shell-bridge,shell-ready}.ts` — current behavior and integration seams.
- [VERIFIED: codebase] `packages/paja/src/{browser-adapter,browser-host}.ts`, `apps/playground/src/{demo-hooks,main-preferences,shell-host}.ts` — host-specific current gaps.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; workspace and test tool versions were read locally.
- Architecture: HIGH — upstream authority and all current runtime/host seams were inspected.
- Pitfalls: HIGH — each is tied to a concrete current wire or host path.

**Research date:** 2026-07-23  
**Valid until:** Draft-head dependent; re-audit if `896c32c92deee68dc4d10fc1132b62df20cccb6f` changes.
