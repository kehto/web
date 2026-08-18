# Phase 101: NAP-SHELL Session Integrity - Research

**Researched:** 2026-07-23
**Domain:** NAP-SHELL browser bootstrap, session gating, and host capability advertisement
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Capability contract
- Remove numbered-protocol capability negotiation completely; NAP-SHELL is
  `supports(domain)` only.
- Remove `ShellCapabilities.protocols`, numbered flat `naps`, and
  `inc:NAP-01` through `inc:NAP-06` from active shell, Paja, playground, tests,
  and current documentation.
- Before init every support query is false; after init only granted domains
  backed by live host implementations are true.

### Session and isolation
- Preserve one bare `shell.ready` followed by one uncorrelated `shell.init`.
- Duplicate ready from the same trusted source is idempotent and cannot create a
  second session or init delivery.
- Capability traffic is not serviced before the session exists.
- Creation-time identity, trusted source, capabilities, and services cannot be
  reassigned or observed across napplet frames.
- `shell.init` exposes only the normative environment fields `capabilities` and
  `services`; internal storage remains nonnormative and readonly to napplet code.

### Host integration
- Shell, Paja, and playground advertise only domains whose implementations are
  wired; disabled/simulation controls remove the domain consistently.
- Preserve changelogs, archived planning, migrations, and historical requirement
  IDs as semantic history.

### the agent's Discretion
- Internal refactor boundaries and compatibility handling for nonnormative
  capability storage, provided no public or wire-visible numbered negotiation remains.

### Deferred Ideas (OUT OF SCOPE)

- NAP-INC event/channel parity and ambiguity issue `kehto/web#203`: Phase 102.
- NAP-IDENTITY and NAP-THEME wire parity: Phase 103.
- Published package, intent, and manifest convention adoption: Phase 104.
- Paja/playground profile/resource/theme flows: Phase 105.
- Active-surface documentation, full gates, changesets, and PR: Phase 106.
</user_constraints>

## Project Constraints (from user instructions captured in 101-PATTERNS.md)

- Preserve unrelated dirty planning changes; stage only explicit paths. [VERIFIED: 101-PATTERNS.md]
- NAP-facing work must be checked against the owning upstream NAP before source, tests, or docs change; Phase 101's authority is `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874` `naps/NAP-SHELL.md`. [VERIFIED: 101-PATTERNS.md; napplet/naps@6461e4b]
- Keep NAP-SHELL receiver/live-before-ready, first-init caching, read-only services, source trust, lifecycle idempotency, and both Paja and playground host paths covered. [VERIFIED: 101-PATTERNS.md]
- TypeScript is strict and ESM-only; use 2-space indentation, lowercase-hyphen filenames, and JSDoc on public exports. [VERIFIED: 101-PATTERNS.md]
- Do not alter archived planning, migrations, changelogs, or historical requirement IDs merely to remove legacy vocabulary. [VERIFIED: 101-PATTERNS.md; 101-CONTEXT.md]
- For production work, tests and directly affected documentation move with source; final shipping gates are build, type-check, unit tests, relevant E2E, docs when changed, AI-slop, diff check, changesets, and PR. Phase 106 owns the milestone-wide release gate. [VERIFIED: 101-PATTERNS.md; ROADMAP.md]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Domain-only capability discovery | Remove legacy capability fields and make the injected public function unary. |
| SHELL-02 | Truthful local support | Derive one immutable per-frame environment from live implementation availability and use it for local lookup. |
| SHELL-03 | Mandatory handshake | Retain first-ready-only session establishment and exactly-once uncorrelated init. |
| SHELL-04 | Pre-session isolation | Add one runtime/bridge session gate before ACL, firewall, and NAP dispatch. |
| SHELL-05 | Environment isolation | Snapshot environment/services for each source-bound frame; retain no mutable cross-frame object. |
| SHELL-06 | Host advertisement integrity | Align shell, Paja simulation, and playground injected domains with the same live-service decision. |
</phase_requirements>

## Summary

