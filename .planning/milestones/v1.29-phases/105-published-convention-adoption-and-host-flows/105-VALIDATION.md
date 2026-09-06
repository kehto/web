---
phase: 105
slug: published-convention-adoption-and-host-flows
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-27
audited: 2026-07-27
---

# Phase 105 — Validation Strategy

> Per-phase validation contract for continuous feedback during published package adoption and live Paja/playground host integration.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + Playwright 1.54.0 |
| **Config files** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts` |
| **Full phase command** | `pnpm build && pnpm type-check && pnpm test:unit && pnpm exec playwright test tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts --workers=1 && pnpm docs:check && git diff --check` |
| **Estimated runtime** | Unit/build task checks 15–120 seconds; aggregated Playwright task checks up to 5 minutes; full phase gate approximately 15 minutes |

---

## Sampling Rate

- **After every task commit:** Run that task's exact command from the Per-Task Verification Map.
- **After every plan wave:** Run the corresponding aggregate command from Wave Feedback Gates.
- **Before `$gsd-verify-work`:** The full phase command must be green.
- **Max task feedback latency:** 120 seconds for unit/build checks and 5 minutes for aggregated Playwright commands; each reload-heavy case sets `test.setTimeout(120000)`.
- **Max wave feedback latency:** 5 minutes for Wave 7 browser aggregation; other wave gates target 2 minutes.
- **No three consecutive tasks without automation:** Every task below has a runnable automated command.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 105-01-01 | 01 | 1 | PKG-01, PKG-02, PKG-04 | T-105-01-01, T-105-01-SC | Public peer/dev, JSR declarations, generated importers, and installed links move together | install + type | `pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm --filter @kehto/acl type-check && pnpm --filter @kehto/firewall type-check && pnpm --filter @kehto/runtime type-check && pnpm --filter @kehto/services type-check && pnpm --filter @kehto/shell type-check && pnpm --filter @kehto/paja type-check` | ✅ | ✅ green |
| 105-02-01 | 02 | 2 | PKG-03, PKG-04 | T-105-02-01 | Exact group-A app pins are installed and compile from lock checkpoint 2 | build | `pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm --filter @kehto/playground build && pnpm --filter @kehto/demo-feed build` | ✅ | ✅ green |
| 105-03-01 | 03 | 3 | PKG-03, PKG-04 | T-105-03-01 | Exact group-B/fixture pins are installed and compile from lock checkpoint 3 | build | `pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm --filter @kehto/demo-profile-viewer build && pnpm --filter @kehto/demo-resource-demo build` | ✅ | ✅ green |
| 105-04-01 | 04 | 4 | PKG-01, PKG-03, PKG-04 | T-105-04-01, T-105-04-SC | Dynamic manifests/JSR/lock, installed package versions, and released declarations match exact lineage | unit + install | `pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts` | ✅ | ✅ green |
| 105-04-02 | 04 | 4 | PKG-02 | T-105-04-02, T-105-04-03 | Host prelude is parent-bound, one-shot, synchronous, and replacement-resistant | unit + build | `pnpm exec vitest run tests/unit/published-napplet-contract.test.ts packages/shell/src/napplet-namespace.test.ts && pnpm --filter @kehto/shell build` | ✅ | ✅ green |
| 105-05-01 | 05 | 5 | PKG-01 | T-105-05-01, T-105-05-03 | Canonical types preserve accepted-result-before-start and attested sender | unit + type | `pnpm exec vitest run packages/services/src/intent-service.test.ts && pnpm --filter @kehto/services type-check` | ✅ | ✅ green |
| 105-05-02 | 05 | 5 | PKG-01 | T-105-05-02 | Resolver/catalog exact selection and negative shapes remain fail-closed | unit + build | `pnpm exec vitest run packages/services/src/intent-types.test.ts packages/services/src/catalog-intent-resolver.test.ts packages/services/src/manifest-intent-catalog.test.ts packages/services/src/manifest-intent-dispatch.test.ts && pnpm --filter @kehto/services build` | ✅ | ✅ green |
| 105-06-01 | 06 | 6 | PKG-01, ARCH-03 | T-105-06-01, T-105-06-03 | Paja catalog is verified-install-owned and retained delivery is exactly once | unit | `pnpm exec vitest run packages/paja/src/installed-napplet-catalog.test.ts packages/paja/src/browser-intent-controller.test.ts` | ✅ | ✅ green |
| 105-06-02 | 06 | 6 | PKG-01, ARCH-03 | T-105-06-02 | Paja default/chooser/explicit selection is exact and authorized | unit + type | `pnpm exec vitest run packages/paja/src/browser-adapter-intent.test.ts packages/paja/src/installed-napplet-catalog.test.ts packages/paja/src/browser-intent-controller.test.ts && pnpm --filter @kehto/paja type-check` | ✅ | ✅ green |
| 105-07-01 | 07 | 7 | PKG-01 | T-105-07-01, T-105-07-03 | Real registered ready generation releases one retained delivery after source close | unit | `pnpm exec vitest run packages/paja/src/browser-host.test.ts packages/paja/src/browser-runtime-tabs.test.ts packages/paja/src/browser-intent-controller.test.ts` | ✅ | ✅ green |
| 105-07-02 | 07 | 7 | THEME-04 | T-105-07-01, T-105-07-02 | Deterministic Paja intent/theme excludes forged sibling and live relays | e2e | `pnpm exec playwright test tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts --workers=1` | ✅ | ✅ green |
| 105-08-01 | 08 | 6 | PKG-01, ARCH-03 | T-105-08-01 | Playground verified install persists independently of frames | unit | `pnpm exec vitest run tests/unit/playground-installed-catalog.test.ts tests/unit/playground-intent-catalog.test.ts tests/unit/playground-shell-host-proxy.test.ts` | ✅ | ✅ green |
| 105-08-02 | 08 | 6 | PKG-01, ARCH-03 | T-105-08-02, T-105-08-03 | Selection/retention/ready/source teardown is exact and fail-closed | unit + type | `pnpm exec vitest run tests/unit/playground-intent-controller.test.ts tests/unit/playground-installed-catalog.test.ts tests/unit/playground-shell-host-proxy.test.ts && pnpm exec tsc -p apps/playground/tsconfig.json --noEmit` | ✅ | ✅ green |
| 105-09-01 | 09 | 7 | PKG-03, IDENTITY-05, ARCH-03 | T-105-09-02, T-105-09-03 | Published intent and resourceBytes use stale-safe revocable Blob URLs | unit + build | `pnpm exec vitest run tests/unit/profile-resource-media.test.ts && pnpm --filter @kehto/demo-feed build && pnpm --filter @kehto/demo-profile-viewer build && pnpm --filter @kehto/demo-resource-demo build` | ✅ | ✅ green |
| 105-09-02 | 09 | 7 | IDENTITY-05, THEME-04, ARCH-03 | T-105-09-01, T-105-09-02 | profile-open/identity-flow use accepted intent/onDelivery, no INC, safe media, and live theme | e2e | `pnpm exec playwright test tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts --workers=1` | ✅ | ✅ green |
| 105-10-01 | 10 | 8 | PKG-01, PKG-02, PKG-03, PKG-04 | T-105-10-01, T-105-10-02 | Static package/type/lineage/shell evidence covers exact active surfaces | static unit | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts` | ✅ | ✅ green |
| 105-10-02 | 10 | 8 | IDENTITY-05, THEME-04, ARCH-03 | T-105-10-01 | Static host evidence requires catalog/frame separation, no profile INC, media cleanup, and theme | static unit | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/profile-resource-media.test.ts tests/unit/playground-intent-controller.test.ts packages/paja/src/browser-intent-controller.test.ts` | ✅ | ✅ green |
| 105-11-01 | 11 | 9 | PKG-01, PKG-02, PKG-03, PKG-04 | T-105-11-01 | Active runtime/package docs match exact refs, ranges, and retained shell boundary | docs + static | `pnpm docs:check && pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts` | ✅ | ✅ green |
| 105-11-02 | 11 | 9 | PKG-04 | T-105-11-02 | Changeset covers all seven shipped manifest changes as 0.x breaking/minor | release metadata | `pnpm changeset status` | ✅ | ✅ green |
| 105-12-01 | 12 | 9 | PKG-02, IDENTITY-05, THEME-04, ARCH-03 | T-105-12-01, T-105-12-02 | Host docs match verified catalogs, retained delivery, safe media, theme, and host shell | docs + static | `pnpm docs:check && pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave Feedback Gates

