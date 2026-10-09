---
phase: quick-261007-jux
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261007-jux]
files_modified:
  - packages/paja/src/browser-resource-settings.ts
  - packages/paja/src/browser-resource-settings.test.ts
  - packages/paja/src/browser-resource-settings-integration.test.ts
  - packages/paja/src/browser-host.ts
  - packages/paja/src/browser-adapter.ts
  - packages/paja/src/host-page.ts
  - packages/paja/src/host-page.test.ts
  - tests/e2e/paja-runtime-pointer.spec.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - docs/how-tos/paja-local-authoring.md
  - .changeset/paja-extra-resource-servers.md
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Developers can save additional public HTTPS Blossom origins through a newline sidebar textarea.
    - Valid saves apply to subsequent Blossom resource requests across all running tabs without reload; clearing removes only extras.
    - Invalid saves leave active and durable lists unchanged; unavailable persistence keeps valid changes session-only with truthful status.
    - Extras restore per host origin independently of upload destinations, NAP-CONFIG, pointer loading and CSP grants.
    - Existing request/event/user/window/default ordering, eight-server cap, hash verification, cancellation and browser network policy remain intact.
  artifacts:
    - path: packages/paja/src/browser-resource-settings.ts
      provides: Private host-owned settings controller and sidebar lifecycle
    - path: packages/paja/src/browser-resource-settings-integration.test.ts
      provides: Real resource service fetch proof for live updates and clearing
    - path: tests/e2e/paja-runtime-pointer.spec.ts
      provides: Save/reload, validation and running-frame browser proof
  key_links:
    - from: packages/paja/src/host-page.ts
      to: packages/paja/src/browser-resource-settings.ts
      via: Resource servers form and accessible inline status
    - from: packages/paja/src/browser-host.ts
      to: packages/paja/src/browser-adapter.ts
      via: One shared live settings getter installed before adapter creation
    - from: packages/paja/src/browser-adapter.ts
      to: packages/paja/src/browser-blossom-events.ts
      via: getConfiguredBlossomServers appends extras after existing defaults
---

<objective>
Add editable extra Blossom lookup servers to Paja's development sidebar, with atomic validated Save, origin-scoped persistence and immediate use by subsequent NAP-RESOURCE Blossom requests across running tabs.
Purpose: Supply resource lookup locations without changing upload policy or restarting napplets.
Output: Small private controller, sidebar wiring, real integration/browser regressions, docs and a patch changeset.
</objective>

<execution_context>
@/home/robert/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/robert/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@packages/paja/src/browser-host.ts
@packages/paja/src/browser-adapter.ts
@packages/paja/src/host-page.ts
@packages/paja/src/browser-resource.ts
@packages/paja/src/browser-blossom-events.ts
@packages/paja/src/browser-resource.test.ts
@tests/e2e/paja-runtime-pointer.spec.ts

Approved GSD quick task, not a roadmap phase. Stay on CURRENT feat/paja-local-index-html checkout; do not switch branches/worktrees. Prior local-file task is complete at d6584812; retain its changeset and functionality. Existing PR #278 https://github.com/kehto/web/pull/278 is updated by the orchestrator. Planner only writes this plan: no code implementation or commits. Executor stages explicit paths and makes atomic green Conventional Commits with the actual authoring agent's Co-Authored-By trailer.

Orientation: no tracked/staged diff; only untracked .gsd/dispatch-isolation-sentinel.json harness metadata, which must remain untouched/uncommitted. No project-local .claude/skills or .agents/skills found; configured planner agent-skills query returned no additions. No graphify graph exists. Level-0 discovery: reuse live source/test patterns, no dependencies or research/discussion needed. Grounded command pnpm exec vitest run packages/paja/src/browser-resource.test.ts passed (13 tests). Estimate calibration factor 1, zero samples, confidence low.

