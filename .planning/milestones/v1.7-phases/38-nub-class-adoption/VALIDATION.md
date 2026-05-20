---
phase: 38-nub-class-adoption
validated_at: 2026-05-20
validator: gsd-nyquist-auditor (retroactive — v1.8 Phase 43)
status: passed
score: 5/5
---

# Phase 38: NUB-CLASS Adoption — Retroactive Validation

## Validation Source
Validated against `.planning/milestones/v1.7-ROADMAP.md` Phase 38 Success Criteria (canonical) plus shipped evidence in the working tree and per-plan SUMMARY.md files under `.planning/milestones/v1.7-phases/38-nub-class-adoption/`.

## Per-Criterion Verdicts

### Criterion 1: A class-restricted demo napplet attempting a NUB request outside its class posture is rejected at the `enforce.ts` gate regardless of which NUB domain issued the request (identity, ifc, keys, media, notify, relay, storage, theme — all covered in `class-invariant.spec.ts`).
- **Verdict:** PASS
- **Evidence:** `tests/e2e/class-invariant.spec.ts` defines `ACTIVE_NUB_DOMAINS` with all 8 v1.2 domains and parameterizes one test per domain via `for (const domain of ACTIVE_NUB_DOMAINS)`. Test asserts `class-forbidden` is observed in `__aclEvents__` (appears 8 times in spec). All 8 tests recorded GREEN in `38-ITERATION-LOG.md` 62/0/0 close. Cross-verified `38-VERIFICATION.md` Observable Truth #1.

### Criterion 2: `shell.init` carries the resolved class inline (no post-init `class.assigned` async envelope); the session entry is written before `shell.init` is sent.
- **Verdict:** PASS
- **Evidence:** `packages/shell/src/shell-bridge.ts:224` reads `sessionEntry?.class ?? null` and stamps it on `initMsg` synchronously before `postMessage`. `grep -c "class: resolvedClass" packages/shell/src/shell-bridge.ts` = 1. Anti-feature scan: `grep -rn "class.assigned" packages/ apps/ tests/` returns only 3 doc-comment occurrences (no envelope implementation). Cross-verified `v1.7-MILESTONE-AUDIT.md` Anti-feature Sweep ("Async `class.assigned` envelope (C-01): CLEAN").

### Criterion 3: `CLASS_BY_DTAG` data-driven map exists alongside `DEMO_NAPPLETS`; a CI assertion fails if a napplet is added to `DEMO_NAPPLETS` without a corresponding `CLASS_BY_DTAG` entry.
- **Verdict:** PASS
- **Evidence:** `apps/demo/src/shell-host.ts:235-261` declares `CLASS_BY_DTAG` adjacent to `DEMO_NAPPLETS`; block-scoped `throw new Error('[CLASS-04 / H-05]...')` guard fires at module load if any `DEMO_NAPPLETS` d-tag lacks a `CLASS_BY_DTAG` entry. Cross-verified `38-VERIFICATION.md` Required Artifacts ("All 10 DEMO_NAPPLETS mapped; assertion block present").

### Criterion 4: `docs/policies/SHELL-CLASS-POLICY.md` is present with kehto file:line cross-references into `enforce.ts`, `shell-bridge.ts`, and `shell-host.ts`.
- **Verdict:** PASS
- **Evidence:** `docs/policies/SHELL-CLASS-POLICY.md` exists on disk; header comment carries upstream SHA `27e16248`; 10 kehto file:line cross-references documented including 2 occurrences of `packages/runtime/src/enforce.ts`, plus `shell-bridge.ts`, `types.ts`, `shell-host.ts`, `main.ts`. Cross-verified `38-VERIFICATION.md` Required Artifacts table.

### Criterion 5: The class enforcement grep (`grep -rn 'class' packages/runtime/src/enforce.ts`) shows the gate is centralized in `enforce.ts` — not scattered across individual NUB handler files.
- **Verdict:** PASS
- **Evidence:** `class-forbidden` string appears in 4 places in `packages/runtime/src/enforce.ts` (gate body + 3 return paths) and once in `packages/runtime/src/types.ts` (type union for `AclCheckEvent.reason`). `grep -rn "class-forbidden" packages/runtime/src/ --include="*.ts"` filtered to exclude enforce.ts/types.ts returns empty — no leakage into `state-handler.ts`, `service-dispatch.ts`, or `runtime.ts` handler bodies. Cross-verified `38-VERIFICATION.md` Key Invariant Checks table.

## Summary
- Total criteria: 5
- PASS: 5
- FAIL: 0
- N/A: 0
- Overall: **passed** — class enforcement centralized correctly, sync class posture wired end-to-end, CI assertion guards data-driven map integrity, 62/0/0 E2E baseline established (+8 class-invariant tests).

## Notes
E2E-20 success criterion in this phase is the 8-domain portion; Phase 40 extends the same `class-invariant.spec.ts` to 10 domains (config + resource) for the full milestone-level E2E-20 close.
