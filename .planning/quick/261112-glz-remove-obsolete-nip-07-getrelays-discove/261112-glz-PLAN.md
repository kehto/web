---
phase: quick-261112-glz
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261112-GLZ]
files_modified:
  - packages/paja/src/browser-relay-runtime.ts
  - packages/paja/src/browser-adapter-support.ts
  - packages/paja/src/browser-adapter.ts
  - packages/paja/src/browser-host.test.ts
  - packages/paja/src/browser-adapter-signer-traffic.test.ts
  - packages/paja/src/browser-signers.ts
  - packages/paja/src/browser-signers.test.ts
  - packages/paja/src/browser-blossom-integration.test.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - docs/compatibility.md
  - .changeset/paja-remove-obsolete-relay-discovery.md
must_haves:
  truths:
    - Discovery, lifecycle and identity requests never consult the obsolete extension relay hook.
    - Host-configured discovery still resolves contacts, NIP-65 and Blossom lists through existing network policy.
    - NAP identity.getRelays remains available without representing host bootstrap URLs as user NIP-65 metadata.
  artifacts:
    - path: packages/paja/src/browser-adapter-signer-traffic.test.ts
      provides: Actual adapter warming and identity regressions
    - path: packages/paja/src/browser-signers.test.ts
      provides: Obsolete capability is ignored during NIP-07 adaptation
    - path: packages/paja/src/browser-blossom-integration.test.ts
      provides: Host-only discovery and lifecycle regression
  key_links:
    - from: packages/paja/src/browser-adapter-support.ts
      to: packages/paja/src/browser-relay-runtime.ts
      via: Host relay accessor supplied to relay-list loader
    - from: packages/paja/src/browser-adapter.ts
      to: packages/services/src/identity-service.ts
      via: Existing identity service with empty unsupported external-user relay result
---

<objective>
Remove obsolete NIP-07 relay discovery from Paja, not cache or rate-limit it. Preserve supported signer operations and current NAP identity API. No broader identity implementation.
</objective>

<execution_context>
@/home/robert/.config/opencode/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@AGENTS.md
@packages/paja/src/browser-relay-runtime.ts
@packages/paja/src/browser-adapter.ts
@packages/paja/src/browser-adapter-support.ts
@packages/paja/src/browser-signers.ts
@packages/paja/src/browser-adapter-signer-traffic.test.ts
@packages/paja/src/browser-blossom-integration.test.ts

Quick request is scope authority. Planning found clean branch fix/paja-remove-nip07-relay-discovery at b2d15ab6. Recheck status, branch, staged diff and recent commits before execution; preserve unrelated work.

Specifications fetched and checked during planning:
- https://raw.githubusercontent.com/nostr-protocol/nips/master/07.md (2026-11-12): browser API does not include the obsolete relay hook.
- https://raw.githubusercontent.com/napplet/naps/43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab/naps/NAP-IDENTITY.md: identity.getRelays remains a correlated request/result API for user NIP-65 metadata; unsupported queries may return empty results.

Discovery level 0: existing code and Vitest patterns, no new packages. Preserve unrelated host relay accessors and simulation-only APIs sharing the method name.
</context>

<tasks>
<task type="tracer" tdd="true">
  <name>Remove signer discovery from actual adapter warming</name>
  <files>packages/paja/src/browser-relay-runtime.ts, packages/paja/src/browser-adapter-support.ts, packages/paja/src/browser-adapter.ts, packages/paja/src/browser-host.test.ts, packages/paja/src/browser-adapter-signer-traffic.test.ts</files>
  <behavior>
    - Actual adapter initialization and followed-author warming query configured bootstrap URLs with zero extension-hook calls.
    - Repeated discovery and account refresh/switch never consult the hook, including when it throws.
    - Existing signed contact and relay-list fixtures still produce NIP-65 routing.
  </behavior>
  <action>
Start with a failing regression in the existing recording-socket adapter traffic fixture. Delete getSignerRelayUrls. Make getPajaBootstrapRelayUrls synchronous with getSimulation and optional getHostRelayUrls only. Remove signerProvider arguments from createPajaContactListLoader, createPajaRelayListLoader and createPajaIdentityProviders; update their calls and JSDoc, including browser-adapter-support wiring. Retain signerProvider wherever signing/account identity genuinely needs it. Update stale browser-host source expectations and back them with the behavioral regression. Search all helper callers and remove obsolete arguments rather than retaining overloads. Preserve URL precedence/deduplication, contact limits, cancellation and registry behavior.

Delete the adapter signer bootstrap cache, generation counter, refresh function, bundle member, initialization call and lifecycle refresh call. Blossom discovery uses getReadRelays directly; preserve authorizeNetwork, URL policy, cancellation, signed kind-10002 verification and write-relay routing. Preserve all other identity-change effects. Replace external-user identity facade extension forwarding with an empty relay-map result for unsupported metadata, retaining the service and wire API. Do not substitute host URLs or build a metadata resolver.
  </action>
  <verify><automated>pnpm exec vitest run packages/paja/src/browser-adapter-signer-traffic.test.ts packages/paja/src/browser-host.test.ts packages/paja/src/browser-relay-runtime.test.ts</automated></verify>
  <done>Real adapter warming uses host discovery without extension calls; lifecycle cache machinery is deleted and identity no longer forwards the obsolete hook.</done>
</task>

