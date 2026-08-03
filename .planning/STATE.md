---
gsd_state_version: 1.0
milestone: v1.29
milestone_name: Napplet Convention and Runtime Conformance
current_phase: 106
status: completed
stopped_at: Phase 106 current-Napplet release complete; v1.29 ready for milestone completion
last_updated: "2026-08-03T16:54:45Z"
last_activity: 2026-08-03
last_activity_desc: "Completed quick task 260803-osr: removed the app-specific live pointer canary"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 47
  completed_plans: 47
  percent: 100
current_phase_name: Active-Surface Conformance and Release
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.29 current-Napplet publication complete; milestone archival and the separate Phase 105 UI-debt follow-up remain

## Current Position

Phase: 106 (Active-Surface Conformance and Release) — COMPLETE
Plan: 3 of 3
Status: All v1.29 phases complete — eight-package Napplet-0.31-compatible npm/JSR release published and downstream-verified

Last activity: 2026-08-03 — Completed quick task 260803-osr: removed the app-specific live pointer canary

## Performance Metrics

**Velocity:**

- Total plans completed: 45
- Average duration: ~6m
- Total execution time: ~6 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 86 | 1 | ~6m | ~6m |
| 87 | TBD | - | - |
| 88 | 1 | ~18m | ~18m |
| 89 | 1 | ~45m | ~45m |
| 102 | 14 | - | - |
| 103 | 7 | - | - |
| 104 | 6 | - | - |
| 105 | 12 | - | - |
| 106 | 3 | - | - |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 101 P01 | 5min | 2 tasks | 4 files |
| Phase 101 P02 | 8min | 2 tasks | 11 files |
| Phase 101 P03 | 7 min | 2 tasks | 7 files |
| Phase 101 P04 | 9min | 2 tasks | 8 files |
| Phase 101 P05 | 7min | 2 tasks | 6 files |
| Phase 102-nap-inc-event-channel-parity P01 | 4min | 1 tasks | 4 files |
| Phase 102-nap-inc-event-channel-parity P02 | 6min | 2 tasks | 4 files |
| Phase 102-nap-inc-event-channel-parity P04 | 7min | 2 tasks | 2 files |
| Phase 102-nap-inc-event-channel-parity P09 | 5min | 1 tasks | 2 files |
| Phase 102-nap-inc-event-channel-parity P10 | 173s | 2 tasks | 8 files |
| Phase 102-nap-inc-event-channel-parity P03 | 7min | 2 tasks | 7 files |
| Phase 102-nap-inc-event-channel-parity P11 | 4m | 1 tasks | 6 files |
| Phase 102-nap-inc-event-channel-parity P12 | 9m | 1 tasks | 6 files |
| Phase 102 P05 | 16min | 2 tasks | 2 files |
| Phase 102-nap-inc-event-channel-parity P06 | 4min | 2 tasks | 2 files |
| Phase 102-nap-inc-event-channel-parity P07 | 4min | 1 tasks | 5 files |
| Phase 102 P08 | 6m 26s | 1 tasks | 8 files |
| Phase 103 P01 | 7m | 2 tasks | 5 files |
| Phase 103 P02 | 6m | 3 tasks | 4 files |
| Phase 103 P04 | 3m | 2 tasks | 2 files |
| Phase 103 P03 | 4m | 2 tasks | 4 files |
| Phase 103 P05 | 5m | 2 tasks | 5 files |
| Phase 103 P06 | 13m | 2 tasks | 8 files |
| Phase 103 P07 | 8m | 3 tasks | 12 files |
| Phase 104 P01 | 7 min | 3 tasks | 5 files |
| Phase 104 P02 | 7 min | 3 tasks | 11 files |
| Phase 104 P03 | 11 min | 2 tasks | 4 files |
| Phase 104 P04 | 14 min | 3 tasks | 11 files |
| Phase 104 P05 | 13 min | 3 tasks | 10 files |
| Phase 104 P06 | 3 min | 1 tasks | 2 files |
| Phase 105 P01 | 6m | 1 tasks | 14 files |
| Phase 105-published-convention-adoption-and-host-flows P02 | 10m | 1 tasks | 11 files |
| Phase 105 P03 | 10m | 1 tasks | 14 files |
| Phase 105 P04 | 6m | 2 tasks | 3 files |
| Phase 105 P05 | 6m | 2 tasks | 11 files |
| Phase 105 P06 | 11min | 2 tasks | 7 files |
| Phase 105 P08 | 20m | 2 tasks | 12 files |
| Phase 105 P07 | 24m | 2 tasks | 5 files |
| Phase 105-published-convention-adoption-and-host-flows P09 | 13m | 2 tasks | 14 files |
| Phase 105-published-convention-adoption-and-host-flows P10 | 5m | 2 tasks | 3 files |
| Phase 105-published-convention-adoption-and-host-flows P11 | 20m | 2 tasks | 14 files |
| Phase 105-published-convention-adoption-and-host-flows P12 | 10 min | 1 tasks | 6 files |
| Phase 106 P01 | 10m | 3 tasks | 6 files |
| Phase 106 P02 | 5m | 2 tasks | 1 files |
| Phase 106 P03 | 18m | 2 tasks | 2 files |

## Accumulated Context

Full decision log lives in `.planning/PROJECT.md` Key Decisions table.

### Key Context for v1.29

Baseline contract: `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`. Proposed authority additionally includes the exact draft heads of NAP-INC #89 `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, governance/web projection #90 `896c32c92deee68dc4d10fc1132b62df20cccb6f`, NAP-INTENT #91 `a718915ddefa2f03a0126579601f59d8bd86f7c4`, and symmetric channels #92 `c5cd06f7be6d4690b303949abb26e87ff62f4729`. Complete baseline delta: `.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`.

