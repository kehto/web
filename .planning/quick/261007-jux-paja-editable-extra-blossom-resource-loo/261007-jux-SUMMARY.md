---
phase: quick-261007-jux
plan: "01"
quick_id: 261007-jux
status: complete
subsystem: paja
tags: [blossom, resource, host-settings, persistence, dev-ux]
requires:
  - phase: quick-261007-j7k
    provides: Paja local-file tabs on the approved feature branch
provides:
  - Atomic origin-scoped extra Blossom resource settings with live all-tab lookup
  - Settings, real adapter/service, and running-browser regression coverage
affects: [paja, resource-lookups]
tech-stack:
  added: []
  patterns: [private host-owned settings controller, shared live candidate getter]
key-files:
  created:
    - packages/paja/src/browser-resource-settings.ts
    - packages/paja/src/browser-resource-settings.test.ts
    - packages/paja/src/browser-resource-settings-integration.test.ts
    - .changeset/paja-extra-resource-servers.md
  modified:
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/host-page.ts
    - packages/paja/src/host-page.test.ts
    - tests/e2e/paja-runtime-pointer.spec.ts
    - packages/paja/README.md
    - docs/packages/paja.md
    - docs/how-tos/paja-local-authoring.md
key-decisions:
  - Keep extras private to the host; append after existing defaults through one shared live callback.
  - Reject whole invalid drafts before active or durable mutation; valid persistence failures remain session-only.
  - Retain existing packaged wire compatibility; no pointer, upload, CSP, config-schema or dependency changes.
requirements-completed: [QUICK-261007-jux]
actuals:
  tokens: 9828
  tasks: 3
  commits: 5
plan_head_before: d658481238e3950da19e61a428fa146133e571d7
commits: 5
completed: 2026-10-07
duration: 18min
---

# Quick 261007-jux Plan 01: Extra Blossom Resource Servers Summary

**A newline sidebar Save adds validated, persisted Blossom lookup origins to live resource requests across Paja runtime tabs without changing uploads or frame policy.**

## Accomplishments

- Both target modes render the same labeled textarea, keyboard-accessible Save, wrapping helper and polite inline feedback. Empty defaults and blank Save clear only extras.
- Bare domains/ports become HTTPS; ordered canonical dedup preserves first occurrence. Invalid mixed drafts preserve active and durable settings. URL-parser repairs, paths, credentials, queries/fragments and local/private literals are rejected with line numbers. Unknown stored JSON is revalidated; snapshots are immutable and feedback uses `textContent`.
- Restore precedes adapter creation. One live getter reaches all source windows through the existing Blossom resolver, appending extras after existing defaults. Save does not reload frames, reset events or alter window hints. Read/write/remove/access failures keep valid settings active session-only and warn that stale durable data can return.
- Real `createPajaAdapter`/resource-service tests verify SHA-256 fixture bytes and correlated Blob responses after request/window/pointer/upload-default candidates, across two source window IDs. Replace/clear, unchanged defaults, eight-server cap and direct HTTPS independence are exercised. Existing event/user-priority, hash, cancellation, redirect and CORS regressions remain green.
- Browser tests intercept public HTTPS fixture origins and prove real running-frame reads after Save/replace, invalid-save atomicity, durable reload, blank clear, session-only persistence, stable window IDs/generations/srcdoc/CSP and keyboard Save. No real remote resource server is used.
- Desktop 1280px and narrow 390px screenshots were inspected; textarea/helper/status fit and wrap without a modal. The existing narrow footer overflow is not changed by this task.
- README/package/how-to documentation and a separate Paja patch changeset are included. The previous `.changeset/paja-local-index-html.md` is byte-identical to the base.

## Atomic Commits

| Task/substep | Commit | Description |
| --- | --- | --- |
| 1 RED | `be43c8df` | Real adapter fallback assertion fails before the extra getter exists |
| 1 GREEN | `426c7efd` | Private settings controller, sidebar and shared live adapter wiring |
| 2 RED | `4038e6cc` | Validation/persistence and accessible markup coverage |
| 2 GREEN | `5011ff8f` | Strict drafts, storage/DOM lifecycle tests and actual browser fetches |
| 3 docs/release | `ecdc9f6e` | Policy documentation, adapter JSDoc and separate patch changeset |

All commits carry `Co-Authored-By: GPT-6.1 Sol <gpt-6.1-sol@openai.com>`. Five commits are measured from the persisted base ledger, not inferred. Planning metadata is left uncommitted for the orchestrator; no push, PR update, branch/worktree switch or ROADMAP modification was performed. No `.gitmodules` or project-local skills exist. `.gsd/dispatch-isolation-sentinel.json` remains untouched/uncommitted.

