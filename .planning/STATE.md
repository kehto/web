---
gsd_state_version: 1.0
milestone: v1.22
milestone_name: Single-Window Development Runtime
status: complete
last_updated: "2026-07-03T19:08:00+02:00"
last_activity: 2026-07-03
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-21)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.22 planning — single-window development runtime for napplet authors with full current NAP/service parity, HMR via target URL, minimal two-bar chrome, and environment simulation controls.

## Current Position

Phase: 94 — Coverage, Docs, Release Readiness, and PR
Plan: 94-01 — complete
Status: v1.22 complete; branch pushed and PR #64 opened

Last activity: 2026-07-03 — Fixed package docs version rows after the release PR so main CI and Pages docs gates can pass.

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: ~6m
- Total execution time: ~6 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 86 | 1 | ~6m | ~6m |
| 87 | TBD | - | - |
| 88 | 1 | ~18m | ~18m |
| 89 | 1 | ~45m | ~45m |

## Accumulated Context

Full decision log lives in `.planning/PROJECT.md` Key Decisions table.

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

- **9 pre-existing stale guard-test failures** (`tests/unit/sdk-migration-guard.test.ts`, `playground-gateway-guard.test.ts`, `nip5d-conformance-guard.test.ts`) assert the pre-modernization 0.5.0/`@napplet/nub`/`ifc` graph that phases 86–88 already replaced with 0.12/0.13/`@napplet/nap`/`inc`. Out of phase-89 (docs) scope; logged to `.planning/phases/89-spec-doc-refresh-conformance-sweep/deferred-items.md`. Needs a test-owning follow-up to realign the guards before tagging v1.21.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260616-8iv | Move playground theme-switcher functionality from napplet into host theme-service node | 2026-06-16 | f4358b4 | [260616-8iv-move-playground-theme-switcher-functiona](./quick/260616-8iv-move-playground-theme-switcher-functiona/) |
| 260617-qoi | Drop NAP-CLASS, NAP-CLASS-1, NAP-CONNECT (clean break) + replace local spec mirrors with living-doc references | 2026-06-17 | 1d0eef3 | [260617-qoi-drop-nap-class-nap-class-1-nap-connect-c](./quick/260617-qoi-drop-nap-class-nap-class-1-nap-connect-c/) |
| 260617-wig | Add optional @kehto/shell `onUnroutedMessage` observability hook (surfaces silently-dropped unregistered-window messages — FEED-02 / hyprgate#21) | 2026-06-17 | fba1b67 | [260617-wig-shell-unrouted-message-hook](./quick/260617-wig-shell-unrouted-message-hook/) |
| 260618-heo | Remove IFC vocabulary and enforce INC-only live tracked files | 2026-06-18 | cd438c9 | [260618-heo-completely-remove-ifc-legacy-naming-and-](./quick/260618-heo-completely-remove-ifc-legacy-naming-and-/) |
| 260618-kam | Honor canonical NAP-RELAY `relay` hint on runtime `relay.subscribe` | 2026-06-18 | 3167eaa | [260618-kam-honor-explicit-relays-on-nap-relay-subsc](./quick/260618-kam-honor-explicit-relays-on-nap-relay-subsc/) |
| 260618-l4w | Add NAP and NIP-5D conformance guardrails for shell/runtime/services drift | 2026-06-18 | 7e829c3 | [260618-l4w-add-nap-and-nip-5d-conformance-guardrail](./quick/260618-l4w-add-nap-and-nip-5d-conformance-guardrail/) |
| 260619-tmr | Identify and document the web napplet cache strategy | 2026-06-19 | 75efa8b | [260619-tmr-napplet-web-cache-strategy](./quick/260619-tmr-napplet-web-cache-strategy/) |
| 260619-u3p | Implement napplet web cache strategy | 2026-06-19 | 8869e80 | [260619-u3p-implement-napplet-web-cache-strategy](./quick/260619-u3p-implement-napplet-web-cache-strategy/) |
| 260619-vpn | Fix flaky Playwright service activity counter wait in PR #63 | 2026-06-19 | bfcd7af | [260619-vpn-fix-flaky-playwright-service-activity-co](./quick/260619-vpn-fix-flaky-playwright-service-activity-co/) |
| 260620-07v | Update docs for NIP-5D napplet artifact cache implementation | 2026-06-20 | 234c8b4 | [260620-07v-update-kehto-docs-for-napplet-artifact-c](./quick/260620-07v-update-kehto-docs-for-napplet-artifact-c/) |
| 260621-4bv | Split dev-runtime into @kehto/paja implementation package and @kehto/cli kehto paja command | 2026-06-21 | 1990451 | [260621-4bv-split-dev-runtime-into-kehto-paja-implem](./quick/260621-4bv-split-dev-runtime-into-kehto-paja-implem/) |
| 260622-4ec | Guard valid multi-filter outbox.subscribe startup requests against init-burst rejection | 2026-06-22 | ac262e7 | [260622-4ec-resolve-issue-61-by-guarding-valid-multi](./quick/260622-4ec-resolve-issue-61-by-guarding-valid-multi/) |
| 260622-44f | Resolve issue #65 by allowing hosts to provide read-only identity data to createIdentityService | 2026-06-22 | bd1f941 | [260622-44f-resolve-issue-65-by-allowing-hosts-to-pr](./quick/260622-44f-resolve-issue-65-by-allowing-hosts-to-pr/) |
| 260622-6wk | Prepare v1.34 release by consuming pending Changesets and validating the release branch | 2026-06-22 | 8d990d0 | [260622-6wk-prepare-v1-34-release-by-consuming-pendi](./quick/260622-6wk-prepare-v1-34-release-by-consuming-pendi/) |
| 260622-8oy | Repair v1.34 release workflow after partial npm/JSR publish failure | 2026-06-22 | 74beb36 | [260622-8oy-repair-v1-34-release-workflow-after-part](./quick/260622-8oy-repair-v1-34-release-workflow-after-part/) |
| 260623-8is | Implement `resource.bytesMany` from updated NAP-RESOURCE | 2026-06-23 | dec7d18 | [260623-8is-implement-bytesmany-from-updated-nap-res](./quick/260623-8is-implement-bytesmany-from-updated-nap-res/) |
| 260623-9qg | Automate Changesets release PR and publish flow like napplet/web | 2026-06-23 | 98715b8 | [260623-9qg-automate-changeset-release-flow-like-nap](./quick/260623-9qg-automate-changeset-release-flow-like-nap/) |
| 260623-a4i | Optimize Playwright CI triggers and relevant spec selection | 2026-06-23 | 78e4d76 | [260623-a4i-optimize-playwright-ci-triggers-and-rele](./quick/260623-a4i-optimize-playwright-ci-triggers-and-rele/) |
| 260623-cxc | Prepare and ship the Changesets release for the merged NAP parity stack | 2026-06-23 | release/changesets-nap-parity-20260623 | [260623-cxc-prepare-and-ship-the-changesets-release-](./quick/260623-cxc-prepare-and-ship-the-changesets-release-/) |
| 260623-d76 | Fix Pages workflow playground base rebuild order | 2026-06-23 | fix/pages-base-rebuild-order | [260623-d76-fix-pages-workflow-playground-base-rebui](./quick/260623-d76-fix-pages-workflow-playground-base-rebui/) |
| 260623-diu | Fix stale `@napplet/*` JSR import ranges after the v1.35 release publish failure | 2026-06-23 | fix/jsr-napplet-020-imports | [260623-diu-fix-jsr-napplet-dependency-import-ranges](./quick/260623-diu-fix-jsr-napplet-dependency-import-ranges/) |
| 260623-e5u | Add manual release repair controls for targeted JSR publishing | 2026-06-23 | fix/release-jsr-repair-controls | [260623-e5u-release-jsr-repair-controls](./quick/260623-e5u-release-jsr-repair-controls/) |
| 260623-fh2 | Align Kehto Napplet dependencies with bytesMany release | 2026-06-23 | fix/napplet-bytesmany-deps | [260623-fh2-align-kehto-napplet-dependencies-with-by](./quick/260623-fh2-align-kehto-napplet-dependencies-with-by/) |
| 260624-1i5 | Resolve kehto/web#88 by allowing createBleService host hooks to emit ble.event notifications | 2026-06-23 | dbd6810 | [260624-1i5-resolve-kehto-web-88-createbleservice-ho](./quick/260624-1i5-resolve-kehto-web-88-createbleservice-ho/) |
| 260624-26b | Avoid duplicate Playwright release runs by triggering Publish after successful main CI and removing Release test reruns | 2026-06-23 | f64938d | [260624-26b-avoid-duplicate-playwright-tests-by-chai](./quick/260624-26b-avoid-duplicate-playwright-tests-by-chai/) |
| 260624-34q | Hide fake playground demo napplets from the active registry while retaining source directories | 2026-06-24 | fix/hide-fake-playground-napplets | [260624-34q-hide-fake-playground-napplets-from-runti](./quick/260624-34q-hide-fake-playground-napplets-from-runti/) |
| 260624-u17 | Fix issue #94 — relay.query one-shot returns matched events (NAP RelayQueryResultMessage) and delegates to the registered relay service, instead of a count | 2026-06-24 | fix/relay-query-events | [260624-u17-fix-relay-query-one-shot-returns-events-](./quick/260624-u17-fix-relay-query-one-shot-returns-events-/) |
| 260626-t30 | Prototype NIP-5D injected NAP interface domain bootstrap | 2026-06-26 | feat/nip5d-interface-injection-prototype | [260626-t30-prototype-nip-5d-injected-nap-interface-](./quick/260626-t30-prototype-nip-5d-injected-nap-interface-/) |
| 260626-u5n | Add regression coverage for napplet-owned `window.napplet` assignment against injected NIP-5D domain allowlist | 2026-06-26 | feat/nip5d-interface-injection-prototype | [260626-u5n-add-regression-coverage-for-napplet-owne](./quick/260626-u5n-add-regression-coverage-for-napplet-owne/) |
| 260626-ugy | Production harden PR #103 NIP-5D injected napplet namespace prelude | 2026-06-26 | feat/nip5d-interface-injection-prototype | [260626-ugy-production-harden-pr-103-nip-5d-injected](./quick/260626-ugy-production-harden-pr-103-nip-5d-injected/) |
| 260626-n7x | Add runtime-owned NAP-DM service with NIP-17, NDR, and Cordn adapters | 2026-06-26 | feat/nap-dm-chat-adapters | [260626-n7x-nap-dm-chat-adapter-service-for-nip-17-n](./quick/260626-n7x-nap-dm-chat-adapter-service-for-nip-17-n/) |
| 260628-ipk | Finish PR #103 NIP-5D injected namespace closeout against current upstream text | 2026-06-28 | feat/nip5d-interface-injection-prototype | [260628-ipk-finish-pr-103-nip-5d-injected-namespace-](./quick/260628-ipk-finish-pr-103-nip-5d-injected-namespace-/) |
| 260628-ldd | Add NAP-OUTBOX `outbox.getEvent` runtime support | 2026-06-28 | fix/nap-outbox-get-event | [260628-ldd-add-nap-outbox-getevent-runtime-support](./quick/260628-ldd-add-nap-outbox-getevent-runtime-support/) |
| 260628-l89 | Add NAP-UPLOAD `upload.info` runtime support | 2026-06-28 | fix/nap-upload-info | [260628-l89-add-nap-upload-upload-info-runtime-suppo](./quick/260628-l89-add-nap-upload-upload-info-runtime-suppo/) |
| 260628-l1y | Add NAP-RESOURCE resource.info runtime support | 2026-06-28 | 5415c74 | [260628-l1y-add-nap-resource-resource-info-runtime-s](./quick/260628-l1y-add-nap-resource-resource-info-runtime-s/) |
| 260628-mkr | Fix stale package docs versions blocking publish workflow | 2026-06-28 | fix/docs-version-strings-for-release | [260628-mkr-fix-stale-package-docs-versions-blocking](./quick/260628-mkr-fix-stale-package-docs-versions-blocking/) |
| 260630-i9k | Make Paja useful for napplet development | 2026-06-30 | c27d886 | [260630-i9k-make-paja-useful-development-tool](./quick/260630-i9k-make-paja-useful-development-tool/) |
| 260630-k7p | Fix gateway artifact audit srcdoc check | 2026-06-30 | fix/gateway-audit-srcdoc-check | [260630-k7p-fix-gateway-audit-srcdoc-check](./quick/260630-k7p-fix-gateway-audit-srcdoc-check/) |
| 260703-ghc | Align Kehto raw read-style NAP event surfaces with RelayEventResult sidecars and remove outbox.eose exposure | 2026-07-03 | 8aa2123 | [260703-ghc-align-kehto-raw-read-style-nap-event-sur](./quick/260703-ghc-align-kehto-raw-read-style-nap-event-sur/) |
| 260703-nva | Fix kehto paja to use NIP-5D event kinds instead of NIP-5A event kinds | 2026-07-03 | e8cedd0 | [260703-nva-fix-kehto-paja-to-use-nip-5d-event-kinds](./quick/260703-nva-fix-kehto-paja-to-use-nip-5d-event-kinds/) |
| 260703-oi0 | Use <= in package dependency upper bounds for issue #139 | 2026-07-03 | 89f4c11 | [260703-oi0-use-in-package-dependency-upper-bounds-f](./quick/260703-oi0-use-in-package-dependency-upper-bounds-f/) |
| 260703-pwi | Resolve PR #138 conflicts with current main | 2026-07-03 | 6ebab4e | [260703-pwi-resolve-pr-138-conflicts-with-current-ma](./quick/260703-pwi-resolve-pr-138-conflicts-with-current-ma/) |
| 260703-qjv | Fix docs package version rows after release version bump | 2026-07-03 | fix/docs-version-rows-after-release | [260703-qjv-fix-docs-package-version-rows-after-rele](./quick/260703-qjv-fix-docs-package-version-rows-after-rele/) |
| 260703-vfz | Chase current NAP-OUTBOX contract by removing caller-visible strategy, live, and outbox.eose controls | 2026-07-03 | fix/nap-outbox-eose-removal | [260703-vfz-chase-current-nap-outbox-contract-in-keh](./quick/260703-vfz-chase-current-nap-outbox-contract-in-keh/) |

## Session Continuity

Last session: 2026-06-17T06:58:00.000Z
Stopped at: Phase 89 complete — v1.21 NIP-5D #2303 + NAP-SHELL/INTENT conformance done (docs + changesets)
Resume file: None

## Operator Next Steps

- Realign the 3 stale guard specs to the 0.12/0.13/`@napplet/nap`/`inc` graph (see `89/deferred-items.md`) so `pnpm test:unit` is fully green before tagging.
- Run `pnpm changeset version` + publish to cut the v1.21 release (all 6 @kehto packages have changesets).

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