- Numbered cross-napplet protocols are gone; conventions use `napplet:<archetype>/<intent>[...?params]`.
- Full conformance also requires active SHELL, INTENT, INC, IDENTITY, and THEME corrections.
- `kehto/web#203` tracks implementation against the proposed resolutions: exact queryless identity and binding-owned query transposition from #89/#90, plus the #92 symmetric-channel reply. The issue remains open until Kehto implementation and positive/negative tests satisfy its close criteria.
- Merged `napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md` resolves Phase 102's repeated unopened-handle conflict: retain every trusted-parent handle in the binding and enforce the permitted per-napplet concurrent-channel maximum at authenticated runtime admission. Plan 102-14 owns the correction.
- Final package adoption is complete against the current published core 0.31.1,
  nap 0.31.2, shim 0.29.2, SDK 0.27.2, and Vite plugin 0.14.1 line. Kehto
  Paja 0.10.0 and its dependency graph accept the core/nap 0.31 peer window.

### Key Context for v1.21 (Phases 86–89)

Authoritative: `nostr-protocol/nips` PR #2303 (`5D.md`) + `napplet/naps` registry (NAP-SHELL + NAP-INTENT merged). Full audit: `.planning/NIP-5D-2303-DELTA-AUDIT.md` (G1–G8).

- **Phase 86 (G1/G2)** — SHELL-01/02: `handleShellReady` calls `postShellInit` unconditionally (`packages/shell/src/shell-ready.ts:15-24`); add a per-windowId "init already sent" guard. `class` wire type is `string|null` (`packages/runtime/src/types.ts:20`, emitted `shell-ready.ts:104-113`) — map to opaque `number|null`, keep internal string label.
- **Phase 87 (G3/G4)** — ARCH-01..04: parse `["archetype","<slug>","<NAP-N>"]` + optional `source` in `packages/nip/src/5d/index.ts` (parse at ~128-151); add `archetypes` to `NappletManifest`. Add manifest→`IntentCatalogEntry` adapter (consumed by `packages/services/src/catalog-intent-resolver.ts:49-56`). Wire playground catalog from resolved manifests; add 1 archetype-tagged napplet + intent dispatch e2e.
- **Phase 88 (G5/G6)** — TERM-01..05: `nap:` primary, `nub:` alias (`specs/NIP-5D.md:124`, `packages/shell/tests/perm-namespace.test.ts:120`). Migrate bot/chat/feed/profile-viewer `ifc`→`inc`. Bootstrap (`shared-vite-config.ts:48`) + `getMissingRequiredNaps` (`demo-hooks.ts:303-307`) read `naps`, fallback `nubs`. Conformance e2e for `naps`-only path.
- **Phase 89 (G7/G8)** — DOCS-01..04 + VERIFY-01: repin `specs/NIP-5D.md` to #2303 + NAP terms + archetype/source; local NAP-SHELL/NAP-INTENT mirrors; `RUNTIME-SPEC.md` refresh; comment sweep (keep `@napplet/nub` import specifier); verify unknown-`type` silent-ignore uniformity (NAP-INTENT `.result`/`.error` is sanctioned). Full suite green + changesets.

**Hard constraints (every phase):**

- Installed `@napplet/shim` is **0.5.0** (reads `capabilities.nubs`) → KEEP `naps`+`nubs` dual-emit; do NOT run CLEANUP-01.
- CI e2e runs `workers:1`; reload-heavy specs need `test.setTimeout(120000)`.
- Playground napplet / `DEMO_CAPABILITIES` counts asserted by multiple e2e specs — update in lockstep.
- v1.20 content-addressed internals already aligned — regression-guard only, do not change.
- `turbo.json globalDependencies` must include `shared-vite-config`; resolution sim must stay crash-proof; NIP-5A vector pinned.
- Branch `milestone/v1.21-nip5d-2303-nap-conformance` (off `feat/nip5d-runtime-srcdoc`); never push `main`.

### Blockers/Concerns