## NAP Specification Check

- Checked `napplet/naps`, `naps/NAP-RESOURCE.md`, pinned `9511232f69313aa7953d110e35d32cc28d506f66` and PR #80 head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` before source changes.
- Verdict: runtime-owned extra lookup configuration is compatible with the pinned request-before-defaults, ordered dedup/cap and hash-verification policy and the newer draft's runtime-owned fetching boundary.
- Recorded drift: the newer draft removes request `servers` and replaces bulk `requests` with `urls`. This feature intentionally does not migrate the existing packaged wire contract. Existing browser DNS-time private-resolution limitations remain; no claim of full NAP network conformance is made.

## Verification

All logs/screenshots are outside the repo under `/tmp/opencode/jux-*`.

| Gate | Latest result |
| --- | --- |
| Focused settings/resource/event/markup Vitest | PASS: 5 files, 66 tests |
| Focused Paja pointer Playwright | PASS: all 6 tests, including both settings persistence scenarios |
| `pnpm build` | PASS: 32/32 tasks |
| `pnpm type-check` | PASS: 17/17 tasks |
| `pnpm test:unit` | PASS: 154 files, 1,863 tests |
| `pnpm docs:check` | PASS: 9 public package docs, routes, TypeDoc and gate wiring |
| Full `pnpm test:e2e` | PASS: all 89 tests, 2.4 minutes, exit 0; unlimited-time full rerun completed |
| Cached aislop 0.16.1 scan | PASS: 100/100 after implementation iterations and final docs/commits; 0 errors, 2 file-size warnings, 461 files |
| `git diff --check d6584812 HEAD` and working-tree diff check | PASS |

Playwright commands use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` because the configured `/usr/bin/chromium` does not exist. Full suite is not replaced by focused tests.

## TDD Gate Compliance

- Both intended REDs were real assertion failures, not import/discovery errors: missing live fallback produced `resource.bytes.error`, and four invalid URL drafts were incorrectly accepted.
- The GSD checker only understands Node TAP summaries, not Vitest's nested TAP. External Node test probes ran the actual Vitest tests and asserted exit success; their intentional failures produced `RED_EVIDENCE_OK` for both gates. Records/logs are `/tmp/opencode/jux-red.json`, `jux-red2.json` and corresponding test logs.
- RED commits precede GREEN commits. The tracer verification was rerun end-to-end (14 tests passed) before expansion. No refactor step was needed.

## Deviations and Deferred Issues

- **Rule 1: strict input parsing.** Tests exposed URL-parser repairs (`https:host`, backslashes, path normalization, whitespace) and erased empty `?`/`#` delimiters. The new controller rejects these before delegating to the existing public-origin validator; the underlying transport validator was not changed.
- **Rule 1: integration fixture typing.** Replaced an incomplete cast fixture with the real `createPajaRuntimeHostConfig` constructor after type-check identified missing host fields.
- **Environment/TDD tooling:** existing Chrome override and Node TAP evidence probes were needed; no dependency was installed. The full-suite timeout was rerun with timeout disabled.
- **Pre-existing, deferred whole-host storage getter bug:** default `storage.mode: local` host startup can fail if the browser's entire `localStorage` getter throws, because `browser-relay-policy.ts:213` probes it outside `try`. This is unchanged from `d6584812`, outside this task's changed files, and recorded in `deferred-items.md`. New-controller unit tests cover blocked getters; browser tests block dedicated settings-key access/read/write/remove and prove session-only resource fetching. This report does not claim the unrelated whole-host startup bug is fixed.
- No implementation stubs, skipped tests, new threat surfaces outside the plan, simulation/config/CLI expansion, dependency/lock/version changes, or upload/pointer/CSP changes were introduced.

## Completion

All three planned tasks and all final gates are complete. Final full-suite log:
`/tmp/opencode/jux-full-test-e2e-complete.log`; final slop log:
`/tmp/opencode/jux-full-slop.log`. Existing file-size warnings are
`browser-host.ts` (772 lines) and `cvm-nostr-transport.ts` (1,201 lines);
no rules/config were disabled. The remaining pre-existing whole-host getter
issue above is explicitly outside the changed settings controller and remains
deferred, not represented as fixed.

## Self-Check: PASSED

All four created shipped files and the on-disk SUMMARY exist; all five listed
commit objects exist. Persisted base/count and diff hygiene were rechecked.
The prior local-file changeset is unchanged. Only orchestrator-owned planning
and existing harness metadata remain untracked.
