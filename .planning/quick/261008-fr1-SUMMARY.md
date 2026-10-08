---
phase: quick-261008-fr1
plan: "01"
subsystem: paja
tags: [blossom, resource, compatibility, integrity]
requires: []
provides:
  - Dual-prefix Paja resource fetching through one verified transport path
affects: [paja]
tech-stack:
  added: []
  patterns: [Shared strict hash parser and unchanged verified Blossom fetch path]
key-files:
  created: [.changeset/paja-blossom-prefix-compat.md]
  modified:
    - packages/paja/src/browser-resource.ts
    - packages/paja/src/browser-resource.test.ts
    - packages/paja/src/browser-blossom-integration.test.ts
    - packages/paja/README.md
    - docs/packages/paja.md
key-decisions:
  - Accept blossom:<hash> and describe blossom:sha256:<hash> as a compatibility alias without new upstream protocol claims.
  - Leave event resolver, other runtimes, versions, and generated changelogs unchanged.
requirements-completed: []
plan_head_before: bbbca6492263f32127ce0135e89043b8058416c4
actuals:
  tokens: 4350
  tasks: 3
  commits: 2
duration: 5min
completed: 2026-10-08
status: complete
---

# Quick Task 261008-fr1: Paja Blossom Prefix Compatibility Summary

**Paja accepts `blossom:<hash>` and the `blossom:sha256:<hash>` compatibility alias through the same SHA-256-verified resource fetch path.**

## Accomplishments

- Made only the `sha256:` segment optional in the strict, case-insensitive, 64-hex-character parser; retained lowercase transport normalization and original URL/window forwarding to discovery.
- Parameterized focused fetch/security cases and adapter/event integration. Tests cover real-byte hashes, mixed-case normalization, MIME sniffing, wrong-hash and SVG rejection, declared/streamed byte caps, request-hint policy and count limits, credential/referrer omission, redirect refusal, cancellation, and not-found/network-error outcomes. Malformed lengths, nonhex, unsupported labels, suffixes, queries, and fragments fail before discovery/network hooks.
- Synced the two active Paja docs and added one `@kehto/paja` patch changeset. No event resolver, other runtime, dependency, package version, or generated changelog changes.

## Commits

- `b5eab9c0` — `test(paja): reproduce Blossom prefix parity through resource service` (TDD RED).
- `03fa4977` — `fix(paja): accept both Blossom resource prefixes` (implementation, parity tests, both docs, changeset atomically).

Both commits include `Co-Authored-By: GPT-6.1 Sol <noreply@openai.com>`. Commit count measured with `git rev-list --count bbbca649..HEAD`: 2. Actual tokens are realized committed diff characters divided by four, rounded up (17,397 / 4).

## Verification Results

| Gate | Result |
| --- | --- |
| `pnpm test:unit packages/paja/src/browser-resource.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-blossom-events.test.ts` | PASS — 34 tests across 3 files; repeated after final test edit. |
| `pnpm build` | PASS — 32 tasks. |
| `pnpm type-check` | PASS — 17 type-check tasks, including Paja. |
| `pnpm test:unit` | PASS on final run — 1,818 tests across 150 files. Initial run had one introduced static-guard failure from changing a test-name marker; restored that marker and reran successfully. |
| `pnpm docs:check` | PASS — strict TypeDoc, VitePress build, and 9-package docs audit. Existing non-blocking bundle-size warning remains. |
| `pnpm test:e2e tests/e2e/paja-single-window.spec.ts tests/e2e/paja-runtime-pointer.spec.ts` | Initial run blocked by pre-existing environment configuration: `/usr/bin/chromium` absent (4 launch failures, 9 did not run). No application assertions executed. |
| Same e2e command with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/robert/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` | PASS — all 13 tests, 1 worker, 14.4 seconds. Used existing installed browser and existing override; no installs or config edits. |
| `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` | PASS twice — 100/100, zero errors/warnings/findings. Pinned config unchanged. |
| `git diff --check` | PASS. |

Detailed logs: `/tmp/opencode/fr1-{focused-final,build,types,unit-final,docs,e2e,e2e-override,slop-final}.log`.

## TDD Gate Compliance

The new `blossom:` adapter case intentionally failed before implementation: expected correlated `resource.bytes.result` with `text/plain` bytes, received `resource.bytes.error` (`invalid-request`). The compatibility-alias case passed. RED committed before GREEN. `check tdd-red-evidence /tmp/opencode/fr1-red.json` returned `RED_EVIDENCE_OK`.

The evidence checker expects Node TAP summary comments, which Vitest omits. Initial TAP evidence was classified `INVALID_RED`; reran with `tap-flat` and appended summary counts derived directly from its real `ok`/`not ok` lines (14 tests, 13 pass, 1 fail). The target assertion then validated. No production edits preceded successful evidence validation. No refactor needed.

## Decisions and Deviations

- Applied the parent/user correction to the plan's terminology: neither docs nor source call `blossom:<hash>` a nonconformant shorthand exception or call the alias canonical. Both forms are described neutrally; no new upstream conformance claim.
- AGENTS-required read-only reference review checked the existing linked `napplet/naps` draft `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md`, particularly runtime-owned fetch and hash/MIME/transport policy. The merged master path returned 404. This scoped Paja behavior is not presented as an upstream protocol change or conformance certification; unchanged historical draft guidance remains outside this edit.
- [Rule 1 — Bug] Restored the integration test-name substring required by the existing NIP-5D static guard; fixed in `03fa4977`, full unit suite now green.
- Used the existing browser executable override to complete e2e validation without changing repository configuration.

No known stubs, unresolved defects, skipped final tests, authentication gates, or new security-relevant endpoints/trust boundaries were introduced.

## Parent Handoff

Implementation and all final gates are complete. Parent owns STATE/ROADMAP updates, planning-artifact commits, push, and PR creation. No planning artifacts were committed; no STATE/ROADMAP changes, push, PR, or publication were performed. This is a verified implementation handoff, not a claim that the change is shipped.

## Self-Check: PASSED

All six shipped files and the summary exist; both commit objects exist. Measured commit count is 2. STATE, ROADMAP, and pinned slop configuration are unchanged. Only the parent's uncommitted quick plan and this summary remain untracked.