- Phase 105's 12/24 desktop/mobile UI audit remains non-passing post-merge debt owned by Kehto maintainers; it is not visual sign-off for the released package line.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260616-8iv | Move playground theme-switcher functionality from napplet into host theme-service node | 2026-06-16 | f4358b4 |  | [260616-8iv-move-playground-theme-switcher-functiona](./quick/260616-8iv-move-playground-theme-switcher-functiona/) |
| 260617-qoi | Drop NAP-CLASS, NAP-CLASS-1, NAP-CONNECT (clean break) + replace local spec mirrors with living-doc references | 2026-06-17 | 1d0eef3 |  | [260617-qoi-drop-nap-class-nap-class-1-nap-connect-c](./quick/260617-qoi-drop-nap-class-nap-class-1-nap-connect-c/) |
| 260617-wig | Add optional @kehto/shell `onUnroutedMessage` observability hook (surfaces silently-dropped unregistered-window messages — FEED-02 / hyprgate#21) | 2026-06-17 | fba1b67 |  | [260617-wig-shell-unrouted-message-hook](./quick/260617-wig-shell-unrouted-message-hook/) |
| 260618-heo | Remove IFC vocabulary and enforce INC-only live tracked files | 2026-06-18 | cd438c9 |  | [260618-heo-completely-remove-ifc-legacy-naming-and-](./quick/260618-heo-completely-remove-ifc-legacy-naming-and-/) |
| 260618-kam | Honor canonical NAP-RELAY `relay` hint on runtime `relay.subscribe` | 2026-06-18 | 3167eaa |  | [260618-kam-honor-explicit-relays-on-nap-relay-subsc](./quick/260618-kam-honor-explicit-relays-on-nap-relay-subsc/) |
| 260618-l4w | Add NAP and NIP-5D conformance guardrails for shell/runtime/services drift | 2026-06-18 | 7e829c3 |  | [260618-l4w-add-nap-and-nip-5d-conformance-guardrail](./quick/260618-l4w-add-nap-and-nip-5d-conformance-guardrail/) |
| 260619-tmr | Identify and document the web napplet cache strategy | 2026-06-19 | 75efa8b |  | [260619-tmr-napplet-web-cache-strategy](./quick/260619-tmr-napplet-web-cache-strategy/) |
| 260619-u3p | Implement napplet web cache strategy | 2026-06-19 | 8869e80 |  | [260619-u3p-implement-napplet-web-cache-strategy](./quick/260619-u3p-implement-napplet-web-cache-strategy/) |
| 260619-vpn | Fix flaky Playwright service activity counter wait in PR #63 | 2026-06-19 | bfcd7af |  | [260619-vpn-fix-flaky-playwright-service-activity-co](./quick/260619-vpn-fix-flaky-playwright-service-activity-co/) |
| 260620-07v | Update docs for NIP-5D napplet artifact cache implementation | 2026-06-20 | 234c8b4 |  | [260620-07v-update-kehto-docs-for-napplet-artifact-c](./quick/260620-07v-update-kehto-docs-for-napplet-artifact-c/) |
| 260621-4bv | Split dev-runtime into @kehto/paja implementation package and @kehto/cli kehto paja command | 2026-06-21 | 1990451 |  | [260621-4bv-split-dev-runtime-into-kehto-paja-implem](./quick/260621-4bv-split-dev-runtime-into-kehto-paja-implem/) |
| 260622-4ec | Guard valid multi-filter outbox.subscribe startup requests against init-burst rejection | 2026-06-22 | ac262e7 |  | [260622-4ec-resolve-issue-61-by-guarding-valid-multi](./quick/260622-4ec-resolve-issue-61-by-guarding-valid-multi/) |
| 260622-44f | Resolve issue #65 by allowing hosts to provide read-only identity data to createIdentityService | 2026-06-22 | bd1f941 |  | [260622-44f-resolve-issue-65-by-allowing-hosts-to-pr](./quick/260622-44f-resolve-issue-65-by-allowing-hosts-to-pr/) |
| 260622-6wk | Prepare v1.34 release by consuming pending Changesets and validating the release branch | 2026-06-22 | 8d990d0 |  | [260622-6wk-prepare-v1-34-release-by-consuming-pendi](./quick/260622-6wk-prepare-v1-34-release-by-consuming-pendi/) |
| 260622-8oy | Repair v1.34 release workflow after partial npm/JSR publish failure | 2026-06-22 | 74beb36 |  | [260622-8oy-repair-v1-34-release-workflow-after-part](./quick/260622-8oy-repair-v1-34-release-workflow-after-part/) |
| 260623-8is | Implement `resource.bytesMany` from updated NAP-RESOURCE | 2026-06-23 | dec7d18 |  | [260623-8is-implement-bytesmany-from-updated-nap-res](./quick/260623-8is-implement-bytesmany-from-updated-nap-res/) |
| 260623-9qg | Automate Changesets release PR and publish flow like napplet/web | 2026-06-23 | 98715b8 |  | [260623-9qg-automate-changeset-release-flow-like-nap](./quick/260623-9qg-automate-changeset-release-flow-like-nap/) |
| 260623-a4i | Optimize Playwright CI triggers and relevant spec selection | 2026-06-23 | 78e4d76 |  | [260623-a4i-optimize-playwright-ci-triggers-and-rele](./quick/260623-a4i-optimize-playwright-ci-triggers-and-rele/) |
| 260623-cxc | Prepare and ship the Changesets release for the merged NAP parity stack | 2026-06-23 | release/changesets-nap-parity-20260623 |  | [260623-cxc-prepare-and-ship-the-changesets-release-](./quick/260623-cxc-prepare-and-ship-the-changesets-release-/) |
| 260623-d76 | Fix Pages workflow playground base rebuild order | 2026-06-23 | fix/pages-base-rebuild-order |  | [260623-d76-fix-pages-workflow-playground-base-rebui](./quick/260623-d76-fix-pages-workflow-playground-base-rebui/) |
| 260623-diu | Fix stale `@napplet/*` JSR import ranges after the v1.35 release publish failure | 2026-06-23 | fix/jsr-napplet-020-imports |  | [260623-diu-fix-jsr-napplet-dependency-import-ranges](./quick/260623-diu-fix-jsr-napplet-dependency-import-ranges/) |
| 260623-e5u | Add manual release repair controls for targeted JSR publishing | 2026-06-23 | fix/release-jsr-repair-controls |  | [260623-e5u-release-jsr-repair-controls](./quick/260623-e5u-release-jsr-repair-controls/) |
| 260623-fh2 | Align Kehto Napplet dependencies with bytesMany release | 2026-06-23 | fix/napplet-bytesmany-deps |  | [260623-fh2-align-kehto-napplet-dependencies-with-by](./quick/260623-fh2-align-kehto-napplet-dependencies-with-by/) |
| 260624-1i5 | Resolve kehto/web#88 by allowing createBleService host hooks to emit ble.event notifications | 2026-06-23 | dbd6810 |  | [260624-1i5-resolve-kehto-web-88-createbleservice-ho](./quick/260624-1i5-resolve-kehto-web-88-createbleservice-ho/) |
| 260624-26b | Avoid duplicate Playwright release runs by triggering Publish after successful main CI and removing Release test reruns | 2026-06-23 | f64938d |  | [260624-26b-avoid-duplicate-playwright-tests-by-chai](./quick/260624-26b-avoid-duplicate-playwright-tests-by-chai/) |
| 260624-34q | Hide fake playground demo napplets from the active registry while retaining source directories | 2026-06-24 | fix/hide-fake-playground-napplets |  | [260624-34q-hide-fake-playground-napplets-from-runti](./quick/260624-34q-hide-fake-playground-napplets-from-runti/) |
| 260624-u17 | Fix issue #94 — relay.query one-shot returns matched events (NAP RelayQueryResultMessage) and delegates to the registered relay service, instead of a count | 2026-06-24 | fix/relay-query-events |  | [260624-u17-fix-relay-query-one-shot-returns-events-](./quick/260624-u17-fix-relay-query-one-shot-returns-events-/) |
| 260626-t30 | Prototype NIP-5D injected NAP interface domain bootstrap | 2026-06-26 | feat/nip5d-interface-injection-prototype |  | [260626-t30-prototype-nip-5d-injected-nap-interface-](./quick/260626-t30-prototype-nip-5d-injected-nap-interface-/) |
| 260626-u5n | Add regression coverage for napplet-owned `window.napplet` assignment against injected NIP-5D domain allowlist | 2026-06-26 | feat/nip5d-interface-injection-prototype |  | [260626-u5n-add-regression-coverage-for-napplet-owne](./quick/260626-u5n-add-regression-coverage-for-napplet-owne/) |
| 260626-ugy | Production harden PR #103 NIP-5D injected napplet namespace prelude | 2026-06-26 | feat/nip5d-interface-injection-prototype |  | [260626-ugy-production-harden-pr-103-nip-5d-injected](./quick/260626-ugy-production-harden-pr-103-nip-5d-injected/) |
| 260626-n7x | Add runtime-owned NAP-DM service with NIP-17, NDR, and Cordn adapters | 2026-06-26 | feat/nap-dm-chat-adapters |  | [260626-n7x-nap-dm-chat-adapter-service-for-nip-17-n](./quick/260626-n7x-nap-dm-chat-adapter-service-for-nip-17-n/) |
| 260628-ipk | Finish PR #103 NIP-5D injected namespace closeout against current upstream text | 2026-06-28 | feat/nip5d-interface-injection-prototype |  | [260628-ipk-finish-pr-103-nip-5d-injected-namespace-](./quick/260628-ipk-finish-pr-103-nip-5d-injected-namespace-/) |
| 260628-ldd | Add NAP-OUTBOX `outbox.getEvent` runtime support | 2026-06-28 | fix/nap-outbox-get-event |  | [260628-ldd-add-nap-outbox-getevent-runtime-support](./quick/260628-ldd-add-nap-outbox-getevent-runtime-support/) |
| 260628-l89 | Add NAP-UPLOAD `upload.info` runtime support | 2026-06-28 | fix/nap-upload-info |  | [260628-l89-add-nap-upload-upload-info-runtime-suppo](./quick/260628-l89-add-nap-upload-upload-info-runtime-suppo/) |
| 260628-l1y | Add NAP-RESOURCE resource.info runtime support | 2026-06-28 | 5415c74 |  | [260628-l1y-add-nap-resource-resource-info-runtime-s](./quick/260628-l1y-add-nap-resource-resource-info-runtime-s/) |
| 260628-mkr | Fix stale package docs versions blocking publish workflow | 2026-06-28 | fix/docs-version-strings-for-release |  | [260628-mkr-fix-stale-package-docs-versions-blocking](./quick/260628-mkr-fix-stale-package-docs-versions-blocking/) |
| 260630-i9k | Make Paja useful for napplet development | 2026-06-30 | c27d886 |  | [260630-i9k-make-paja-useful-development-tool](./quick/260630-i9k-make-paja-useful-development-tool/) |
| 260630-k7p | Fix gateway artifact audit srcdoc check | 2026-06-30 | fix/gateway-audit-srcdoc-check |  | [260630-k7p-fix-gateway-audit-srcdoc-check](./quick/260630-k7p-fix-gateway-audit-srcdoc-check/) |
| 260703-ghc | Align Kehto raw read-style NAP event surfaces with RelayEventResult sidecars and remove outbox.eose exposure | 2026-07-03 | 8aa2123 |  | [260703-ghc-align-kehto-raw-read-style-nap-event-sur](./quick/260703-ghc-align-kehto-raw-read-style-nap-event-sur/) |
| 260703-nva | Fix kehto paja to use NIP-5D event kinds instead of NIP-5A event kinds | 2026-07-03 | e8cedd0 |  | [260703-nva-fix-kehto-paja-to-use-nip-5d-event-kinds](./quick/260703-nva-fix-kehto-paja-to-use-nip-5d-event-kinds/) |
| 260703-oi0 | Use <= in package dependency upper bounds for issue #139 | 2026-07-03 | 89f4c11 |  | [260703-oi0-use-in-package-dependency-upper-bounds-f](./quick/260703-oi0-use-in-package-dependency-upper-bounds-f/) |
| 260703-pwi | Resolve PR #138 conflicts with current main | 2026-07-03 | 6ebab4e |  | [260703-pwi-resolve-pr-138-conflicts-with-current-ma](./quick/260703-pwi-resolve-pr-138-conflicts-with-current-ma/) |
| 260703-qjv | Fix docs package version rows after release version bump | 2026-07-03 | fix/docs-version-rows-after-release |  | [260703-qjv-fix-docs-package-version-rows-after-rele](./quick/260703-qjv-fix-docs-package-version-rows-after-rele/) |
| 260703-vfz | Chase current NAP-OUTBOX contract by removing caller-visible strategy, live, and outbox.eose controls | 2026-07-03 | fix/nap-outbox-eose-removal |  | [260703-vfz-chase-current-nap-outbox-contract-in-keh](./quick/260703-vfz-chase-current-nap-outbox-contract-in-keh/) |
| 260703-w7r | Bump local napplet demo and fixture package versions to the current published Napplet packages after the NAP-OUTBOX chase | 2026-07-03 | fix/napplet-package-version-catchup |  | [260703-w7r-bump-local-napplet-demo-and-fixture-pack](./quick/260703-w7r-bump-local-napplet-demo-and-fixture-pack/) |
| 260704-00s | Fix package docs version rows after the Napplet package catch-up merged on main | 2026-07-03 | fix/docs-version-rows-after-napplet-catchup |  | [260704-00s-fix-package-docs-version-rows-after-the-](./quick/260704-00s-fix-package-docs-version-rows-after-the-/) |
| 260704-0qm | Fix package docs version rows after Version Packages PR 147 merged | 2026-07-03 | fix/docs-version-rows-after-version-pr-147 |  | [260704-0qm-fix-package-docs-version-rows-after-vers](./quick/260704-0qm-fix-package-docs-version-rows-after-vers/) |
| 260704-0v1 | Update AGENTS.md release instructions to require checking tests and docs gates before pushing a release | 2026-07-03 | fix/docs-version-rows-after-version-pr-147 |  | [260704-0v1-update-agents-md-release-instructions-to](./quick/260704-0v1-update-agents-md-release-instructions-to/) |
| 260704-jrn | Remove stale NIP-5D optional sandbox permission language from kehto | 2026-07-04 | 0b75d3a |  | [260704-jrn-remove-stale-nip-5d-optional-sandbox-per](./quick/260704-jrn-remove-stale-nip-5d-optional-sandbox-per/) |
| 260706-pa2 | Fix post-release docs version row for @kehto/shell 0.16.5 | 2026-07-06 | fix/shell-docs-version-0-16-5 |  | [260706-pa2-fix-post-release-docs-version-row-for-ke](./quick/260706-pa2-fix-post-release-docs-version-row-for-ke/) |
| 260706-s4y | Skip expensive CI and Playwright for generated Version Packages changes | 2026-07-06 | fix/version-packages-ci-gating |  | [260706-s4y-skip-expensive-ci-and-playwright-for-gen](./quick/260706-s4y-skip-expensive-ci-and-playwright-for-gen/) |
| 260706-siz | Fix Paja target URL mode to inject NIP-5D domains before target bootstrap | 2026-07-06 | fix/paja-target-url-injection |  | [260706-siz-fix-paja-target-url-mode-so-local-napple](./quick/260706-siz-fix-paja-target-url-mode-so-local-napple/) |
| 260710-gsl | Align kehto NAP-KEYS implementation with napplet/naps draft | 2026-07-10 | 5f03089 |  | [260710-gsl-align-kehto-nap-keys-implementation-with](./quick/260710-gsl-align-kehto-nap-keys-implementation-with/) |
| 260710-h7u | Add AGENTS guardrails requiring issue and PR checks against napplet/naps NAP specs | 2026-07-10 | docs/nap-spec-triage-guardrails |  | [260710-h7u-add-agents-guardrails-requiring-issue-an](./quick/260710-h7u-add-agents-guardrails-requiring-issue-an/) |
| 260710-hmp | Make Paja useful for development with static runtime tabs | 2026-07-10 | feat/paja-multi-napplet-tabs |  | [260710-hmp-make-paja-useful-for-development-with-ru](./quick/260710-hmp-make-paja-useful-for-development-with-ru/) |
| 260710-jq1 | Make Paja use a real live relay/outbox runtime path and fix duplicate dialog cancel text | 2026-07-10 | feat/paja-multi-napplet-tabs |  | [260710-jq1-fix-paja-duplicate-cancel-label](./quick/260710-jq1-fix-paja-duplicate-cancel-label/) |
| 260710-jmo | Align Paja runtime tabs with the napplet frame body edge | 2026-07-10 | feat/paja-multi-napplet-tabs |  | [260710-jmo-align-paja-runtime-tabs-with-the-napplet](./quick/260710-jmo-align-paja-runtime-tabs-with-the-napplet/) |
| 260710-k7i | Remove the gap under active Paja runtime tabs | 2026-07-10 | feat/paja-multi-napplet-tabs |  | [260710-k7i-remove-the-gap-under-active-paja-runtime](./quick/260710-k7i-remove-the-gap-under-active-paja-runtime/) |
| 260710-kjt | Fix package docs version rows after Version Packages PR 177 | 2026-07-10 | fix/docs-version-rows-after-pr-177 |  | [260710-kjt-fix-package-docs-version-rows-after-vers](./quick/260710-kjt-fix-package-docs-version-rows-after-vers/) |
| 260710-kwx | Chase current NAP-OUTBOX publish fanout and pin updated Napplet package versions | 2026-07-10 | fix/nap-outbox-spec-chase |  | [260710-kwx-chase-current-nap-outbox-publish-fanout-](./quick/260710-kwx-chase-current-nap-outbox-publish-fanout-/) |
| 260710-pnr | Fix Paja NIP-07 CI ready race and local server shutdown flake | 2026-07-10 | fix/paja-nip07-ci-ready-race |  | [260710-pnr-fix-paja-nip07-ci-ready-race](./quick/260710-pnr-fix-paja-nip07-ci-ready-race/) |
| 260710-oq5 | Fix package docs version rows after Version Packages PR 182 broke Pages docs check | 2026-07-10 | fix/docs-version-rows-after-pr-182 |  | [260710-oq5-fix-package-docs-version-rows-after-vers](./quick/260710-oq5-fix-package-docs-version-rows-after-vers/) |
| 260711-j0x | Add Paja runtime tab share buttons and restore open pointer-loaded napplets between sessions | 2026-07-11 | 96130bc |  | [260711-j0x-add-paja-runtime-tab-share-buttons-and-r](./quick/260711-j0x-add-paja-runtime-tab-share-buttons-and-r/) |
| 260710-oq5 | Fix package docs version rows after Version Packages PR 182 broke Pages docs check | 2026-07-10 | fix/docs-version-rows-after-pr-182 | [260710-oq5-fix-package-docs-version-rows-after-vers](./quick/260710-oq5-fix-package-docs-version-rows-after-vers/) |
| 260711-jhr | Resolve PR #173 merge conflicts | 2026-07-11 | 14f902a | [260711-jhr-resolve-pr-173-merge-conflicts-by-mergin](./quick/260711-jhr-resolve-pr-173-merge-conflicts-by-mergin/) |
| 260711-r4p | Implement usable NAP-UPLOAD in Kehto Paja using Hyprgate's Blossom backend implementation as guidance | 2026-07-11 | d4c7da3 | Verified | [260711-r4p-implement-usable-nap-upload-in-kehto-paj](./quick/260711-r4p-implement-usable-nap-upload-in-kehto-paj/) |
| 260712-slw | Fix Paja naddr relay resolution end-to-end | 2026-07-12 | 8ba8e30 | Verified | [260712-slw-fix-paja-naddr-relay-resolution-end-to-e](./quick/260712-slw-fix-paja-naddr-relay-resolution-end-to-e/) |
| 260723-cvz | Diagnose and document Paja dev-mode opaque-origin CORS failure blocking napplet module scripts | 2026-07-23 | 0af445b | Verified | [260723-cvz-fix-paja-dev-mode-napplet-load-failure-c](./quick/260723-cvz-fix-paja-dev-mode-napplet-load-failure-c/) |
| 260724-czo | Inject a full Class-1 CSP into verified srcdoc loaders | 2026-07-24 | d3d966a | Verified | [260724-czo-inject-a-full-class-1-csp-into-verified-](./quick/260724-czo-inject-a-full-class-1-csp-into-verified-/) |
| 260726-g8r | Update AGENTS.md to require Kehto worktrees under ~/.worktrees/kehto | 2026-07-26 | 683018b | Verified | [260726-g8r-update-agents-md-to-require-kehto-worktr](./quick/260726-g8r-update-agents-md-to-require-kehto-worktr/) |
| 260728-fv2 | Record completed Phase 106 npm and JSR publication and downstream proof | 2026-07-28 | bec8074 | Verified | [260728-fv2-record-completed-phase-106-npm-and-jsr-p](./quick/260728-fv2-record-completed-phase-106-npm-and-jsr-p/) |
| 260728-pub | Publish Kehto against the current Napplet line | 2026-07-28 | 9390eca / b61b8cf | Verified | [260728-pub-update-kehto-compatibility-for-current-n](./quick/260728-pub-update-kehto-compatibility-for-current-n/) |
| 260802-lpw | Adopt the published NAP-INTENT package fixes in Kehto | 2026-08-02 | 32b629b | Verified | [260802-lpw-adopt-the-published-nap-intent-package-f](./quick/260802-lpw-adopt-the-published-nap-intent-package-f/) |
| 260802-o1w | Refresh PR #229 after #232 while retaining the host-side NAP-INTENT parser fix | 2026-08-02 | 599f55c | Verified | [260802-o1w-refresh-kehto-web-229-by-rebasing-fix-in](./quick/260802-o1w-refresh-kehto-web-229-by-rebasing-fix-in/) |
| 260802-q92 | Finish every advertised Paja NAP adapter and replace native confirmation prompts | 2026-08-02 | ee4ca3e | Verified | [260802-q92-finish-paja-nap-capability-closeout-with](./quick/260802-q92-finish-paja-nap-capability-closeout-with/) |
| 260803-osr | Remove the Good Morning-specific live pointer canary from PR #234 | 2026-08-03 | eb24855 | Verified | [260803-osr-remove-the-good-morning-specific-live-po](./quick/260803-osr-remove-the-good-morning-specific-live-po/) |

## Session Continuity

Last session: 2026-07-28T18:55:51Z
Stopped at: Phase 106 current-Napplet package line published and downstream-verified
Resume file: None

## Operator Next Steps

- Archive the completed v1.29 milestone when maintainers are ready.
- Track the Phase 105 12/24 UI findings as a separately scoped post-merge follow-up.

### Key Context for v1.22 (Phases 90–94)

Authoritative parity source inspected 2026-06-21: `/home/sandwich/Develop/napplet/packages/nap/src` exposes current web NAP domains `shell`, `relay`, `outbox`, `storage`, `identity`, `keys`, `config`, `resource`, `theme`, `notify`, `media`, `upload`, `intent`, `cvm`, `inc`, and deprecated `ifc` compatibility.

- **Phase 90** — create publishable local authoring runtime package and CLI. Complete: package/options/CLI/server/readiness/docs/TypeDoc/tests.
- **Phase 91** — build the actual minimal host page: one iframe, one top bar, one bottom bar, production-shaped sandbox/handshake, and runtime reload/reinit behavior. Complete with focused browser proof; service parity remains Phase 92.
- **Phase 92** — wire every possible Kehto service into the runtime and add a static parity guard against `@napplet/nap`. Complete: real ShellBridge adapter, deterministic development services, local/installed `@napplet/nap` domain guard, representative service traffic e2e.
- **Phase 93** — expose simulation controls for capabilities, ACL, firewall, identity, relay, storage, cache, upload, media, config, and theme. Complete: shared schema, config-file merge, CLI flags, compact UI, shell capability filtering, fixed identity/theme proof.
- **Phase 94** — close with unit/e2e/text coverage, changesets, full gates, push, and PR. Complete: `pnpm docs:check`, `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:e2e` (68 passed), `aislop` 100/100, `git diff --check`, PR #64. Follow-up renamed the implementation package to `@kehto/paja` and added `@kehto/cli` as the owner of `kehto paja`.

**Hard constraints (every phase):**

- Preserve stack-agnostic HMR by loading the user's app URL in the iframe; do not make the runtime Vite-only.
- Keep visible UI minimal by default: top bar + bottom bar only.
- Fill Kehto package gaps where needed; do not hide missing NAP support behind dev-runtime-only shims.
- Publishing remains GitHub Actions / tag-driven; no local package publishing.

## Decisions

- [Phase ?]: Runtime ingress drops every valid capability envelope until SessionRegistry has a source-bound NAP-SHELL session.
- [Phase ?]: shell.init is withheld without trusted creation-time identity; ready payload claims are ignored and registration IDs preserve reload semantics.
- [Phase ?]: ShellCapabilities now delivers only frozen bare domains; numbered protocols, naps, and sandbox payload fields are removed.
- [Phase ?]: Host grants are per trusted creation identity and can only narrow exact live, non-disabled domains and services.
- [Phase ?]: Injected shell supports(domain) is unary exact membership over the first valid frozen parent init.
- [Phase ?]: resolveShellEnvironment remains a host-only package export and is absent from injected and shim-facing APIs.
- [Phase ?]: Paja resolves bootstrap and shell.init from the same trusted OriginIdentity with equal content and isolated frozen snapshots.
- [Phase ?]: Paja shell.ready identity now comes only from pre-srcdoc origin-registry registration, never mutable browser state.
- [Phase ?]: Playground prelude membership is resolved from trusted OriginIdentity and live disabled-aware wiring, never manifest requirements or gateway data.
- [Phase ?]: Existing playground frames retain frozen first-init snapshots; only a new registration reflects later disabled-service wiring.
- [Phase ?]: Convention query transposition is serialized in the injected web prelude and never performed by the runtime router.
- [Phase ?]: inc.event sender is derived solely from the authenticated source session dTag.
- [Phase ?]: Unique live dTag resolution fails closed on duplicate owners.
- [Phase ?]: INC channels expose dTags and opaque IDs; teardown is shared across close, destroy, and revocation.
- [Phase ?]: INC binding uses the #89/#90/#92 exact-head contract with a projection-side reusable normalizer.
- [Phase ?]: INC assignment preserves extension fields but restores canonical convention operations and symmetric channel handles.
- [Phase ?]: Generic service dispatch reserves exact inc.emit messages for IncRuntime; topic text cannot select a handler.
- [Phase ?]: Direct canonical service routing remains keyed by the wire message.type domain.
- [Phase ?]: Notification services ignore every inc.emit input; only direct notify.* envelopes can trigger service behavior.
- [Phase ?]: The legacy audio topic service and its public types are removed; canonical media behavior remains direct-domain based.
- [Phase ?]: INC channel ACL is checked only at inc.channel.open; established routes are authorized by opaque membership.
- [Phase ?]: Only block and relay:read revoke events invalidate matching live dTag and aggregateHash channel routes.
- [Phase ?]: Keep direct notify.* notification examples isolated from opaque INC transport.
- [Phase ?]: Bot and chat keep core INC chat flows without notification-service side effects.
- [Phase ?]: Direct services route only from the exact wire message.type domain; INC topics never choose a service.
- [Phase ?]: Only the authenticated runtime attaches INC sender identity and produces delivery envelopes.
- [Phase ?]: Paja INC proof uses the installed shim bundle through real opaque-origin srcdoc and verifies Kehto-owned operations are restored after namespace assignment.
- [Phase ?]: The Paja reload fixture consumes shell.init via protected shell.onReady to avoid raw-listener timing races.
- [Phase ?]: NAP-INC #89/#90/#92 exact heads govern the playground public-API event and symmetric-channel browser proof.
- [Phase ?]: Focused playground INC proof uses an opt-in IPv6 base URL to avoid an unrelated IPv4 listener on port 4174.
- [Phase ?]: Pinned active INC guidance to draft heads #89/#90/#92 and linked living PRs instead of copying protocol text.
- [Phase ?]: Kept query-to-text payload transposition in the binding while runtime routing remains exact and queryless.
- [Phase ?]: Reserved NAP-INTENT lifecycle changes for Phase 104 and released package adoption for Phase 105.
- [Phase ?]: Phase 102 release metadata uses separate minor changesets for runtime, shell, ACL, and services; intent lifecycle and published package adoption remain Phase 104 and 105.
- [Phase ?]: Full Playwright supports an isolated IPv6 Kehto preview; 69 tests pass, the Phase 102 channel proof is green, and 7 legacy demo/fixture failures remain at the Phase 105 published-package adoption boundary.
- [Phase ?]: Runtime identity/theme denials use exact same-domain safe results; unsupported messages are silent.
- [Phase ?]: Identity public-key failures resolve once as a correlated empty-pubkey result; provider errors remain stable and non-sensitive.
- [Phase ?]: Theme service normalizes incomplete values to the fixed complete fallback before its sole changed callback.
- [Phase ?]: Injected identity and theme operations are stable frozen objects preserved across direct-domain and whole-namespace assignment.
- [Phase ?]: Only trusted-parent MessageEvents may settle identity/theme requests or invoke automatic change callbacks.
- [Phase ?]: Identity and theme host pushes require a shell.ready session, its frozen domain environment, and a current recipient ACL grant per window.
- [Phase ?]: Identity change pushes are sender-null and recipient identity:read; concurrent empty-pubkey sessions are evaluated independently.
- [Phase ?]: Paja forwards retained ThemeService callbacks through one attached eligible-session ShellBridge path; controller code never directly fans out theme changes.
- [Phase ?]: Paja's opaque-origin theme proof uses automatic protected onChanged delivery and an immediate theme.get, with no subscribe or unsubscribe traffic.
- [Phase ?]: Playground theme delivery now flows only through ThemeService state then the eligible ShellBridge push.
- [Phase ?]: Connecting and initial disconnected signer snapshots do not publish identity.changed; connected and sign-out transitions do.
- [Phase ?]: Pinned NAP-IDENTITY, NAP-THEME, and web projection authority to napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f.
- [Phase ?]: Kehto denied/unavailable theme reads use one complete fixed normal result without error as an explicit upstream-spec-gap reconciliation.
- [Phase ?]: The unrelated Phase 102 Paja INC-after-reload failure remains out of scope; no protocol workaround was added.
- [Phase ?]: Published Kehto core/nap peer declarations are bounded to >=0.29.0 <0.30.0; JSR maps retain ^0.29.0 release-line mappings.
- [Phase ?]: @napplet/shim 0.27.0 remains development-only and non-shell; Kehto retains its host-owned mandatory NAP-SHELL prelude.
- [Phase ?]: During Phase 105's ordered app migration, package graph guards accept only a complete 0.28 or 0.29 line per manifest while lock snapshots require the published 0.29 line.
- [Phase ?]: Remaining playground apps and browser fixtures use exact published 0.29.0/0.27.0/0.25.0/0.12.0 pins with a generated third lock checkpoint.
- [Phase ?]: Package-line guards dynamically inspect active manifests, JSR maps, final lock snapshots, and frozen installed metadata.
- [Phase ?]: Keep the Kehto-owned mandatory NAP-SHELL prelude because published core/shim 0.29.0/0.27.0 omit the generic shell API.
- [Phase ?]: NAP-INTENT values now come from released @napplet/core 0.29.0 while Kehto retains resolver and delivery policy.
- [Phase ?]: Paja retains serializable verified manifest and pointer facts independently from browser frames.
- [Phase ?]: Paja intent selection revalidates exact installed contracts and sender-aware explicit authorization before acceptance.
- [Phase ?]: Playground intent availability comes only from a persistent resolver-verified catalog, never the live frame map.
- [Phase ?]: Playground intent delivery waits for the registered current shell.ready source and sends exactly once without INC.
- [Phase ?]: Paja installs only resolver-verified manifests; source-bound readiness uses registered MessageEvent.source plus tab generation.
- [Phase ?]: Paja retains ThemeService as the only state-before-one-push theme route.
- [Phase ?]: Scope firewall init-burst accounting to host-attested iframe lifecycles while retaining dTag-wide rate limits.
- [Phase ?]: Playground profile intents advertise the live intent service through the stable adapter and reuse only origin-registered, session-bound ready targets.
- [Phase ?]: Profile picture and banner media use resourceBytes plus revocable Blob URLs; no standalone NAP-RESOURCE wire semantics were inferred.
- [Phase ?]: Profile cold-start verification closes live frames without revoking their verified catalog records, then proves one intent delivery without INC.
- [Phase ?]: The active playground gateway guard mirrors published intent/resource manifests and forbids legacy profile INC imports or carriers.
- [Phase ?]: Classify static migration evidence to explicit live sources while excluding history and intentional fixtures.
- [Phase ?]: Retain the Kehto-owned mandatory NAP-SHELL prelude as positive proof of the published core/shim shell omission exception.
- [Phase ?]: Treat the core/nap 0.29.0 peer-floor increase as breaking 0.x work and classify every affected published package as minor.
- [Phase ?]: Retain Kehto host-owned NAP-SHELL prelude because published core 0.29.0 and shim 0.27.0 omit generic shell.
- [Phase ?]: Treat resource hardening as non-normative Kehto policy because pinned master has no standalone NAP-RESOURCE.md.
- [Phase ?]: Installed resolver-verified manifests remain distinct from live frames/controllers for availability and selection.
- [Phase ?]: Kehto retains its host-owned mandatory shell prelude because published shim 0.27.0 is non-shell.
- [Phase ?]: Profile media follows NAP-IDENTITY resource.bytes delegation without inferring standalone NAP-RESOURCE wire semantics.
- [Phase ?]: PR #89 semantic delta is conformant: symmetric INC channel obligations already exist in runtime and prelude.
- [Phase ?]: Phase 106 active scans explicitly separate current guidance from historical records.
- [Phase ?]: Focused browser evidence records all five real-shell protocol flow classes; mandatory skips or failures block release readiness.
- [Phase ?]: Phase 105's 12/24 desktop/mobile UI audit remains visible non-blocking protocol-release debt owned by Kehto maintainers.
- [Phase ?]: At its original task boundary, Plan 106-02 ends at PR #204 readiness evidence; merge, versioning, exact-main CI, tag, and publishing were then-unexecuted release-process steps.
- [Phase ?]: Phase 106 release readiness requires local gates plus exact-SHA CI before PR #204 can be called merge-ready.
- [Phase ?]: Phase 105 UI audit remains explicit non-blocking Kehto-maintainer follow-up debt, not a visual pass.
- [Phase ?]: The post-Phase-106 publication follow-up is distinct from the original PR-readiness boundary and is complete only with exact-main CI/Pages, successful npm/JSR publishing, direct registry metadata, and a clean downstream install/import/build.
- [Phase ?]: A release is not current merely because its workflow succeeded; the published Kehto peer window must accept the registry's current Napplet `latest` line.
- [Phase ?]: Corrective PR #220 supplies the eight-package Changeset omitted from the prior release path; PR #221 and Release #30389303760 publish the Napplet 0.31-compatible line.
