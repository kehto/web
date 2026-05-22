---
phase: 47-sdk-0-3-package-graph-ifc-storage-migration
verified_at: 2026-05-22
status: passed
score: 4/4
---

# Phase 47 — SDK 0.3 Package Graph + IFC/Storage Migration — Verification

## Goal Restatement

Establish the `@napplet/sdk@0.3.0` package graph for the 18 scoped demo/fixture packages and migrate the high-fanout IFC/storage namespace call sites first.

## Per-Criterion Verdicts

### SDK-01: Exact SDK 0.3.0 across 18 manifests

**Verdict:** PASS

**Evidence:** Manifest scan of the 12 playground demos plus 6 fixtures returned `@napplet/sdk` as exact `0.3.0` for all 18 target packages.

### SDK-02: Companion packages aligned

**Verdict:** PASS

**Evidence:** The same manifest scan returned exact `0.3.0` for each target package's `@napplet/shim` and `@napplet/vite-plugin`. Each target also now declares exact `@napplet/nub: 0.3.0` for direct helper subpath imports.

### FUNC-01: IFC migration

**Verdict:** PASS

**Evidence:** Bot, chat, and `nub-ifc` import `ifcEmit` / `ifcOn` from `@napplet/nub/ifc/sdk`. Grep for `ipc` identifiers in those files returns no matches.

### FUNC-02: Storage migration

**Verdict:** PASS

**Evidence:** Bot, chat, preferences, `nub-storage`, and `nub-theme` import storage helpers from `@napplet/nub/storage/sdk`. Grep for `storage.*` helper calls and `import { storage }` returns no code matches; remaining `storage.setItem` / `storage.getItem` strings are wire-envelope assertions in comments.

## Validation Commands

- `pnpm install` → exit 0; lockfile regenerated.
- `pnpm --filter @kehto/demo-bot --filter @kehto/demo-chat --filter @kehto/demo-preferences --filter @kehto/fixture-nub-ifc --filter @kehto/fixture-nub-storage --filter @kehto/fixture-nub-theme build` → exit 0; 6/6 target builds passed.

## Final Verdict

**VERIFICATION PASSED** (4/4). Phase 47 is complete. Phase 48 is next.