Spec check supplied by orchestrator: https://raw.githubusercontent.com/napplet/naps/9511232f69313aa7953d110e35d32cc28d506f66/naps/NAP-RESOURCE.md is Kehto's pinned authority, with accepted request servers before runtime/user defaults, ordered origin dedup/cap and hash checks. Rechecked open PR80 nub-resource head https://raw.githubusercontent.com/napplet/naps/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md removes hint/per-request request fields and uses urls, retaining runtime-owned fetch/HTTPS/hash policy. This feature is conformant runtime-owned host configuration, not a wire migration. Record drift; open draft status is not a blocker. Existing browser-only DNS-time private-IP enforcement limitation remains; avoid full conformance claims.

Locked conversational decisions, assigned IDs for traceability:
D-01: Resource servers sidebar section, plain newline textarea, Save, helper text and inline validation/status.
D-02: Bare-domain HTTPS shorthand; public HTTPS origins only; trim blanks, canonicalize and dedup in order; reject invalid schemes/paths/credentials/query/fragment/local-private values using normalizePublicBlossomServer.
D-03: Empty defaults, independent origin-scoped localStorage, truthful session-only failure behavior; atomic invalid Save leaves saved active list unchanged.
D-04: Shared live callback across all open runtime tabs, append extras after existing candidates, clearing removes extras only.
D-05: Preserve request/event/user/window hints, eight-server cap, hash/cancellation/CORS/browser security; no effects on uploads, initial pointers, HTTP(S) resource URLs or CSP grants.
D-06: Real resource integration, Playwright save/reload and validation, docs, patch changeset and all full gates.
D-07: Current branch, retained prior changeset, atomic credited executor commits, orchestrator updates existing PR.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Save one extra origin through the sidebar into a real resource fetch</name>
  <files>packages/paja/src/browser-resource-settings.ts, packages/paja/src/browser-host.ts, packages/paja/src/browser-adapter.ts, packages/paja/src/host-page.ts, packages/paja/src/browser-resource-settings-integration.test.ts</files>
  <behavior>
    - Real adapter resource service returns SHA-verified bytes from the saved extra origin after earlier candidates fail.
    - Two window IDs on one adapter observe live replace/clear without rebuilding the adapter.
    - Clearing extras retains request/window/configured candidates and their priority.
  </behavior>
  <action>
Start red with an adapter/resource-service integration regression following browser-resource.test.ts: actual createPajaAdapter and services.resource.handleMessage, only transport stubbed, SHA-256 calculated from actual fixture bytes, assertions on correlated resource.bytes.result Blob bytes and fetched URLs. Exercise two source window IDs and replace/clear on the same adapter, not just a getter-return test.

Per D-01 through D-05, introduce private browser-resource-settings.ts owning immutable active list, normalization, persistence and DOM listeners; keep browser-host.ts wiring-only. Render Resource servers in the development sidebar in both target-url and runtime-pointer modes. Use form paja-resource-servers-form, labeled plain textarea paja-resource-servers-input, submit Save paja-resource-servers-save, helper paja-resource-servers-help and inline status paja-resource-servers-status. Link aria-describedby, use polite live status and aria-invalid on failure, and render dynamic text with textContent. Helper must explain one origin per line, bare domains use HTTPS, subsequent Blossom requests across all running tabs, and no upload destination change.

Validate the whole draft before active/storage mutation. Split newlines, trim, skip blanks; recognize bare domain/optional port shorthand only with the constrained hostname grammar used by normalizeEventServer, prefix https:// only for shorthand, then call normalizePublicBlossomServer on every value. Canonical origin dedup preserves first occurrence. Reject HTTP/other schemes, scheme-relative strings, credentials, non-root paths, queries/fragments, local/private literals and malformed input with line-specific error; never silently filter invalid Save input. Empty Save activates no extras. Keep the combined eight-candidate fetch cap; do not invent a separate settings-list cap.

