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

## REL-02 — attw (@arethetypeswrong/cli --profile esm-only)

**Command:** `pnpm dlx @arethetypeswrong/cli --profile esm-only --pack packages/<pkg>` for each of acl / runtime / shell / services
**Executed:** 2026-04-18T12:23:54Z
**Flag discretion (W1):** `--pack` included — attw runs `npm pack` on each directory and checks the packed tarball (mirrors real-publish semantics). D-04 only mandates `--profile esm-only`; `--pack` is Claude's-discretion choice for higher-fidelity rehearsal.

### @kehto/acl

```
@kehto/acl v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/acl"                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/runtime

```
@kehto/runtime v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/runtime"                       │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/shell

```
@kehto/shell v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/shell"                         │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### @kehto/services

```
@kehto/services v0.1.0

Build tools:
- typescript@^5.9.3
- tsup@^8.5.0

 (ignoring resolutions: 'node10', 'node16-cjs')

(ignored per resolution) ⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some bundlers. CommonJS consumers will need to use a dynamic import. https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/CJSResolvesToESM.md


┌───────────────────┬────────────────────────────────────────┐
│                   │ "@kehto/services"                      │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from ESM) │ 🟢 (ESM)                               │
├───────────────────┼────────────────────────────────────────┤
│ bundler           │ 🟢                                     │
├───────────────────┼────────────────────────────────────────┤
│ node10            │ (ignored) 🟢                           │
├───────────────────┼────────────────────────────────────────┤
│ node16 (from CJS) │ (ignored) ⚠️ ESM (dynamic import only) │
└───────────────────┴────────────────────────────────────────┘
```
Exit code: 0

### Combined for-loop verification

```
EXIT[acl]=0
EXIT[runtime]=0
EXIT[shell]=0
EXIT[services]=0
```

### Findings + Fixes

No findings — all 4 packages ESM-only clean on first pass. All three relevant resolutions are green:

- `node16 (from ESM)` 🟢 — Node 16 ESM consumers resolve the types + JS entry correctly.
- `bundler` 🟢 — Bundler-aware consumers (Vite, Webpack, Rollup, esbuild) resolve the exports map cleanly.
- `node10` (ignored) 🟢 — Legacy Node 10 resolution would also succeed, informational only (ignored by `--profile esm-only`).

The `node16 (from CJS)` row shows `(ignored) ⚠️ ESM (dynamic import only)` which is **expected and correct for an ESM-only package**: CommonJS consumers must use `await import()` rather than `require()`. The `--profile esm-only` switch explicitly suppresses this resolution because it is out-of-contract for ESM-only packages (the "ignoring resolutions: 'node10', 'node16-cjs'" line confirms the profile filter is active). Not a finding, not a fix — this is the by-design behavior.

No package.json modifications required.

### Post-attw publint regression spot-check

To confirm no regression (per acceptance criterion), re-ran publint on `@kehto/acl` after attw (spot re-check, 1 package suffices since no package.json changes were made):

```
Running publint v0.3.18 for @kehto/acl...
Packing files with `pnpm pack`...
Linting...
All good!
```
Exit code: 0 — no regression.

### REL-02 Status

**CLOSED — attw `--profile esm-only` clean on all 4 @kehto/* packages.**

---
