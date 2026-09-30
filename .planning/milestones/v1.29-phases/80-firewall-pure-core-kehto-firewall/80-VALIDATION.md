---
phase: 80
slug: firewall-pure-core-kehto-firewall
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (root; add `@kehto/firewall` path alias) |
| **Quick run command** | `pnpm --filter @kehto/firewall test` |
| **Full suite command** | `pnpm test:unit` |
| **Estimated runtime** | ~15 seconds (package); ~60s full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @kehto/firewall test`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Filled by the planner / executor as tasks are defined. Each phase-80 requirement maps to pure-core unit tests with injected `now`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | CORE-01..04 | — | pure evaluate/config, no I/O | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | RATE-01..03 | — | token-bucket exceed-action | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | BURST-01..02 | — | init-burst block default | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CONTENT-01..03 | — | matcher (kind 5, size, focus) | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | POLICY-03 | — | precedence first-match-wins | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | FOCUS-02 | — | unfocusedMultiplier tightening | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | VERIFY-01 | — | refill/burst/matcher/precedence/serialize | unit | `pnpm --filter @kehto/firewall test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/firewall/vitest` infrastructure inherited from root `vitest.config.ts` (add `@kehto/firewall` alias).
- [ ] No new framework install — vitest already present repo-wide.

*Existing vitest infrastructure covers all phase requirements once the package alias is registered.*

---

## Manual-Only Verifications

*All phase-80 behaviors have automated verification — the pure core is fully deterministic with injected `now`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