Use dedicated origin-scoped localStorage key kehto:paja:resource-servers with JSON string-array representation and empty default, independent of upload simulation and per-napplet NAP-CONFIG. Revalidate unknown stored JSON before activation; malformed/wrong-shaped/invalid stored lists cannot enter candidates. Restore before adapter creation. Valid Save becomes active even if storage access/write/remove fails; status explicitly says session-only and never claims durability or successful durable deletion. Successful Save replaces draft text with canonical newline origins.

Create one controller in installPajaHost and pass its getter through one optional private trailing createPajaAdapter callback defaulting to an empty list. Document this internal parameter, but add no package index exports, simulation/config schema, CLI or artifact-build options. Append getter results after the current pointer and upload defaults in getConfiguredBlossomServers. Install form listeners once and dispose on pagehide. Saving must not call reload, mutate generations, reset event caches or change per-window hints: the shared callback already reaches all windows through createPajaBlossomEventResolver. Leave browser-resource.ts transport/security behavior, upload destinations, pointer resolver inputs and CSP construction unchanged.
  </action>
  <verify><automated>pnpm exec vitest run packages/paja/src/browser-resource-settings-integration.test.ts packages/paja/src/browser-resource.test.ts</automated></verify>
  <done>Visible Save supplies a real hash-verified resource fetch candidate; update/clear works across two windows on the same adapter; previous defaults survive; invalid saves are atomic and persistence failures truthful.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Lock down validation, persistence failure UX and running tabs</name>
  <files>packages/paja/src/browser-resource-settings.ts, packages/paja/src/browser-resource-settings.test.ts, packages/paja/src/host-page.test.ts, tests/e2e/paja-runtime-pointer.spec.ts</files>
  <behavior>
    - Domain case, origin slash, default HTTPS port, duplicates and blanks normalize in order.
    - Invalid mixed drafts preserve both active and durable state; corrupt JSON and storage exceptions fail safely.
    - Read/write/remove failures disclose session-only behavior, including uncleared stale durable data.
    - Browser Save persists canonical text across reload; validation retains the previous list; Save/clear do not navigate existing frames or widen CSP.
  </behavior>
  <action>
Per D-02, D-03, D-05 and D-06, add controller table-driven tests with existing Vitest fake/stub patterns, not a new DOM dependency. Cover public HTTPS and bare domain/port, ordered canonical duplicates, blank-only clear, non-HTTPS, paths, credentials, query/fragment, scheme-relative/malformed input, localhost/local suffixes and private IPv4/IPv6 forms rejected by the existing validator. Cover blocked storage getter, getItem/setItem/removeItem failures, valid reload, invalid mixed Save atomicity, invalid stored JSON/shape/values, unsaved draft not persisted, and defensive snapshots that cannot mutate active state. Do not render rejected text as HTML.

Add host-page markup assertions for both modes. Preserve existing resource/event-resolver regressions for request priority, event/user lists, per-window pointer isolation, dedup, eight-server cap, hash mismatch, cancellation, redirect refusal and CORS. The real integration test must establish extras come after earlier configured defaults, update/clear are live, and extras do not become upload destinations, pointer loader options, direct HTTP(S) destinations or CSP grants. If expansion is needed, extend the integration test within Task 1 before this task rather than adding unlisted production layers.

Extend existing paja-runtime-pointer.spec.ts using startPointerServer and fixture helpers. Intercept public HTTPS fixture origins with page.route; do not weaken validation to accept localhost or contact real external servers. Save a bare domain plus duplicate HTTPS variant and assert canonical text, durable status and restore after host reload. Invalid mixed input shows inline error and reload retains prior saved list; blank Save clears it across reload. Compare existing window IDs/generations and srcdoc/CSP before/after Save/clear, proving no frame navigation/replacement. Send an actual running napplet resource.bytes request after Save with hash-valid fixture bytes and assert the extra-origin request and response; test replace/clear without napplet reload. Inject blocked persistence and assert session-only status plus usable resource fetching. Dispose fixture servers/listeners and use readiness polling, not sleeps. Full browser suite executes in Task 3.
  </action>
  <verify><automated>pnpm exec vitest run packages/paja/src/browser-resource-settings.test.ts packages/paja/src/browser-resource-settings-integration.test.ts packages/paja/src/host-page.test.ts packages/paja/src/browser-resource.test.ts packages/paja/src/browser-blossom-events.test.ts</automated><human-check>Check sidebar desktop/narrow layout: labeled textarea, keyboard Save, readable wrapping helper/status, no modal.</human-check></verify>
  <done>Validation, canonical restore, atomic failure, clear and persistence exception cases are covered; Playwright proves real save/reload/error UX, running-frame stability and extra-origin resource reads.</done>
