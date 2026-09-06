---
phase: 109-runnable-proof-and-drafting-evidence
plan: 03
subsystem: release-evidence
tags: [changesets, vitest, playwright, vitepress, aislop, shell-ipc]
requires:
  - phase: 109-01
    provides: Runnable public-ESM IPC process proof and lifecycle coverage.
  - phase: 109-02
    provides: Public experimental projection guidance and pinned drafting evidence.
provides:
  - Sole accurate minor Changeset for the complete experimental shell IPC projection.
  - Reproducible final package, repository, documentation, browser-regression, scanner, and boundary evidence.
affects: [release, shell-ipc, experimental-ipc-projection]
tech-stack:
  added: []
  patterns: [one-changeset-per-shipped-package, final-source-state-gate-matrix]
key-files:
  created: []
  modified:
    - .changeset/quiet-rice-queue.md
decisions:
  - "The one pending @kehto/shell-ipc Changeset remains a 0.x minor and describes the complete experimental projection rather than only transport egress."
  - "The POSIX process carrier receives the existing NIP-5D browser contract as a regression gate, not a new browser E2E surface."
metrics:
  duration: 3m
  completed_date: 2026-08-20
  tasks_completed: 2
  files_changed: 1
status: complete
---

# Phase 109 Plan 03: Release evidence Summary

**The experimental `@kehto/shell-ipc` projection now has one complete 0.x minor release intent and a final green release-evidence matrix.**

## Accomplishments

- Reconciled `.changeset/quiet-rice-queue.md` as the only pending `@kehto/shell-ipc` Changeset, retaining `minor` and covering bounded RFC 7464 transport, runtime-shell composition, exact readiness, targeted policy-checked delivery, raw-process proof, and experimental drafting evidence.
- Verified the built public ESM/declaration output and immutable package boundary: ESM `dist/index.js` plus `dist/index.d.ts`, Node `>=20`, `@napplet/core >=0.31.0 <0.32.0` peer range, and unchanged `@kehto/runtime: workspace:^` dependency.
- Ran the existing NIP-5D Playwright contract as the relevant browser regression; this POSIX/Node-only carrier adds no browser E2E source.
- Confirmed the phase remains outside runtime/browser-shell/E2E implementation, desktop carriers, remote/brokered topology, injected interfaces, and napplet helpers.

## Verification

All commands below ran against the final source state and exited 0.

- `pnpm --filter @kehto/shell-ipc build` — passed; produced ESM `dist/index.js` and declaration `dist/index.d.ts`.
- `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot` — passed: 3 files, 31 tests.
- `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `pnpm build` — passed: Turbo reported 33 successful build tasks.
- `pnpm type-check` — passed: Turbo reported 18 successful type-check tasks after the root build.
- `pnpm test:unit` — passed: 149 files and 1762 tests. Node emitted its existing localStorage experimental warnings only.
- `pnpm test:e2e -- tests/e2e/nip5d-contract-conformance.spec.ts` — passed: 1 Chromium test, including its required build. This is the unchanged web-projection regression selection.
- `pnpm docs:check` — passed: strict TypeDoc, VitePress, and the 10-package documentation audit. Existing Vite chunk-size warnings did not fail the gate.
- `npx --no-install aislop scan -d` — passed with exit 0 using local `aislop 0.14.1`; no policy changed. It reports two existing fixable narrative-comment warnings in Phase 107-owned `packages/shell-ipc/src/json-sequence.ts` (lines 3 and 5), not a Phase 109-owned file. The quality scan reports 97/100 with zero errors.
- `git diff --check` — passed.

## Static and Release Boundary Checks

- The exact single-Changeset guard passed: `.changeset/quiet-rice-queue.md` is the only pending Markdown file naming `@kehto/shell-ipc`, and its frontmatter is exactly `"@kehto/shell-ipc": minor`.
- Package metadata and output checks passed for the ESM export map, declaration entry, Node engine, core peer range, runtime workspace dependency, and emitted public files.
- The exact authority record is present in the package README, package page, and reference page: `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. Rechecked NAP-SHELL/NAP-INC at that object: bare `shell.ready`, exactly-one `shell.init`, lifecycle gating, and carrier-neutral authenticated endpoint binding are conformant; the authority defines no IPC carrier, so POSIX/RFC 7464 choices remain explicit experimental drafting evidence.
- `git diff --name-only 765989a..HEAD -- packages/runtime/src packages/shell/src tests/e2e` and the equivalent working-tree check both produced no output. The raw child and IPC implementation exclusion scans also passed; no Tauri/Electron, Windows, remote, broker, browser, injected-interface, or helper implementation is present.

## Task Commits

1. **Task 1: Reconcile the sole shell-ipc minor Changeset** — `8ab745e` (`chore(109-03): reconcile IPC projection changeset`)
2. **Task 2: Run and record the complete release-evidence gate matrix** — recorded by this summary commit.

## Deviations from Plan

None — the release note and all required gates completed without source corrections or retries. A first ad-hoc combined static-audit shell command had a quoting error before it evaluated any source gate; each intended static audit was then run individually and passed.

## Known Stubs

None. The projection's intentionally absent Windows, remote/broker, browser, injected-interface, reusable-client, and hostile-same-UID authentication capabilities are documented scope exclusions rather than stubs.

## Threat Flags

None. This plan changes release metadata only and creates no network, authentication, file-access, or schema surface.

## Preserved Working Tree State

The unrelated modified `package.json`, `.planning/config.json`, and untracked `.planning/debug/jsr-release-scope-auth.md` remained outside all Plan 109-03 commits.

## Self-Check: PASSED

- `.changeset/quiet-rice-queue.md` exists and Task 1 commit `8ab745e` exists.
- The final matrix passed with the exact commands and outcomes above.
