---
phase: 114
slug: paja-and-playground-approval-flows
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-17
---

# Phase 114 — Validation Strategy

> Continuous proof that Paja and playground use one runtime approval authority before execution, present one honest UI, isolate mediated resource from every form of direct browser authority, and preserve exact identity/lifecycle behavior across every launcher.

## Prerequisite and Test Infrastructure

| Property | Value |
|---|---|
| Cross-phase prerequisite | Phase 113 is complete and `113-18-SUMMARY.md` records its full green gate; Phase 114 execution halts while the resource/relay/intent contracts remain pending. |
| Framework | Vitest unit/integration suites plus Playwright real-browser network-effect coverage |
| Config files | `vitest.config.ts`, `playwright.config.ts`, `.aislop/config.yml` |
| New focused suites | `packages/shell/src/browser-admission.test.ts`, `packages/shell/src/browser-approval-ui.test.ts`, `packages/paja/src/browser-permission-adapter.test.ts`, `tests/unit/playground-approval-host.test.ts`, `tests/unit/playground-frame-loader.test.ts`, `tests/unit/playground-approval-network.test.ts` |
| New browser suite | `tests/e2e/firewall-host-approval.spec.ts` plus `tests/fixtures/firewall-host-approval/*` |
| Full phase command | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --yes aislop@0.12.0 scan -d && pnpm changeset status && git diff --check` |
| Feedback target | Focused Vitest commands under 120 seconds; Playwright/full gates may take up to 10 minutes |

## Sampling and Blocking Rules

- `114-CONTEXT.md` records twelve locked decisions as unlabeled bullets. This plan set assigns D-01 through D-12 in source order solely for traceability; the coverage rows below preserve the full text/meaning of each source decision.
- Every behavior-producing task begins with the named failing regression, then implements until its exact command passes. The new suites are created inside their task TDD cycles; no separate Wave 0 scaffold or package is needed.
- A failed task command blocks its task. A failed wave gate blocks every dependent wave. The Phase 113 prerequisite blocks Wave 1 and may not be bypassed by adapting to an unfinished export.
- Same-wave Paja and playground plans have no file overlap and may run in parallel. Shared shell/runtime files close in Plans 01–02 before either host branch starts.
- The host branch results are provisional until Plan 11's real-browser test passes for both hosts. CSP strings or unit mocks never substitute for the network counters.
- Phase completion requires Plan 12's exact full command. Package-only checks, selected Playwright grep, focused docs, or an unpinned slop command are feedback only.
- Recheck and semantically compare NIP-5D `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, `napplet/naps` master `19de5ce1cea40cd4c76089cdd8126e9f87648049`, NAP-RESOURCE `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, NAP-CONNECT `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`, and NAP-INTENT `fc121fc264615482143eda86125863d2e1f741a2` immediately before affected implementation; retrieval alone is not a spec review.

## Per-Task Verification Map

| Task ID | Wave | Requirements | Behavior proved | Automated command |
|---|---:|---|---|---|
| 114-01-01 | 1 | HOST-01, HOST-05 | One verified document uses the existing coordinator for interface plus launch admission, stays non-executable pending approval, suppresses stale results, and leaves operation once accounting single-owned. | `pnpm exec vitest run packages/runtime/src/permission-admission.test.ts packages/shell/src/browser-admission.test.ts` |
| 114-01-02 | 1 | HOST-01, HOST-04 | Resource/direct modes are exclusive; `default-src 'none'` plus a closed registry classifies exact supported directive/origin pairs and rejects denied/unknown directives. | `pnpm exec vitest run packages/shell/src/browser-admission.test.ts packages/shell/src/napplet-csp.test.ts` |
| 114-01-03 | 1 | HOST-01, HOST-04, HOST-05 | Additive runtime/shell admission exports compile with public JSDoc and no bypass/raw-CSP export. | `pnpm --filter @kehto/runtime build && pnpm --filter @kehto/runtime type-check && pnpm --filter @kehto/shell build && pnpm --filter @kehto/shell type-check` |
| 114-02-01 | 2 | HOST-02 | Common accessible prompt renders trusted identity, operation, exact scopes, mediation, and offered lifetimes; allow/deny/cancel/abort settle correctly. | `pnpm exec vitest run packages/shell/src/browser-approval-ui.test.ts` |
| 114-02-02 | 2 | HOST-02, HOST-05 | Grant rows follow runtime truth; revoke/clear/retry and fail-closed persistence have host lifecycle callbacks without a UI store; shell docs stay synced. | `pnpm exec vitest run packages/shell/src/browser-approval-ui.test.ts && pnpm --filter @kehto/shell type-check && pnpm docs:check` |
| 114-03-01 | 3 | HOST-02, HOST-05 | Paja boots the common permission adapter, persists only runtime grants, revokes live work, and documents the boundary. | `pnpm exec vitest run packages/paja/src/browser-permission-adapter.test.ts packages/paja/src/browser-host.test.ts && pnpm docs:check` |
| 114-03-02 | 3 | HOST-05 | Legacy exact signer choices cannot bypass runtime authorization, warn on actual use, remain bounded, leave canonical use quiet, and have synced README guidance. | `pnpm exec vitest run packages/paja/src/browser-host-signer.test.ts packages/paja/src/browser-signer-consent.test.ts && pnpm docs:check` |
| 114-08-01 | 3 | HOST-02, HOST-05 | Playground boots the same prompt/runtime grant-management path and retires live work on revoke. | `pnpm exec vitest run tests/unit/playground-approval-host.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 114-08-02 | 3 | HOST-05 | Playground ACL/service controls restrict availability but cannot authorize; historical service preferences remain non-authorizing and docs distinguish the controls. | `pnpm exec vitest run tests/unit/playground-capability-maps.test.ts tests/unit/playground-approval-host.test.ts && pnpm docs:check` |
| 114-08-03 | 3 | HOST-02, HOST-04, HOST-05 | Obsolete connect consent/hooks cannot grant network authority and signing keeps its own runtime owner. | `pnpm exec vitest run tests/unit/playground-approval-host.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 114-04-01 | 4 | HOST-01, HOST-03, HOST-04 | Verified Paja pointer admits before srcdoc; required denial blocks, optional denial narrows, and hints grant no CSP authority. | `pnpm exec vitest run packages/paja/src/browser-target-frame.test.ts` |
| 114-04-02 | 4 | HOST-01, HOST-03 | Paja local identity is exact final URL plus fetched-byte hash with signed-principal isolation. | `pnpm exec vitest run packages/paja/src/browser-local-loader.test.ts packages/paja/src/local-target.test.ts packages/paja/src/browser-target-frame.test.ts` |
| 114-04-03 | 4 | HOST-03 | Paja reload/navigation/close/replacement/simultaneous sources cancel precisely and suppress late commits. | `pnpm exec vitest run packages/paja/src/browser-runtime-tabs.test.ts packages/paja/src/browser-target-frame.test.ts` |
| 114-09-01 | 4 | HOST-01, HOST-03, HOST-05 | Verified playground bytes admit before srcdoc while signed bytes/bootstrap/gateway provenance remains correct. | `pnpm exec vitest run tests/unit/playground-frame-loader.test.ts tests/unit/playground-shell-host-proxy.test.ts tests/unit/playground-gateway-guard.test.ts` |
| 114-09-02 | 4 | HOST-01, HOST-03, HOST-05 | Installed playground target admits before retain/start with one intent operation authorization and once consumption. | `pnpm exec vitest run tests/unit/playground-installed-catalog.test.ts tests/unit/playground-intent-controller.test.ts` |
| 114-09-03 | 4 | HOST-03, HOST-05 | Playground reload/replacement/close/revoke cancels exact pending frame and retained intent work. | `pnpm exec vitest run tests/unit/playground-frame-loader.test.ts tests/unit/playground-intent-controller.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 114-05-01 | 5 | HOST-01, HOST-03, HOST-04 | Paja's existing file/artifact route admits one prebuilt embedded HTML artifact under strict local-only CSP; no recursive live graph capture is assumed. | `pnpm exec vitest run packages/paja/src/browser-target-frame.test.ts packages/paja/src/target-cors.test.ts` |
| 114-05-02 | 5 | HOST-01, HOST-03, HOST-04 | Paja live dev is explicit direct mode, approves exact supported directive/origin pairs, denies unsupported/unknown entries, omits resource, and rejects required conflict. | `pnpm exec vitest run packages/paja/src/browser-target-frame.test.ts packages/paja/src/target-cors.test.ts` |
| 114-05-03 | 5 | HOST-03 | CLI, server, generated host page, and bench-equivalent inventory all reach the common Paja host/admission path. | `pnpm exec vitest run packages/paja/src/server.test.ts packages/paja/src/cli.test.ts packages/paja/src/host-page.test.ts` |
| 114-10-01 | 5 | HOST-01, HOST-03, HOST-04 | Playground's file/artifact route admits one prebuilt embedded HTML artifact with exact URL+hash identity and zero remote authority, without graph crawling. | `pnpm exec vitest run tests/unit/playground-frame-loader.test.ts tests/unit/playground-approval-network.test.ts` |
| 114-10-02 | 5 | HOST-01, HOST-04 | Playground removes static/inferred origins; live dev maps exact supported directives, structurally denies unsupported classes, rejects unknown input, isolates resource, and retires on revoke. | `pnpm exec vitest run tests/unit/playground-frame-loader.test.ts tests/unit/playground-approval-network.test.ts tests/unit/playground-gateway-guard.test.ts` |
| 114-10-03 | 5 | HOST-03, HOST-05 | Playground config/preferences/simulation remain useful inputs but cannot authorize or bypass frame admission. | `pnpm exec vitest run tests/unit/playground-approval-network.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 114-06-01 | 6 | HOST-01, HOST-03 | Paja shared-link hidden launcher verifies/admit target before execution/delivery and cancels precisely. | `pnpm exec vitest run packages/paja/src/intent-launcher.test.ts packages/paja/src/intent-link.test.ts` |
| 114-06-02 | 6 | HOST-01, HOST-03, HOST-05 | Installed Paja target admits before retain/start and operation counters prove no duplicate once consumption. | `pnpm exec vitest run packages/paja/src/browser-intent-host.test.ts packages/paja/src/browser-intent-controller.test.ts` |
| 114-07-01 | 7 | HOST-04, HOST-05 | Paja endpoints/settings are proposals or hard limits and cannot authorize origins/interfaces. | `pnpm exec vitest run packages/paja/src/browser-config.test.ts packages/paja/src/browser-resource-settings.test.ts` |
| 114-07-02 | 7 | HOST-01, HOST-03, HOST-05 | Paja simulation uses bytes/config-bound identity and ordinary admission/lifecycle. | `pnpm exec vitest run packages/paja/src/browser-host.test.ts` |
| 114-07-03 | 7 | HOST-02, HOST-05 | Paja diagnostics are read-only/non-sensitive and common grant management remains runtime-backed. | `pnpm exec vitest run packages/paja/src/browser-devtools.test.ts packages/paja/src/browser-sidebar-sections.test.ts` |
| 114-11-01 | 8 | HOST-01–05 | Real Paja prebuilt embedded iframe uses mediated resource while all direct and omitted-class counters stay zero. | `pnpm exec playwright test tests/e2e/firewall-host-approval.spec.ts --grep "Paja mediated resource" --workers=1` |
| 114-11-02 | 8 | HOST-01–05 | Real Paja signed/prebuilt/live-dev/reload/intent UI proves directive-specific allow, unsupported same-origin deny, revoke, incompatibility, and stale lifecycle. | `pnpm exec playwright test tests/e2e/firewall-host-approval.spec.ts --grep "Paja" --workers=1` |
| 114-11-03 | 8 | HOST-01–05 | Real playground catalog/installed/prebuilt/live-dev/reload UI proves the same supported/denied directive and lifecycle parity. | `pnpm exec playwright test tests/e2e/firewall-host-approval.spec.ts --grep "Playground" --workers=1` |
| 114-12-01 | 9 | HOST-01–05 | Both host consumers, provenance, optional shell independence, prebuilt/live-dev boundary, closed CSP registry, structural denies, admitted namespace, and bypass absence are conformance-guarded. | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts` |
| 114-12-02 | 9 | HOST-01–05 | Docs/compatibility/package references and changesets match shipped behavior. | `pnpm docs:check && pnpm changeset status` |
| 114-12-03 | 9 | HOST-01–05 | Complete repository build/type/unit/browser/docs/slop/changeset/diff gate passes. | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --yes aislop@0.12.0 scan -d && pnpm changeset status && git diff --check` |

## Wave Feedback Gates

| Wave | Plans | Aggregate gate and release condition |
|---:|---|---|
| 1 | 01 | Phase 113 prerequisite plus all Plan 01 focused commands; runtime/shell API remains provisional until package builds/type checks pass. |
| 2 | 02 | `pnpm exec vitest run packages/runtime/src/permission-admission.test.ts packages/shell/src/browser-admission.test.ts packages/shell/src/napplet-csp.test.ts packages/shell/src/browser-approval-ui.test.ts && pnpm --filter @kehto/runtime type-check && pnpm --filter @kehto/shell type-check && pnpm docs:check` |
| 3 | 03, 08 | `pnpm exec vitest run packages/paja/src/browser-permission-adapter.test.ts packages/paja/src/browser-host.test.ts packages/paja/src/browser-host-signer.test.ts packages/paja/src/browser-signer-consent.test.ts tests/unit/playground-approval-host.test.ts tests/unit/playground-shell-host-proxy.test.ts tests/unit/playground-capability-maps.test.ts && pnpm --filter @kehto/paja type-check && pnpm exec tsc -p apps/playground/tsconfig.json --noEmit && pnpm docs:check` |
| 4 | 04, 09 | `pnpm exec vitest run packages/paja/src/browser-target-frame.test.ts packages/paja/src/browser-local-loader.test.ts packages/paja/src/local-target.test.ts packages/paja/src/browser-runtime-tabs.test.ts tests/unit/playground-frame-loader.test.ts tests/unit/playground-installed-catalog.test.ts tests/unit/playground-intent-controller.test.ts tests/unit/playground-shell-host-proxy.test.ts tests/unit/playground-gateway-guard.test.ts` |
| 5 | 05, 10 | `pnpm exec vitest run packages/paja/src/browser-target-frame.test.ts packages/paja/src/target-cors.test.ts packages/paja/src/server.test.ts packages/paja/src/cli.test.ts packages/paja/src/host-page.test.ts tests/unit/playground-frame-loader.test.ts tests/unit/playground-approval-network.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 6 | 06 | `pnpm exec vitest run packages/paja/src/intent-launcher.test.ts packages/paja/src/intent-link.test.ts packages/paja/src/browser-intent-host.test.ts packages/paja/src/browser-intent-controller.test.ts` |
| 7 | 07 | `pnpm exec vitest run packages/paja/src/browser-config.test.ts packages/paja/src/browser-resource-settings.test.ts packages/paja/src/browser-host.test.ts packages/paja/src/browser-devtools.test.ts packages/paja/src/browser-sidebar-sections.test.ts && pnpm --filter @kehto/paja type-check` |
| 8 | 11 | `pnpm exec playwright test tests/e2e/firewall-host-approval.spec.ts --workers=1` — only this both-host browser gate releases the host branches to docs/release validation. |
| 9 | 12 | The exact full phase command from Test Infrastructure; any failure blocks Phase 114 completion. |