</task>

<task type="auto">
  <name>Task 3: Document the read-only host setting and run all ship gates</name>
  <files>packages/paja/README.md, docs/packages/paja.md, docs/how-tos/paja-local-authoring.md, .changeset/paja-extra-resource-servers.md</files>
  <action>
Per D-06 and D-07, document Resource servers, newline examples/HTTPS shorthand, canonical ordered dedup, atomic validation, origin-scoped persistence and session-only failures, live all-tab effect and blank clearing. Explain candidate priority and eight-server truncation: extras may not be reached when prior candidates fill the cap. Distinguish resource lookups from upload destinations and NAP-CONFIG, initial pointer/artifact loading, direct HTTP(S) URLs and napplet CSP/network grants. Preserve truthful browser CORS/DNS limitations. Record pinned 9511232 authority and fa6bcc6 draft wire drift without claiming full conformance or migrating wire.

Add separate @kehto/paja patch changeset .changeset/paja-extra-resource-servers.md; retain prior local-file changeset unchanged. Do not manually bump versions/lockfiles. Executor stages exact paths and makes atomic green Conventional Commits with actual agent Co-Authored-By trailer. Orchestrator owns push/update of PR #278; do not create another PR, publish, or switch branches.

Run pnpm build, pnpm type-check, pnpm test:unit, pnpm docs:check, pnpm test:e2e (FULL suite), git diff --check, and cached aislop 0.16.1 scan at /home/robert/.npm/_npx/91a2954dc9ff87cc/node_modules/.bin/aislop scan. Require 100/100; do not weaken .aislop/config.yml. Repeat slop after each implementation iteration and later edits. Focused pnpm test:e2e tests/e2e/paja-runtime-pointer.spec.ts may run earlier but never replaces the full suite. Record exact gate output/counts and spec findings in SUMMARY; fix scoped regressions and report unrelated failures honestly, never call failed gates green.
  </action>
  <verify><automated>pnpm build && pnpm type-check && pnpm test:unit && pnpm docs:check && pnpm test:e2e && /home/robert/.npm/_npx/91a2954dc9ff87cc/node_modules/.bin/aislop scan && git diff --check d6584812 HEAD && git diff --check</automated></verify>
  <done>Docs/patch changeset match behavior, prior changeset survives, all full gates pass with slop 100/100, and credited atomic executor commits are ready for orchestrator PR #278 update.</done>
</task>

</tasks>

<threat_model>
ASVS1; blocking threshold high. No new package installs or database/API integration.

## Trust Boundaries
| Boundary | Description |
| --- | --- |
| Textarea → active runtime list | Untrusted input selects browser fetch origins. |
| localStorage → active list | Durable content is untrusted and may be stale/corrupt/inaccessible. |
| Source-bound napplet → service → remote server | Existing ACL/session, resource policy and verified response boundary. |