NAP-SHELL is a two-message bootstrap rather than a request/result API: the napplet emits a payload-free `shell.ready`, then the trusted runtime sends one uncorrelated `shell.init` with only `capabilities` and `services`. The napplet caches that environment, which makes `supports(domain)` synchronous and false before delivery or for unknown domains. First ready also establishes the session; no other capability message is serviceable beforehand. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`]

Kehto already has strong reusable pieces: `handleShellReady` registers a NIP-5D session from creation-time `originRegistry` identity and uses a source-registration keyed WeakMap to send init once; the injected namespace already installs a parent-bound receiver before sending ready, freezes `services`, and ignores later init messages. The phase must retain those properties while removing the old `protocols`/`naps` compatibility model. [VERIFIED: `packages/shell/src/shell-ready.ts`; `packages/shell/src/napplet-namespace.ts`]

The remaining security correction is central: `ShellBridge` forwards every non-ready envelope to `Runtime.handleMessage`, whose current dispatch path has no session-existence gate. Consequently, a trusted registered frame can reach handlers before `shell.ready`; authorization checks alone do not implement the specification's total handshake gate. [VERIFIED: `packages/shell/src/shell-bridge.ts`; `packages/runtime/src/runtime.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

**Primary recommendation:** Export a documented host-integrator-only `resolveShellEnvironment(hooks, identity)` from `@kehto/shell`, reusing the existing `OriginIdentity`. It returns a fresh immutable domain-only environment from concrete runtime/service wiring, disabled controls, and an explicit identity-aware host subset callback. Shell ready, Paja, and playground call that one resolver and require content-equivalent isolated results; it is never injected onto `window.napplet`, presented as a normative napplet API, or exposed by the shim. Reject every non-ready envelope unless the runtime session registry contains that window.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Install `window.napplet.shell`, cache init, synchronous support check | Browser / Client | Frontend Server (host) | The prelude owns local API behavior; the host supplies the environment. [VERIFIED: `packages/shell/src/napplet-namespace.ts`] |
| Bind iframe source to creation-time identity and receive `shell.ready` | Frontend Server (host) | Browser / Client | `originRegistry` maps `MessageEvent.source` to the host-created iframe identity. [VERIFIED: `packages/shell/src/origin-registry.ts`; `packages/shell/src/shell-bridge.ts`] |
| Establish session and reject pre-session capability traffic | API / Backend (runtime engine) | Frontend Server (bridge) | The runtime is the shared dispatch/policy boundary; the bridge only routes trusted sources. [VERIFIED: `packages/runtime/src/runtime.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| Decide granted/live domains and named services | Frontend Server (host) | API / Backend | Host wiring and service registry determine what may be advertised; runtime owns registered handlers. [VERIFIED: `packages/shell/src/shell-init.ts`; `packages/runtime/src/runtime.ts`] |
| Paja simulation and playground namespace parity | Frontend Server (host) | Browser / Client | Both hosts generate `srcdoc` prelude domains and must match their live adapter configuration. [VERIFIED: `packages/paja/src/browser-target-frame.ts`; `apps/playground/src/shell-host.ts`] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | workspace strict ESM configuration | Source and public API types | Existing project baseline; this phase requires no new dependency. [VERIFIED: 101-PATTERNS.md; `tsconfig.json`] |
| Vitest | `^4.1.2` | Unit and integration regression tests | Existing root test runner and focused shell/runtime test suite. [VERIFIED: `package.json`; `vitest.config.ts`] |
| Playwright | `^1.54.0` | Real iframe/srcdoc host-path proof | Existing browser suite already covers Paja and playground iframe paths. [VERIFIED: `package.json`; `playwright.config.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@kehto/runtime` | workspace | Session registry and NAP dispatch | Add the pre-session gate at the shared dispatch boundary. [VERIFIED: `packages/runtime/src/runtime.ts`] |
| `@kehto/shell` | workspace | Trusted-source bridge, environment construction, injected prelude | Make capability shape and handoff domain-only. [VERIFIED: `packages/shell/src/*.ts`] |
| `@kehto/paja` | workspace | Development host simulation | Prove simulation-disabled domains are absent from init and namespace. [VERIFIED: `packages/paja/src/browser-target-frame.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Runtime-level session gate | Per-domain handler gates | Per-domain checks can drift and miss a newly registered NAP; one dispatcher gate matches the NAP-SHELL total enforcement point. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| One exported host-integrator resolver | Separate shell-init, Paja, and playground lists | Duplicated membership calculations already create advertisement drift risk; preserve host-specific wiring but centralize membership in `resolveShellEnvironment(hooks, identity)`. Each call returns fresh immutable data, so consumers compare content rather than JavaScript object identity. [VERIFIED: `packages/shell/src/shell-init.ts`; `packages/shell/src/index.ts`; `packages/paja/src/browser-target-frame.ts`; `apps/playground/src/shell-host.ts`] |

**Installation:** No external package installation is required. [VERIFIED: 101-CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
creation-time iframe identity + Window source
                    |
                    v
           originRegistry registration
                    |
 iframe prelude installs shell receiver ──> emits { type: "shell.ready" }
                    |                                  |
                    |                                  v
                    |                         ShellBridge source lookup
                    |                                  |
                    |                     first ready only / immutable snapshot
                    |                                  |
                    |              +-------------------+------------------+
                    |              |                                      |
                    v              v                                      v
      local shell.supports() <- shell.init { capabilities, services }   runtime sessionRegistry
             false before init                                      enables NAP dispatch
                    |                                                      |
                    +--------------- non-ready capability envelopes ------+
                                      only when session exists
```

The host must not derive identity, grants, or source from a `shell.ready` payload: the message is liveness-only. The source-to-window mapping and dTag/aggregate hash are captured at iframe creation. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`; `packages/shell/src/origin-registry.ts`]

### Recommended Project Structure

```text
packages/shell/src/
├── types.ts                 # domain-only ShellCapabilities public shape
├── shell-init.ts            # live/granted environment builder
├── shell-ready.ts           # first-ready session + exactly-once init
├── shell-bridge.ts          # trusted source routing; delegates guarded runtime traffic
└── napplet-namespace.ts     # unary local supports() and immutable cached environment
packages/runtime/src/runtime.ts # single pre-session dispatcher gate
packages/paja/src/           # simulation/service-to-environment parity
apps/playground/src/         # live host environment and srcdoc injection parity
```

### Pattern 1: Immutable, per-frame environment snapshot

**What:** Build the environment after resolving the trusted source/window and before sending first init; use only a `domains` list inside `capabilities` and a frozen service-name list. Do not reuse a mutable global capabilities object across frames. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`]

**When to use:** On first valid `shell.ready`; recompute only for a newly registered iframe lifecycle, never in response to a later message from the same registration. [VERIFIED: `packages/shell/src/shell-ready.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

**Example:**

```ts
// Source: napplet/naps@6461e4b/naps/NAP-SHELL.md
type ShellEnvironment = Readonly<{
  capabilities: Readonly<{ domains: readonly string[] }>;
  services: readonly string[];
}>;

function supports(environment: ShellEnvironment | undefined, domain: string): boolean {
  return environment?.capabilities.domains.includes(domain) ?? false;
}
```

### Pattern 2: Gate before policy and dispatch

**What:** In `Runtime.handleMessage`, validate the envelope shape, then return when `sessionRegistry.getEntryByWindowId(windowId)` is absent, before ACL, firewall, service, or domain handler invocation. `shell.ready` stays bridge-local because it is what creates the session. [VERIFIED: `packages/shell/src/shell-bridge.ts`; `packages/runtime/src/runtime.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

**When to use:** For every non-shell-ready NAP envelope, including domains that currently happen to tolerate missing identity. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`]

### Pattern 3: Advertise from actual wiring, then inject the same set

**What:** Convert host adapter/service availability into a domain set once, remove disabled simulation domains before serialization, and pass the resulting set to both `shell.init` and `injectNappletNamespacePrelude`. Keep mandatory `shell` injected independently. [VERIFIED: `packages/shell/src/shell-init.ts`; `packages/paja/src/browser-target-frame.ts`; `packages/shell/src/napplet-namespace.ts`]

### Anti-Patterns to Avoid

- **Legacy fallback fields:** Do not retain `protocols`, `naps`, `inc:NAP-01..06`, or a second `supports` argument in active wire/public compatibility code; the locked contract explicitly removes them. [VERIFIED: 101-CONTEXT.md; napplet/naps@6461e4b `naps/NAP-SHELL.md`]
- **ACL as session gating:** Do not rely on ACL denial or identity lookup failure to block pre-ready messages; some handlers can still execute or shape responses before a session exists. [VERIFIED: `packages/runtime/src/runtime.ts`]
- **Manifest-only advertisement:** Do not inject domains merely because a napplet asks for them; manifest requirements are not proof that a host implementation is live. [VERIFIED: SHELL-06 in `REQUIREMENTS.md`; `apps/playground/src/shell-host.ts`]
- **Global mutable environment:** Do not expose `shellCapabilities` or service arrays by reference to multiple frames; copy/freeze the per-frame snapshot. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source trust | A message-provided window ID, dTag, or origin claim | `originRegistry` keyed by `MessageEvent.source` and creation-time identity | The upstream binding requires identity/source assignment by the runtime, not napplet negotiation. [VERIFIED: `packages/shell/src/origin-registry.ts`; `projections/web.md`] |
| Session ownership | A second session map in shell code | `runtime.sessionRegistry` as the single dispatch authority | The runtime already supplies the shared lookup required to gate all NAP domains. [VERIFIED: `packages/runtime/src/runtime.ts`] |
| Exactly-once init | A new retry/correlation protocol | Existing `handleShellReady` registration-id WeakMap guard | The wire contract is deliberately uncorrelated and exactly once. [VERIFIED: `packages/shell/src/shell-ready.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| Browser iframe APIs | A second bootstrap shim | `injectNappletNamespacePrelude` / `renderNappletNamespacePrelude` | It already places the receiver before ready and filters parent-origin messages. [VERIFIED: `packages/shell/src/napplet-namespace.ts`] |

**Key insight:** The security boundary is a small state machine, not a feature flag: `registered source → first ready → session/environment → dispatch`. Keeping these transitions in the already-owned bridge/runtime/prelude components prevents one host path or NAP domain from bypassing it. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`; `packages/shell/src/shell-bridge.ts`]

## Common Pitfalls

### Pitfall 1: Retaining wire-visible compatibility after removing a contract

**What goes wrong:** A type may become unary while `naps`, `protocols`, namespace tests, docs, or Paja parity fixtures still advertise numbered support. Consumers can then infer a removed capability. [VERIFIED: `packages/shell/src/types.ts`; `packages/shell/src/shell-init.ts`; `packages/paja/src/parity.test.ts`]

**How to avoid:** Search active source, tests, Paja/playground host code, package docs, policy docs, and E2E type declarations for `protocols`, `naps`, `inc:NAP-0`, and two-argument `supports`; retain only classified historical material. [VERIFIED: 101-CONTEXT.md; `NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`]

### Pitfall 2: Gate at the wrong layer

**What goes wrong:** Blocking only a few handlers leaves other registered NAP domains, future handlers, firewall code, or response paths serviceable before ready. [VERIFIED: `packages/runtime/src/runtime.ts`]

**How to avoid:** Add a single testable early return at runtime ingress after shape validation and before capability enforcement/dispatch; keep `shell.ready` outside that path. [VERIFIED: `packages/shell/src/shell-bridge.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

### Pitfall 3: Claiming domains based on static lists rather than live handlers

**What goes wrong:** `buildShellCapabilities` currently adds several baseline domains while services are separately registered, and playground injects `resolved.requires`; either can diverge from the actual host/service wiring. [VERIFIED: `packages/shell/src/shell-init.ts`; `apps/playground/src/shell-host.ts`; `apps/playground/src/demo-hooks.ts`]

**How to avoid:** Define the exact availability criterion per domain (runtime native handler, registered service, and any required host backend), then use it consistently for init and namespace injection. Require a negative test for each disabled/simulation path. [VERIFIED: SHELL-06 in `REQUIREMENTS.md`; `packages/paja/src/browser-adapter.ts`]

### Pitfall 4: Breaking valid iframe reload behavior while enforcing idempotency

**What goes wrong:** Treating a new source registration as a duplicate can suppress init for a reload; treating every ready as new can resend init. [VERIFIED: `packages/shell/src/shell-bridge.test.ts`; `packages/shell/src/origin-registry.ts`]

**How to avoid:** Preserve the existing registration-id semantics: duplicate ready for the same trusted source registration is a no-op; a re-registered lifecycle receives one new init. [VERIFIED: `packages/shell/src/shell-ready.ts`; `packages/shell/src/shell-bridge.test.ts`]

### Pitfall 5: Mutating one frame's environment from another

**What goes wrong:** Shared arrays/maps let a disabled domain, service list, or forged later init affect another napplet. [VERIFIED: SHELL-05 in `REQUIREMENTS.md`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

**How to avoid:** Snapshot and freeze `domains`/`services`, accept exactly the first parent `shell.init` in each prelude, and test two frames with different grants. [VERIFIED: `packages/shell/src/napplet-namespace.ts`]

## Code Examples

### Unary local support with no protocol fallback

```ts
// Source: napplet/naps@6461e4b/naps/NAP-SHELL.md
function supports(domain: string): boolean {
  return environment?.capabilities.domains.includes(domain) ?? false;
}
```

### Single runtime ingress guard

```ts
// Source: NAP-SHELL session obligation, applied in packages/runtime/src/runtime.ts
if (!runtimeSessionRegistry.getEntryByWindowId(windowId)) {
  return; // no ACL, firewall, service, or domain-handler work before shell.ready
}
```

### Safe host handoff

```ts
// Source: packages/shell/src/shell-ready.ts pattern
// First ready only: use the source registration ID and creation-time identity.
postMessage({ type: 'shell.init', capabilities: { domains }, services }, '*');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supports(domain, protocol?)` and numbered INC negotiation | `supports(domain)` only; conventions are discovered elsewhere | `napplet/naps@6461e4b` | NAP-SHELL exposes domains, not cross-napplet protocol identifiers. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`; `101-UPSTREAM-DELTA.md`] |
| `capabilities.protocols` / flat `naps` compatibility payload | Non-normative capability storage sufficient for truthful domain lookup | `napplet/naps@6461e4b` | Kehto can retain an internal representation, but none of those legacy fields may be public or wire-visible. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`; 101-CONTEXT.md] |

**Deprecated/outdated:**

- `ShellCapabilities.protocols`, flat `naps`, and `inc:NAP-01..06` capability entries: remove from all active Phase 101 surfaces. [VERIFIED: 101-CONTEXT.md; `NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`]
- `supports(domain, protocol?)`: remove the optional second argument from injected/public API, test fixtures, and active documentation. [VERIFIED: `REQUIREMENTS.md`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. This research uses the locked phase context, pinned upstream checkout, and current repository source; no implementation decision relies on training-only knowledge. | — | — |

## Open Questions (RESOLVED)

1. **Which active documentation moves in Phase 101 versus Phase 106? — RESOLVED**
   - Phase 101 updates every affected public type/JSDoc surface and `packages/shell/README.md`. Broad `RUNTIME-SPEC.md`, policy prose, global static cleanup, changesets, release artifacts, and the milestone-wide documentation sweep remain Phase 106. [VERIFIED: 101-CONTEXT.md; ROADMAP.md]

2. **How are per-napplet grants represented at environment-build time? — RESOLVED**
   - `@kehto/shell` exports host-integrator-only `resolveShellEnvironment(hooks, identity)` using the existing trusted creation-time `OriginIdentity`. Concrete live runtime/service wiring and disabled domains define availability. The explicit identity-aware host callback may only return a subset, and the resolver intersects its result back against available domains/services. Any/all ACL-operation inference is forbidden. The export is not injected onto `window.napplet`, normative napplet API, or shim surface. [VERIFIED: 101-CONTEXT.md; `packages/shell/src/types.ts`; `packages/shell/src/origin-registry.ts`; `packages/shell/src/shell-init.ts`; `packages/shell/src/index.ts`]

3. **Can `shell.init` be withheld for registered frames with no creation-time identity? — RESOLVED**
   - Yes. An identity-less registered frame receives neither a runtime session nor `shell.init`/capabilities. Focused bridge tests lock the fail-closed behavior. [VERIFIED: 101-CONTEXT.md; `packages/shell/src/shell-ready.ts`; `packages/shell/src/shell-bridge.test.ts`; napplet/naps@6461e4b `naps/NAP-SHELL.md`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TypeScript build/tests | ✓ | `v25.2.1` | — |
| pnpm | Workspace scripts | ✓ | `10.8.0` | — |
| Playwright CLI | iframe E2E proof | ✓ | `1.59.1` | Focused Vitest tests only if browser infrastructure is unavailable in a later executor environment. |

**Missing dependencies with no fallback:** None. [VERIFIED: local environment probes]

**Missing dependencies with fallback:** None. [VERIFIED: local environment probes]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.2`; Playwright `^1.54.0` workspace declarations. [VERIFIED: `package.json`] |
| Config file | `vitest.config.ts`; `playwright.config.ts`. [VERIFIED: repository files] |
| Quick run command | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-bridge.test.ts packages/shell/src/shell-init.test.ts packages/shell/src/shell-supports-conformance.test.ts packages/paja/src/parity.test.ts` |
| Full suite command | `pnpm test:unit`; browser gate `pnpm test:e2e -- gateway-artifact-parity naps-path-conformance paja-single-window` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Unary API; no numbered fields/entries | unit + static | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-init.test.ts packages/shell/src/shell-supports-conformance.test.ts` | ✅ extend existing |
| SHELL-02 | false before init; true only for granted/live domains | unit + browser | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-init.test.ts` | ✅ extend existing |
| SHELL-03 | first ready creates one session and one init; reload gets one new lifecycle init | unit | `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts` | ✅ extend existing |
| SHELL-04 | non-ready envelope cannot reach runtime handler before session | unit/integration | `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts packages/runtime/src/dispatch.test.ts` | ✅ extend existing; add focused case |
| SHELL-05 | two frames cannot observe/mutate capabilities or services | unit + browser | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-bridge.test.ts` | ✅ extend existing; add two-frame case |
| SHELL-06 | shell/Paja/playground omit disabled or unwired domains | unit + browser | `pnpm exec vitest run packages/shell/src/shell-init.test.ts packages/paja/src/parity.test.ts && pnpm test:e2e -- gateway-artifact-parity naps-path-conformance paja-single-window` | ✅ extend existing |

### Sampling Rate

- **Per task commit:** focused Vitest command above.
- **Per wave merge:** `pnpm test:unit` plus affected focused Playwright specs.
- **Phase gate:** Phase 101 focused requirements green; milestone-wide full-suite/docs/release gate remains Phase 106 unless the planner expands scope.

### Wave 0 Gaps

- [ ] Add a runtime ingress regression that proves a registered trusted source cannot execute `storage.*`, `relay.*`, or service-backed traffic before `shell.ready` establishes its session.
- [ ] Add a per-frame environment isolation test with different identity/grant/live-domain snapshots.
- [ ] Add a host parity regression that compares the actual `shell.init` domains with Paja and playground prelude injection, including a disabled simulation domain.
- [ ] Add active-surface negative assertions for removed `protocols`, `naps`, `inc:NAP-01..06`, and two-argument `supports`; classify historical exclusions instead of global string deletion.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Napplet identity is source-bound creation metadata, not end-user authentication. [VERIFIED: `projections/web.md`] |
| V3 Session Management | yes | First-ready-only session creation; immutable creation-time identity; duplicate-ready idempotency; runtime ingress session gate. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| V4 Access Control | yes | Per-napplet environment advertisement plus existing ACL enforcement after session gating. [VERIFIED: `packages/runtime/src/runtime.ts`; `packages/runtime/src/enforce.ts`] |
| V5 Input Validation | yes | Require a registered `MessageEvent.source`, object envelope, string `type`, parent-source-only init, and payload-free ready semantics. [VERIFIED: `packages/shell/src/shell-bridge.ts`; `packages/shell/src/napplet-namespace.ts`] |
| V6 Cryptography | no | Phase 101 changes no cryptographic protocol; it must not add a custom cryptographic mechanism. [VERIFIED: phase scope; `REQUIREMENTS.md`] |

### Known Threat Patterns for NAP-SHELL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged ready identity or capability request | Spoofing / Elevation | Ignore ready payload entirely; bind source to creation-time dTag/aggregate hash. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| Capability call before session | Elevation | Shared runtime ingress returns before policy/handler dispatch without a session entry. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| Ready replay changes session/grants | Tampering / Elevation | Registration-ID keyed exactly-once guard; never overwrite first session. [VERIFIED: `packages/shell/src/shell-ready.ts`] |
| Cross-frame capability/service disclosure | Information Disclosure | Per-frame immutable init snapshot and source-bound recipient lookup. [VERIFIED: napplet/naps@6461e4b `naps/NAP-SHELL.md`] |
| Forged init from sibling/child frame | Spoofing | Prelude accepts init only when `event.source === window.parent`; ignores later init. [VERIFIED: `packages/shell/src/napplet-namespace.ts`] |

## Sources

### Primary (HIGH confidence)

- `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874` [`naps/NAP-SHELL.md`] - authoritative API, wire lifecycle, session, and security obligations.
- `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874` [`projections/web.md`] - authoritative browser source binding and `window.napplet` projection.
- Kehto baseline source at `origin/main` `bb3929b3523b75356fd65f658f9bd14c7ff697e4` - current bridge, environment builder, prelude, runtime, Paja, playground, and tests.
- `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md` - phase-to-baseline gap audit, cross-checked against the pinned upstream checkout.

### Secondary (MEDIUM confidence)

- Research seam Context7 route - unavailable in this agent runtime; direct pinned upstream checkout was used instead and cache records the limitation.

### Tertiary (LOW confidence)

- Research seam web-search route - returned no relevant Kehto or NAP-SHELL source; no implementation claim relies on it.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing workspace package/config inspection; no new dependency recommendation.
- Architecture: HIGH - direct comparison of pinned NAP-SHELL contract and current bridge/runtime/prelude/Paja/playground sources.
- Pitfalls: HIGH - each is tied to a verified current drift location or upstream security obligation.

**Research date:** 2026-07-23
**Valid until:** 2026-08-22 for the pinned phase contract; invalidate if the phase authority commit changes.