| Wave | Plans | Aggregate Gate |
|------|-------|----------------|
| 1 | 01 | `pnpm --filter @kehto/acl type-check && pnpm --filter @kehto/firewall type-check && pnpm --filter @kehto/runtime type-check && pnpm --filter @kehto/services type-check && pnpm --filter @kehto/shell type-check && pnpm --filter @kehto/paja type-check` |
| 2 | 02 | `pnpm --filter @kehto/playground build && pnpm --filter @kehto/demo-feed build` |
| 3 | 03 | `pnpm --filter @kehto/demo-profile-viewer build && pnpm --filter @kehto/demo-resource-demo build` |
| 4 | 04 | `pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts packages/shell/src/napplet-namespace.test.ts` |
| 5 | 05 | `pnpm --filter @kehto/services build && pnpm --filter @kehto/services type-check && pnpm exec vitest run packages/services/src/intent-types.test.ts packages/services/src/intent-service.test.ts packages/services/src/catalog-intent-resolver.test.ts packages/services/src/manifest-intent-catalog.test.ts packages/services/src/manifest-intent-dispatch.test.ts` |
| 6 | 06, 08 | `pnpm exec vitest run packages/paja/src/installed-napplet-catalog.test.ts packages/paja/src/browser-intent-controller.test.ts packages/paja/src/browser-adapter-intent.test.ts tests/unit/playground-installed-catalog.test.ts tests/unit/playground-intent-controller.test.ts tests/unit/playground-intent-catalog.test.ts tests/unit/playground-shell-host-proxy.test.ts` |
| 7 | 07, 09 | `pnpm exec playwright test tests/e2e/paja-runtime-pointer.spec.ts tests/e2e/paja-single-window.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts --workers=1` |
| 8 | 10 | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts tests/unit/profile-resource-media.test.ts` |
| 9 | 11, 12 | `pnpm docs:check && pnpm changeset status && git diff --check` |

**Gate rule:** A failed task command blocks its commit. A failed wave gate blocks every dependent wave. The lock-overlap chain is strictly Plan 01 → 02 → 03 → 04; no parallel writer may touch `pnpm-lock.yaml`.

---

## Wave 0 Requirements

- [x] `tests/unit/napplet-package-alignment.test.ts` — dynamic PKG-04 manifest/JSR/lock guard.
- [x] `tests/unit/published-napplet-contract.test.ts` — PKG-01/02/03 exact released declarations and lineage.
- [x] `packages/paja/src/installed-napplet-catalog.test.ts` — verified catalog versus live-frame state.
- [x] `packages/paja/src/browser-intent-controller.test.ts` — retain/start/ready/exactly-once lifecycle.
- [x] `packages/paja/src/browser-adapter-intent.test.ts` — default/chooser/authorization integration.
- [x] `tests/unit/playground-installed-catalog.test.ts` — persistent verified playground installs.
- [x] `tests/unit/playground-intent-controller.test.ts` — playground retained target lifecycle.
- [x] `tests/unit/profile-resource-media.test.ts` — resourceBytes/object URL/stale/revocation vectors.
- [x] `tests/e2e/playground-profile-intent.spec.ts` — focused deterministic live profile flow.
- [x] `.changeset/phase-105-published-package-line.md` — release gate input for all seven changed packages.

Each owning plan creates its missing test/changeset before production changes in the same task. Existing Vitest/Playwright infrastructure requires no new dependency.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Audit 2026-07-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All seven Phase 105 requirements map to automated tests. The final repository
run passed 1,569 unit tests and 79 applicable Playwright tests; the sole skip is
the existing opt-in live-network pointer case and is not a phase requirement.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all formerly missing references
- [x] No watch-mode flags
- [x] Unit/build task feedback latency ≤ 120 seconds; aggregated Playwright and Wave 7 ≤ 5 minutes
- [x] Full phase command green
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-27