## STRIDE Threat Register
| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-jux-01 | Tampering / Elevation | Input/storage normalization | high | mitigate | Tasks 1/2 constrain shorthand and reuse normalizePublicBlossomServer for all inputs; validate storage shape and all lines before activation; reject local/private or credential/path/query payloads. |
| T-jux-02 | Tampering | Dynamic UI errors | high | mitigate | Tasks 1/2 use textContent, never inject draft/storage as HTML; atomic invalid-save rejection. |
| T-jux-03 | Information disclosure | Resource fetch | medium | mitigate | Keep credentials omitted, no referrer/redirects, SHA checking and existing source-scoped priority/CORS; no grant expansion. |
| T-jux-04 | Denial of service | Candidate fetching | medium | mitigate | Preserve ordered dedup, eight-server combined cap, response cap and cancellation; no speculative fetch on Save. |
| T-jux-05 | Repudiation | Persistence feedback | medium | mitigate | Truthful session-only status on access/write/remove failure; no false durable-clear claim; exception regressions. |
| T-jux-06 | Information disclosure | DNS private resolution | medium | accept | Browser cannot pin DNS: unchanged existing limitation is documented, not claimed as full NAP conformance. |
</threat_model>

<assumption_delta_decision>
Primary noun: ordered runtime-owned resource lookup candidates, not upload destinations. Decision: no-change — candidates already are plural/source-scoped; expose a host-owned extra tail through the existing callback, preserving independent upload and per-napplet configuration identity.
</assumption_delta_decision>

## Hook processing
The installed gsd-tools loop render-hooks plan:pre --raw output supplied active kind=contribution into=planner fragment.inline texts verbatim to planner context. API coverage detector ran on the actual plan and returned detected:true due to this hook-processing prose. Scope inspection confirms no new external API integration exists, only host settings for an existing Blossom fetch implementation; COVERAGE.md records the required reasoned no-integration declaration. No ORM/schema files match, so no DB push. Assumption-delta scan of quick ID returned skipped:true, reason:phase_unresolved (not a negative verdict); bounded identity decision above. Security configValues security_asvs_level=1 and security_block_on=high are honored in the threat model. No research/discussion or wire expansion is authorized. Diff checks intentionally cover both committed execution changes from d6584812 and any remaining uncommitted tree.

## Multi-source coverage audit
| Source | ID | Item | Tasks | Status |
| --- | --- | --- | --- | --- |
| GOAL | quick request | Editable extras and real runtime lookup effect | 1–3 | COVERED |
| REQ | QUICK-261007-jux | Approved quick scope; no roadmap requirement IDs assigned | 1–3 | COVERED |
| RESEARCH | live source/spec check | Callback chain, validator, priority/cap/hash/CORS and draft drift; no RESEARCH.md required | 1–3 | COVERED |
| CONTEXT | D-01 | Sidebar textarea/Save/helper/status | 1, 2 | COVERED |
| CONTEXT | D-02 | HTTPS shorthand, canonical dedup, atomic validation | 1, 2 | COVERED |
| CONTEXT | D-03 | Empty default, independent origin storage, session-only failures | 1, 2 | COVERED |
| CONTEXT | D-04 | Live all-tab getter, tail append, extras-only clear | 1, 2 | COVERED |
| CONTEXT | D-05 | Preserved security/priority and explicit exclusions | 1–3 | COVERED |
| CONTEXT | D-06 | Integration/browser tests, docs, patch changeset, full gates | 1–3 | COVERED |
| CONTEXT | D-07 | Current branch/prior work, credited execution commits, PR ownership | 3 | COVERED |

<verification>
Controller tests prove validation/persistence; real adapter/service tests prove verified fetches and live update/clear; Playwright proves Save/reload/error UX and running-frame stability. Full build/type/unit/docs/e2e plus slop 100/100 and diff hygiene are required.
</verification>

<success_criteria>
All observable must-haves and locked decisions are covered; no new public options/exports/dependencies or wire changes; existing PR #278 can be updated with exact gate evidence and bounded protocol findings.
</success_criteria>

<output>
Executor creates .planning/quick/261007-jux-paja-editable-extra-blossom-resource-loo/261007-jux-SUMMARY.md with files, decisions, exact spec refs/drift, gate counts, slop score, atomic commits and actual blockers. Planning subagent does not implement or commit.
</output>