## Multi-Source Coverage Audit

| Source | Item | Plans | Status |
|---|---|---|---|
| GOAL | Paja and playground approval before execution across signed, local/dev, reload/replacement, installed/shared intent, and host controls. | 01–12 | Covered |
| GOAL | Common user decisions and grant management with durable failure/revocation behavior. | 02, 03, 08, 11, 12 | Covered |
| GOAL | Exact direct-network versus mediated-resource isolation with real browser effects. | 01, 04, 05, 09–12 | Covered |
| REQ | HOST-01 interface approval before execution, required block, optional narrowing. | 01, 04–06, 09–12 | Covered |
| REQ | HOST-02 consistent trusted identity/operation/scope/lifetime/revoke UI. | 02, 03, 07, 08, 11, 12 | Covered |
| REQ | HOST-03 installed, dev, reload, replacement, link, simulation, and simultaneous launch parity. | 04–07, 09–12 | Covered |
| REQ | HOST-04 explicit exact CSP network grants; hints/config are not authority. | 01, 04, 05, 07, 09–12 | Covered |
| REQ | HOST-05 signer/config/simulation/diagnostics/access-control migration without parallel stores. | 01–03, 06–10, 12 | Covered |
| RESEARCH | Existing runtime coordinator/admission and durable grant store remain sole authority; no duplicate once consumption. | 01–03, 06, 08, 09, 11 | Covered |
| RESEARCH | `default-src 'none'` and a closed directive registry classify exact supported remote authority, structurally deny frame/child/object/manifest/navigation/form/base, and reject unknown/custom entries. | 01, 05, 10–12 | Covered |
| RESEARCH | Remote scripts/styles/images/fonts/workers/media/modules/fetch/websocket/HMR are direct network; resource requires zero remote browser authority. | 01, 05, 10, 11, 12 | Covered |
| RESEARCH | Development principal is exact final URL plus fetched artifact hash, isolated from signed grants. | 04, 05, 10, 11 | Covered |
| RESEARCH | Bounded development policy: one prebuilt embedded HTML artifact through the existing file/artifact route, or explicit live direct-network mode; no arbitrary graph crawler; required resource conflict fails before launch. | 05, 10–12 | Covered |
| RESEARCH | Completed Phase 113 resource/relay/intent contract and full-gate summary are an execution preflight, never guessed from concurrent work. | 01 | Covered |
| RESEARCH | Common framework-free UI and live runtime-backed grant management. | 02, 03, 08 | Covered |
| RESEARCH | Both-host real browser network-effect matrix and exact protocol rechecks. | 11, 12 | Covered |
| CONTEXT D-01 | Pure Firewall policy, runtime coordination/lifecycle, host presentation; no second store/evaluator. | 01–03, 06, 08, 09, 11, 12 | Covered |
| CONTEXT D-02 | Required deny blocks; optional deny narrows the approved snapshot. | 01, 04, 06, 09, 11, 12 | Covered |
| CONTEXT D-03 | Signed verified identity and exact URL+artifact-hash development identity; no persistent crossover. | 04–06, 09–11 | Covered |
| CONTEXT D-04 | Approval before executable bytes and currentness after every await/immediately before commit. | 01, 04–06, 09–12 | Covered |
| CONTEXT D-05 | Interface/resource/network stay distinct; ACL and protocol rules remain ceilings. | 01, 04–10, 12 | Covered |
| CONTEXT D-06 | Trusted identity/scope/lifetime/cancel UI, grant management, visible fail-closed persistence. | 02, 03, 05, 08, 11 | Covered |
| CONTEXT D-07 | Ordinary/reload/replacement/installed/link/local/dev/simulation/simultaneous paths. | 04–11 | Covered |
| CONTEXT D-08 | Close/navigation/replacement/grant-loss cancellation and late-answer suppression. | 01, 04, 06, 09, 11 | Covered |
| CONTEXT D-09 | Hints/config are not direct grants; exact origins; revoke direct frame. | 01, 04, 05, 07, 10–12 | Covered |
| CONTEXT D-10 | Independent rate/prompt budgets and honest mediation/metering explanation. | 01, 02, 05, 11, 12 | Covered |
| CONTEXT D-11 | Signer/config/simulation/diagnostics/settings migration with warnings/register/tests/removal. | 03, 06–10, 12 | Covered |
| CONTEXT D-12 | Docs, changesets, and both-host real-browser regressions in the same phase. | 11, 12 | Covered |
| DEFERRED | Phase 115 final cross-phase audit, cleanup, open PR, and ship. | none | Excluded by phase boundary |

