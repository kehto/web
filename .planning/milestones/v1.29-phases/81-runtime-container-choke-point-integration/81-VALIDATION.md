---
phase: 81
slug: runtime-container-choke-point-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (root, shared) |
| **Quick run command** | `npx vitest run packages/runtime` |
| **Full suite command** | `pnpm test:unit` |
| **Estimated runtime** | ~5s (runtime package); ~60s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/runtime`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd:verify-work`:** Full suite must be green (no regressions vs 819 baseline)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Filled by the planner / executor as tasks are defined. Phase-81 requirements are validated by runtime integration tests driving `handleMessage`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | RUNTIME-02 | — | optional hooks; existing hosts unaffected | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RUNTIME-03 | — | config persists, counters ephemeral | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RUNTIME-01 | T-81 | reject drops + errors back to napplet | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RUNTIME-04 | — | flag dispatches + emits audit | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | POLICY-01 | — | per-napplet policy overrides rules | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | POLICY-02 | T-81 | ask → reject + consent fired + remembered | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | FOCUS-01 | — | focus from hook, never napplet-reported | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | VERIFY-02 | — | named-attack integration suite | unit | `npx vitest run packages/runtime` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `@kehto/firewall: workspace:*` to `packages/runtime/package.json` + `pnpm install` (research: task zero — nothing imports until present).
- [ ] vitest infrastructure already present repo-wide (shared root config) — no new framework.

*Existing vitest infrastructure covers all phase requirements once the workspace dependency is added.*

---

## Manual-Only Verifications

*All phase-81 behaviors have automated verification — `handleMessage` is driven synchronously in-process; the consent flow is asserted via a spy `ConsentHandler`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (firewall workspace dep)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
