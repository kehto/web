# Plan 82-01 Summary: Changeset + Whole-Repo & E2E Green Closeout

**Phase:** 82 - Verification & Closeout
**Plan:** 82-01
**Requirements:** VERIFY-03
**Completed:** 2026-06-15

## What was done

1. **Changeset staged** — `.changeset/v1-18-napplet-firewall.md`: `@kehto/firewall` minor (new package) + `@kehto/runtime` minor (additive integration). Body documents the new package, the runtime integration, and explicitly notes the `ConsentRequest` public-API change (new `firewall-policy` variant; `event` now optional).

2. **Whole-repo verification — all green:**
   - `pnpm type-check` → 13/13 tasks successful, exit 0 (repo-wide, FULL TURBO cache).
   - `pnpm test:unit` → **840/840 passed** (57 files). Baseline entering v1.18 was 819; +9 firewall-state container tests (81-01) +12 firewall integration tests (81-03). Phase 80's 87 pure-core tests are within this total.
   - `pnpm test:e2e` → **86/86 Playwright specs passed** on a clean full run (2.2m).

## Deviations / notes

- **E2E flake observed once, not a regression.** The first full E2E run reported 1 failed / 85 passed: `tests/e2e/nub-config.spec.ts` timed out on `waitForSelector('#config-demo-frame-container iframe', { timeout: 10_000 })` under full-suite parallel load. Re-running that spec in isolation passed in 8.5s, and a clean full-suite re-run passed 86/86. Root cause is the spec's tight 10s selector timeout under parallel contention — pre-existing E2E timing fragility in this repo (cf. the documented need for `test.setTimeout(120s)` on reload-heavy specs and the decrypt-demo fixture backlog), NOT firewall-caused. The firewall adds only O(1) per-message work and cannot push iframe-visible latency past 10s; the config-demo flow exercises the live runtime `handleMessage` gate and dispatches normally under the flag-by-default posture. No firewall tuning was needed.

## Verification

- `pnpm type-check && pnpm test:unit` → exit 0, 840/840.
- `npx playwright test` (full suite, clean run) → 86 passed.