## Manual-Only Verifications

All Phase 114 behavior has automated unit, integration, static-conformance, or real-browser proof. No manual-only acceptance remains.

## Validation Sign-Off

- [x] Every plan task maps to a runnable automated command.
- [x] New test files are created in the owning TDD task before production implementation.
- [x] Every requirement and D-01 through D-12 decision has explicit task coverage.
- [x] NAP-SHELL follows exact `19de5ce...` optional semantics: omission is valid, exposed shell has one retained readiness exchange, and unrelated domains never depend on it.
- [x] All GOAL, REQ, RESEARCH, and CONTEXT items are covered; only the explicit Phase 115 boundary is excluded.
- [x] Same-wave plans have no file overlap.
- [x] Direct-network tests include remote assets/workers/media plus unsupported same-origin nested/object/manifest and unknown-directive cases, not only fetch/connect.
- [x] Development tests use one prebuilt embedded artifact plus an explicit live-dev route and require no recursive graph crawler.
- [x] Real-browser tests exercise both production hosts and server counters.
- [x] Compatibility paths require runtime warning/quiet/scope tests and removal records when retained.
- [x] Full phase completion uses build, type, unit, browser, docs, pinned AI-slop, changeset, and diff gates.

**Approval state:** planned; executors update task and wave evidence in summaries. Phase 114 may be marked complete only after Wave 9's exact full command passes, then Phase 115 performs the final milestone audit and PR.
