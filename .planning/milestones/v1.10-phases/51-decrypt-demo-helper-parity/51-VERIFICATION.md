---
phase: 51-decrypt-demo-helper-parity
verified_at: 2026-05-22T13:04:00+02:00
status: passed
score: 3/3
---

# Phase 51 — Decrypt Demo Helper Parity — Verification

## Goal Restatement

Bring `decrypt-demo` onto the same published `0.3.0` helper surface as the v1.9 migrated demos by using `identityDecrypt` and removing the local raw-envelope request/reply shim.

## Per-Criterion Verdicts

### DECRYPT-DEMO-01: Exact 0.3.0 package graph

**Verdict:** PASS

**Evidence:** `apps/playground/napplets/decrypt-demo/package.json` declares exact `@napplet/nub: 0.3.0`, `@napplet/shim: 0.3.0`, and `@napplet/vite-plugin: 0.3.0`. `pnpm install` updated `pnpm-lock.yaml`, and the lockfile no longer contains old `@napplet/*@0.2.1` helper package entries.

### DECRYPT-DEMO-02: Helper migration

**Verdict:** PASS

**Evidence:** `decrypt-demo` imports `identityDecrypt` from `@napplet/nub/identity/sdk`. The local request ID counter, pending map, raw `identity.decrypt` postMessage request, and raw result/error response handler were removed.

### DECRYPT-DEMO-03: DOM sentinel behavior preserved

**Verdict:** PASS

**Evidence:** `pnpm test:e2e -- tests/e2e/decrypt-demo.spec.ts` passed. The spec verified all three happy-path mode sentinels (`ok:nip04:fixture-nip04`, `ok:nip44:fixture-nip44`, `ok:nip17:fixture-nip17`) plus the class-2 `error:class-forbidden` sentinel.

## Validation Commands

- `pnpm install` -> exit 0.
- `pnpm --filter @kehto/demo-decrypt-demo build` -> exit 0.
- `pnpm test:e2e -- tests/e2e/decrypt-demo.spec.ts` -> exit 0; 1 passed.
- `rg "@napplet/(shim|vite-plugin|nub)@0\\.2\\.1|@napplet/nub-[a-z]+@0\\.2\\.1|@napplet/core@0\\.2\\.1" pnpm-lock.yaml` -> no matches.

## Final Verdict

**VERIFICATION PASSED** (3/3). Phase 51 is complete. Phase 52 is next.