<task type="auto" tdd="true">
  <name>Retire signer adaptation and prove resource and identity boundaries</name>
  <files>packages/paja/src/browser-signers.ts, packages/paja/src/browser-signers.test.ts, packages/paja/src/browser-blossom-integration.test.ts, packages/paja/src/browser-adapter-signer-traffic.test.ts, packages/paja/src/browser-adapter.ts</files>
  <behavior>
    - NIP-07 adaptation does not read, bind, expose or invoke the obsolete property; supported signing/encryption remains functional.
    - Initialization, lifecycle notifications, account switches and repeated Blossom requests leave the hook uncalled.
    - External-user identity.getRelays returns the existing response type/id with an empty relay map before and after account changes, not host URLs or extension output.
    - Blossom network approval and denial behavior remain enforced.
  </behavior>
  <action>
Delete the obsolete Nip07Signer member and createNip07Adapter binding. Test with an extension fixture containing a throwing accessor or spy for the obsolete property, retaining positive supported-method tests. Rewrite Blossom tests currently expecting one extension lookup to expect zero across initialization and requests, using configured host relays for discovery. Exercise lifecycle notifications and correlated identity requests through the real adapter harness rather than a mocked facade. Use signed fixtures and preserve resource approval/denial assertions. Add cases to the traffic suite as appropriate. Do not delete identity.getRelays from shared runtime/services/types, rename unrelated host relay accessors or rewrite social-cache behavior. Correct only defects in the changed adapter behavior.
  </action>
  <verify><automated>pnpm exec vitest run packages/paja/src/browser-signers.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-adapter-signer-traffic.test.ts</automated></verify>
  <done>Behavioral tests prove zero obsolete-hook use across signer adaptation, lifecycle, identity and resource discovery while supported behavior remains green.</done>
</task>

<task type="auto">
  <name>Document retirement, add changeset and run shipment gates</name>
  <files>packages/paja/README.md, docs/packages/paja.md, docs/compatibility.md, .changeset/paja-remove-obsolete-relay-discovery.md</files>
  <action>
Replace stale signer-bootstrap lifecycle-cache claims in README/package docs with host-owned discovery behavior. Document empty unsupported external-user identity relay results without claiming host URLs are user preferences. Record the checked NIP-07 source/date and pinned NAP-IDENTITY ref, distinguishing retained NAP operation from removed extension capability.

Inspect the compatibility register for an existing entry and mark it retired; if absent, add a concise retirement record naming Paja, removed behavior, host-configuration replacement, regression sites, changeset and removal PR/release when known. Do not retain a warning-only legacy path. Add a Paja patch changeset for this obsolete integration fix; do not change package versions or bump unaffected packages.

Search maintained source/docs for stale claims, distinguishing historical records and legitimate current relay APIs. Run all full verification commands below and record their outcomes in the quick summary. Re-run the slop gate after later edits with its pinned configuration unchanged. Report unavailable gates explicitly; no dependencies need installing. Implementation and shipping belong to the parent workflow; this planner invocation only writes the plan and makes no commits.
  </action>
  <verify><automated>git diff --check</automated></verify>
  <done>Docs describe host-only discovery, retirement is traceable, Paja has a changeset, and full gate outcomes are recorded before shipment.</done>
</task>
</tasks>

<threat_model>
## Trust boundaries
Browser extension to host; host to relay/resource network; napplet to read-only identity service.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-GLZ-01 | Information disclosure | Extension discovery | medium | mitigate | Delete direct and lifecycle calls; zero-call tests in tasks 1–2. |
| T-GLZ-02 | Tampering | Identity metadata | medium | mitigate | Empty unsupported result instead of fabricated user NIP-65 metadata. |
| T-GLZ-03 | Elevation of privilege | Blossom discovery | high | mitigate | Preserve per-URL approval and event verification; retain denial regressions. |
</threat_model>

<verification>
Run from repository root after focused tests:
- pnpm build
- pnpm type-check
- pnpm test:unit
- pnpm docs:check
- npx --no-install aislop scan -d
- pnpm test:e2e (covers Paja and shell wiring; use existing installed-browser override if required locally)
- git diff --check

No installs planned. Missing scanner/browser is a reported gate blocker, not permission to silently download tooling or waive verification.
</verification>

## Multi-source coverage audit

| Source | Item | Coverage |
| --- | --- | --- |
| GOAL | Remove discovery rather than cache it | COVERED: tasks 1–2 |
| REQ | QUICK-261112-GLZ: discovery, lifecycle, signer, identity | COVERED: tasks 1–2 |
| RESEARCH | Per-author warming and separate Blossom lifecycle cache | COVERED: tasks 1–2 |
| RESEARCH | Current NIP-07 and pinned NAP-IDENTITY constraints | COVERED: tasks 1–3 |
| CONTEXT | Simplify signatures, retain host discovery/current NAP API | COVERED: tasks 1–2 |
| CONTEXT | No fabricated metadata or broader identity implementation | COVERED: task boundaries |
| CONTEXT | Docs, retirement, changeset and all repo gates | COVERED: task 3 and verification |

No separate phase ROADMAP/REQUIREMENTS/RESEARCH/CONTEXT artifacts were supplied for this quick task; the explicit request and checked specs define scope.

<success_criteria>
No direct or cached Paja extension relay discovery remains. Actual adapter tests prove zero calls. Host routing, resource policy and supported signer methods work. NAP identity retains its protocol shape with honest empty unsupported external-user results. Required gates pass before parent shipment.
</success_criteria>

<output>
Executor writes .planning/quick/261112-glz-remove-obsolete-nip-07-getrelays-discove/261112-glz-SUMMARY.md with evidence, checked specs and blockers. Planner only writes this plan; no implementation, commits, push or PR in this invocation.
</output>
