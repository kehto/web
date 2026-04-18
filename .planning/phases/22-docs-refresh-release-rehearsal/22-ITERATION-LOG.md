# Phase 22 Iteration Log — Docs Refresh & Release Rehearsal

**Phase:** 22-docs-refresh-release-rehearsal
**Requirements covered:** DOCS-01..03, REL-01..04, E2E-10, E2E-11 (closed here)
**Cross-cutting gate:** E2E-11 (build → run → Playwright → fix loop)
**Started:** 2026-04-18T12:21:58Z

---

## REL-01 — publint

**Command:** `pnpm dlx publint packages/<pkg>` for each of acl / runtime / shell / services
**Executed:** 2026-04-18T12:22:38Z
**Tool version:** publint v0.3.18

### @kehto/acl

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/runtime

```
Running publint v0.3.18 for @kehto/runtime...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/shell

```
Running publint v0.3.18 for @kehto/shell...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### @kehto/services

```
Running publint v0.3.18 for @kehto/services...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0

### Combined for-loop verification

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[acl]=0
Running publint v0.3.18 for @kehto/runtime...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[runtime]=0
Running publint v0.3.18 for @kehto/shell...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[shell]=0
Running publint v0.3.18 for @kehto/services...
Packing files with `pnpm pack`...
Linting...
All good!
EXIT[services]=0
```

### Findings + Fixes

No findings — all 4 packages clean on first pass. Each @kehto/* package.json already conforms to the canonical ESM-only shape documented in the plan (`type: module`, `exports` map with `types` before `import`, `files: ["dist"]`, `sideEffects: false`, `publishConfig.access: public`, `repository` + `keywords` present). No package.json modifications required.

### REL-01 Status

**CLOSED — publint clean on all 4 @kehto/* packages.**

---
