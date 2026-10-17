---
phase: 113
slug: service-authorization-boundaries
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-17
---

# Phase 113 — Validation Strategy

> Continuous proof that every service operation reaches the runtime authorization coordinator, preserves its owning NAP contract, keeps rate limiting independent, and closes cancellation, revocation, replay, compatibility, and host-consumer boundaries.

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Vitest unit/integration suites plus Playwright browser coverage |
| Config files | `vitest.config.ts`, `playwright.config.ts` |
| Fast task command | The exact focused `pnpm exec vitest run ...` command in the owning plan and map below |
| Atomic resource command | Resource service/lifecycle/runtime/shell/Paja/conformance unit suites plus `tests/e2e/nap-resource.spec.ts` |
| Full phase command | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --yes aislop@0.12.0 scan -d && pnpm changeset status && git diff --check` |
| Feedback target | Focused unit checks under 120 seconds; browser and full wave checks may take up to 10 minutes |

## Sampling and Blocking Rules

- Run the mapped command after each task before its atomic code commit.
- Plans 01 and 02 are one atomic verification unit. Plan 01's focused checks provide feedback only; neither `113-01-SUMMARY.md` nor `113-02-SUMMARY.md` is complete until the Wave 2 combined resource gate passes.
- A failed task command blocks that task. A failed wave gate blocks every dependent wave.
- Plans 03, 05-08, and 10-15 may run in parallel only after Plan 02 closes the resource unit. Plan 04 follows Plan 03 because both modify the relay host path; Plan 09 follows Plan 05 because both extend the shared Paja DM/filesystem regression.
- Every new or absent regression named by a plan is created first inside that task's TDD cycle. No separate Wave 0 scaffold or new test dependency is required.
- Live-source permission revocation must produce the owning domain's canonical blocked/closed terminal when the protocol requires one. An explicit app `resource.cancel` is silent after cleanup and must suppress later terminal envelopes. Control/cancel/close paths remain usable after grants are consumed or operation/prompt limits are reached.
- Recheck each exact draft head immediately before implementation and record it in the plan summary. Retrieval alone never counts as semantic review.

## Per-Task Verification Map

| Task ID | Wave | Requirements | Behavior proved | Automated command |
|---|---:|---|---|---|
| 113-01-01 | 1 | SVC-02, SVC-05 | Exact resource URI and immediate origin are approved before a DNS-safe, capability-protected host connection; direct app endpoint attempts stop before DNS. | `pnpm exec vitest run packages/services/src/resource-service.test.ts packages/paja/src/browser-resource.test.ts packages/paja/src/server.test.ts` |
| 113-01-02 | 1 | SVC-02, SVC-05 | Canonical bulk/info, bounded completed-ID replay, cancel silence, live-revocation terminal, body lifetime, redirects, and per-item outcomes are enforced. | `pnpm exec vitest run packages/services/src/resource-service.test.ts packages/services/src/resource-lifecycle.test.ts packages/paja/src/browser-resource.test.ts` |
| 113-02-01 | 2 | SVC-02, SVC-05 | Injected resource API and internal types use the canonical wire and retain bounded compatibility diagnostics. | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` |
| 113-02-02 | 2 | SVC-02, SVC-05 | Paja consumers and browser flow use verified bytes and the protected resolver transport without exposing its capability. | `pnpm exec vitest run packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-resource-settings-integration.test.ts tests/unit/nip5d-conformance-guard.test.ts && pnpm exec playwright test tests/e2e/nap-resource.spec.ts --workers=1` |
| 113-02-03 | 2 | SVC-02, SVC-05 | Resource support boundaries, canonical wire, and retained compatibility are documented. | `pnpm docs:check` |
| 113-03-01 | 3 | SVC-03, SVC-05 | One explicit relay subscription authorizes the exact destination before contact. | `pnpm exec vitest run packages/services/src/relay-pool-service.test.ts packages/services/src/coordinated-relay.test.ts packages/runtime/src/dispatch.test.ts` |
| 113-03-02 | 3 | SVC-03, SVC-05 | Selected pools and publish fanout authorize every actual relay destination. | `pnpm exec vitest run packages/services/src/relay-pool-service.test.ts packages/services/src/coordinated-relay.test.ts` |
| 113-03-03 | 3 | SVC-03, SVC-05 | Paja, playground, runtime fallback, and reference relay implementations consume the same destination fields. | `pnpm exec vitest run packages/paja/src/browser-relay-runtime.test.ts tests/unit/playground-relay-service.test.ts tests/unit/nip5d-conformance-guard.test.ts` |
| 113-04-01 | 4 | SVC-03, SVC-05 | Outbox discovery and relay planning complete before authorized relay contact and preserve exact close semantics. | `pnpm exec vitest run packages/services/src/outbox-service.test.ts packages/services/src/relay-pool-outbox-router.test.ts` |
| 113-04-02 | 4 | SVC-03, SVC-05 | Local count remains local; remote count authorizes its actual relay targets. | `pnpm exec vitest run packages/services/src/count-service.test.ts packages/runtime/src/count-dispatch.test.ts packages/paja/src/browser-relay-runtime.test.ts` |
| 113-05-01 | 3 | SVC-04, SVC-05 | Picker approval and exact-file read authorization precede filesystem access. | `pnpm exec vitest run packages/services/src/fs-service.test.ts packages/paja/src/browser-fs.test.ts` |
| 113-05-02 | 3 | SVC-04, SVC-05 | Path operations and watches bind to the source and close precisely on revoke/replacement. | `pnpm exec vitest run packages/services/src/fs-service.test.ts packages/paja/src/browser-fs.test.ts packages/paja/src/browser-dm-fs.test.ts` |
| 113-06-01 | 3 | SVC-04, SVC-05 | Serial selection and session operations authorize the selected device and remain source-owned. | `pnpm exec vitest run packages/services/src/serial-service.test.ts packages/paja/src/browser-device-services.test.ts` |
| 113-06-02 | 3 | SVC-04, SVC-05 | BLE device, service, characteristic, and notification lifetimes are separately scoped and revoked. | `pnpm exec vitest run packages/services/src/ble-service.test.ts packages/paja/src/browser-device-services.test.ts` |
| 113-07-01 | 3 | SVC-03, SVC-04, SVC-05 | Upload target/type/size/identity approval precedes signing and public egress. | `pnpm exec vitest run packages/services/src/upload-service.test.ts packages/services/src/http-uploader.test.ts packages/paja/src/browser-upload.test.ts` |
| 113-07-02 | 3 | SVC-03, SVC-04, SVC-05 | Revocation aborts upload transport and suppresses late status without blocking cancel. | `pnpm exec vitest run packages/services/src/upload-service.test.ts packages/services/src/http-uploader.test.ts` |
| 113-08-01 | 3 | SVC-03, SVC-04, SVC-05 | CVM target/model/request authorization precedes transport. | `pnpm exec vitest run packages/services/src/cvm-service.test.ts packages/services/src/cvm-nostr-transport.test.ts packages/paja/src/browser-cvm.test.ts` |
| 113-08-02 | 3 | SVC-03, SVC-04, SVC-05 | CVM sessions are source-owned, replay-safe, closable, and revocable. | `pnpm exec vitest run packages/services/src/cvm-service.test.ts packages/services/src/cvm-nostr-transport.test.ts` |
| 113-09-01 | 4 | SVC-03, SVC-04, SVC-05 | DM send approval precedes encryption, signing, and relay egress. | `pnpm exec vitest run packages/services/src/dm-service.test.ts packages/paja/src/browser-dm-fs.test.ts tests/unit/dm-nip17-nak.test.ts` |
| 113-09-02 | 4 | SVC-03, SVC-04, SVC-05 | DM reads and subscriptions authorize relay/peer scope and stop on revoke. | `pnpm exec vitest run packages/services/src/dm-service.test.ts packages/paja/src/browser-dm-fs.test.ts` |
| 113-10-01 | 3 | SVC-03, SVC-04, SVC-05 | Signaling and ICE destinations are approved before peer setup. | `pnpm exec vitest run packages/services/src/webrtc-service.test.ts packages/paja/src/browser-webrtc.test.ts` |
| 113-10-02 | 3 | SVC-03, SVC-04, SVC-05 | Peer sessions and callbacks are source-owned and terminate without late delivery. | `pnpm exec vitest run packages/services/src/webrtc-service.test.ts packages/paja/src/browser-webrtc.test.ts` |
| 113-11-01 | 3 | SVC-03, SVC-04, SVC-05 | COMMON relay reads and signed actions authorize every operation and target. | `pnpm exec vitest run packages/services/src/common-service.test.ts packages/paja/src/browser-common.test.ts` |
| 113-11-02 | 3 | SVC-03, SVC-04, SVC-05 | LISTS read-modify-sign-publish keeps one authorized snapshot across side effects. | `pnpm exec vitest run packages/services/src/lists-service.test.ts packages/paja/src/browser-lists.test.ts` |
| 113-12-01 | 3 | SVC-04, SVC-05 | Identity/account reads authorize the exact operation and revalidate signer state. | `pnpm exec vitest run packages/services/src/identity-service.test.ts packages/paja/src/browser-host-signer.test.ts` |
| 113-12-02 | 3 | SVC-04, SVC-05 | Key/action registration and invocation are source-owned and revoked cleanly. | `pnpm exec vitest run packages/services/src/keys-service.test.ts packages/services/src/keys-ownership.test.ts` |
| 113-13-01 | 3 | SVC-04, SVC-05 | Intent approval binds the exact resolver-verified target before retain/start. | `pnpm exec vitest run packages/services/src/intent-service.test.ts packages/paja/src/browser-intent-host.test.ts` |
| 113-13-02 | 3 | SVC-04, SVC-05 | Retained intent work revokes consistently in Paja and playground. | `pnpm exec vitest run packages/paja/src/browser-intent-controller.test.ts tests/unit/playground-intent-controller.test.ts` |
| 113-14-01 | 3 | SVC-04, SVC-05 | Cache operations authorize exact local resource keys without inventing network scope. | `pnpm exec vitest run packages/services/src/cache-service.test.ts` |
| 113-14-02 | 3 | SVC-04, SVC-05 | Config and theme are explicitly classified and authorized as local boundaries. | `pnpm exec vitest run packages/services/src/config-service.test.ts packages/services/src/theme-service.test.ts` |
| 113-15-01 | 3 | SVC-04, SVC-05 | Gamepad ownership is source-bound and revoked without late events. | `pnpm exec vitest run packages/services/src/gamepad-service.test.ts` |
| 113-15-02 | 3 | SVC-04, SVC-05 | Media-session ownership and callbacks authorize exact operations and stop on revoke. | `pnpm exec vitest run packages/services/src/media-service.test.ts` |
| 113-15-03 | 3 | SVC-04, SVC-05 | Both notification service families authorize their exact effect and preserve host parity. | `pnpm exec vitest run packages/services/src/notification-service.test.ts packages/services/src/notify-service.test.ts packages/paja/src/browser-notify.test.ts` |
| 113-16-01 | 5 | SVC-01, SVC-03, SVC-04, SVC-05 | Authenticated service ingress uses one runtime authorization owner before dispatch. | `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/service-dispatch.test.ts packages/runtime/src/service-extension-approvals.test.ts` |
| 113-16-02 | 5 | SVC-01, SVC-03, SVC-04, SVC-05 | The old temporal Firewall gate is retired while independent rate limits and control paths remain correct. | `pnpm exec vitest run packages/runtime/src/firewall-dispatch.test.ts packages/runtime/src/rate-limit.test.ts packages/runtime/src/runtime.test.ts` |
| 113-16-03 | 5 | SVC-01, SVC-03, SVC-04, SVC-05 | LINK and retained compatibility paths pass through the closed ingress with warnings only on old use. | `pnpm exec vitest run packages/services/src/link-service.test.ts tests/unit/firewall-link-approval.test.ts packages/runtime/src/service-dispatch.test.ts` |
| 113-17-01 | 6 | SVC-01–05 | Paja and playground register every migrated contract; trusted resource capability stays main-frame-only. | `pnpm exec vitest run packages/paja/src/browser-adapter-host-actions.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-relay-service.test.ts` |
| 113-17-02 | 6 | SVC-01–05 | Every service implementation maps to a host consumer, authority status, lifecycle owner, regression, and docs owner. | `pnpm docs:check && pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts` |
| 113-18-01 | 7 | SVC-01–05 | Public docs and compatibility register match pure Firewall policy, runtime coordination, independent rates, canonical APIs, and bounded legacy diagnostics. | `pnpm docs:check && pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts packages/services/src/resource-service.test.ts packages/services/src/link-service.test.ts` |
| 113-18-02 | 7 | SVC-01–05 | Changesets cover shipped output and every repository quality gate passes. | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --yes aislop@0.12.0 scan -d && pnpm changeset status && git diff --check` |

## Wave Feedback Gates

| Wave | Plans | Aggregate gate and release condition |
|---:|---|---|
| 1 | 01 | Run both focused resource commands. Results are provisional; retain the work for Plan 02 and do not emit either resource completion summary. |
| 2 | 02 | `pnpm exec vitest run packages/services/src/resource-service.test.ts packages/services/src/resource-lifecycle.test.ts tests/unit/resource-approval-runtime.test.ts packages/shell/src/napplet-namespace.test.ts packages/paja/src/browser-resource.test.ts packages/paja/src/server.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-resource-settings-integration.test.ts tests/unit/nip5d-conformance-guard.test.ts && pnpm exec playwright test tests/e2e/nap-resource.spec.ts --workers=1 && pnpm --filter @kehto/services type-check && pnpm --filter @kehto/shell type-check && pnpm --filter @kehto/paja type-check && pnpm docs:check` — focused feedback only. Release both 01/02 summaries and Wave 3 only after this check AND the full phase command from Test Infrastructure pass, with public API/types, changesets, and compatibility tracking synced. The reduced focused command alone never releases the atomic resource group. |
| 3 | 03, 05-08, 10-15 | `pnpm exec vitest run packages/services/src packages/paja/src tests/unit/playground-intent-controller.test.ts tests/unit/playground-relay-service.test.ts` |
| 4 | 04, 09 | `pnpm exec vitest run packages/services/src/outbox-service.test.ts packages/services/src/relay-pool-outbox-router.test.ts packages/services/src/count-service.test.ts packages/runtime/src/count-dispatch.test.ts packages/paja/src/browser-relay-runtime.test.ts packages/services/src/dm-service.test.ts packages/paja/src/browser-dm-fs.test.ts tests/unit/dm-nip17-nak.test.ts` |
| 5 | 16 | `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/service-dispatch.test.ts packages/runtime/src/service-extension-approvals.test.ts packages/runtime/src/firewall-dispatch.test.ts packages/runtime/src/rate-limit.test.ts packages/services/src/link-service.test.ts tests/unit/firewall-link-approval.test.ts` |
| 6 | 17 | `pnpm exec vitest run packages/paja/src/browser-adapter-host-actions.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-relay-service.test.ts && pnpm docs:check` |
| 7 | 18 | Full phase command from Test Infrastructure; any failure blocks Phase 113 completion. |

## Coverage Audit

| Source | Item | Plans | Status |
|---|---|---|---|
| GOAL | Move interface/resource/network/device/file authorization into the Firewall policy plus runtime coordination chain, with independent rate limiting. | 01-18 | Covered |
| REQ | SVC-01 runtime service ingress ownership and legacy gate retirement. | 16-18 | Covered |
| REQ | SVC-02 resource resolver, canonical wire, replay, cancel/revoke, host consumer migration. | 01, 02, 17, 18 | Covered |
| REQ | SVC-03 all real network destinations authorized before I/O. | 03, 04, 07-11, 16-18 | Covered |
| REQ | SVC-04 filesystem, device, account, local interface, intent, notification, and other resource scopes. | 05-15, 16-18 | Covered |
| REQ | SVC-05 lifecycle, revocation, cancellation, replacement, and late-delivery suppression. | 01-18 | Covered |
| RESEARCH | Exact draft authorities and mandatory implementation-time semantic rechecks. | 01-13, 16, 17 | Covered |
| RESEARCH | Protected trusted resolver/proxy with DNS and direct-app bypass defenses. | 01, 02, 17 | Covered |
| CONTEXT | All operation approvals use concrete targets, stay source-owned, and keep rate limiting independent. | 01-18 | Covered |
| DEFERRED | Phase 114 app admission, approval UI, and CSP; Phase 115 shipment. | none | Excluded by phase boundary |

## Manual-Only Verifications

All Phase 113 behavior has an automated task or wave proof. No manual-only acceptance remains.

## Validation Sign-Off

- [x] Every plan task maps to a runnable automated command.
- [x] No three consecutive implementation tasks lack automated feedback.
- [x] Plans 01 and 02 have one explicit atomic completion gate.
- [x] Every requirement has task and wave coverage.
- [x] Host adapter changes trigger browser coverage before final completion.
- [x] Compatibility paths require warning, canonical quiet-path, security/lifecycle, and retirement evidence.
- [x] Full phase gates include build, type, unit, browser, docs, pinned AI-slop, changeset, and diff checks.

**Approval state:** planned; executors update task and wave evidence in their summaries, and Phase 113 may be marked complete only after the Wave 7 gate is green.
