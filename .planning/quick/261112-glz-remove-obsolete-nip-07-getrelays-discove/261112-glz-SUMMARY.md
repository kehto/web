---
phase: quick-261112-glz
plan: "01"
status: complete
subsystem: paja
tags: [nip07, relay-discovery, identity, blossom]
requires: []
provides: [host-only-bootstrap-discovery, obsolete-extension-retirement]
affects: [paja]
tech-stack:
  added: []
  patterns: [host-owned-discovery]
key-decisions:
  - Remove obsolete extension discovery entirely; do not cache it.
  - Preserve NAP identity.getRelays with empty unsupported external-user metadata.
  - Preserve general host and simulation relay APIs.
plan_head_before: b2d15ab68f60655b3d380fe9b28b7718fc85adb9
actuals:
  tokens: 7273
  tasks: 3
  commits: 5
duration: approximately 11 minutes
completed: 2026-11-12
key-files:
  created: [.changeset/paja-remove-obsolete-relay-discovery.md]
  modified:
    - packages/paja/src/browser-relay-runtime.ts
    - packages/paja/src/browser-adapter-support.ts
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/browser-host.test.ts
    - packages/paja/src/browser-adapter-signer-traffic.test.ts
    - packages/paja/src/browser-signers.ts
    - packages/paja/src/browser-signers.test.ts
    - packages/paja/src/browser-blossom-integration.test.ts
    - packages/paja/README.md
    - docs/packages/paja.md
    - docs/compatibility.md
---

# Quick 261112-glz: Remove obsolete NIP-07 relay discovery

Paja now bootstraps contact, NIP-65 and Blossom discovery exclusively from host configuration, without reading or invoking the obsolete extension property.

## Implementation

- Deleted signer discovery helper, optional signer loader arguments, lifecycle cache, refresh function, generation counter and bundle wiring.
- Made bootstrap selection synchronous while preserving host precedence and deduplication.
- Removed the NIP-07 adapter member and binding. Supported public-key, signing and NIP-04/NIP-44 operations remain covered.
- Retained the general NAP identity service and correlated `identity.getRelays.result` response, using an empty map for unsupported external-user metadata rather than fabricating user preferences from host URLs.
- Preserved Blossom destination approval, URL policy, cancellation, signed-event verification and author write-relay routing.
- Updated both Paja docs, compatibility retirement record and a Paja-only patch changeset.

## Specification check

- NIP-07: https://raw.githubusercontent.com/nostr-protocol/nips/master/07.md, checked 2026-11-12; no extension `getRelays` method.
- NAP-IDENTITY: `napplet/naps@43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab`, `naps/NAP-IDENTITY.md`; retains `identity.getRelays` and permits empty unsupported results.
- Result: conformant. No upstream ambiguity or publication blocker. No shared host protocol API removed.

## TDD evidence

- Task 1 RED: actual warming fixture invoked the throwing obsolete hook three times; expected zero. GREEN: 55 tests in three files passed, then passed again at the tracer feedback gate.
- Task 2 RED: adaptation read the throwing obsolete getter once; expected zero. GREEN: 19 tests in three files passed, including lifecycle/account changes, correlated identity responses, repeated Blossom requests and supported signing/encryption.
- Both RED records were accepted by `gsd-tools check tdd-red-evidence`. Vitest's nested TAP was normalized to leaf results/counts for the runtime's node:test-only parser; raw outputs are `/tmp/opencode/glz-task1-red.tap` and `/tmp/opencode/glz-task2-red.tap`.
- Separate RED/GREEN commits retained; no refactor-only commit needed.

## Verification

| Gate | Result |
| --- | --- |
| `pnpm build` | PASS, 18 tasks |
| `pnpm type-check` | PASS, 20 tasks |
| `pnpm test:unit` | PASS on parent's fresh run: 3,416 tests across 267 files; initial residue-related failure resolved as described below |
| `pnpm docs:check` | PASS, strict TypeDoc, VitePress and 11-package documentation audit |
| `npx --no-install aislop scan -d` | Unavailable unversioned package; pinned installed fallback below passed |
| `node /home/robert/.npm/_npx/dd92e33ad1a5e0d6/node_modules/aislop/dist/cli.js scan -d` | PASS, CI-pinned 0.12.0, 100/100, zero errors |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/robert/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome pnpm test:e2e` | FAIL, 131 passed / 1 failed / 1 pre-existing skipped in 2.2 minutes |
| Same browser override, `pnpm exec playwright test tests/e2e/paja-firewall-rules.spec.ts --grep 'opening a link asks once'` | FAIL, same empty popup URL assertion; isolated diagnostic, not a successful rerun |
| `git diff --check` | PASS |

Logs: `/tmp/opencode/glz-{build,types,unit,unit-clean,docs,slop,slop-pinned,e2e}.log`.

All three implementation tasks are complete with verification limitations. Parent reviewed the implementation and authorized completion tracking with the browser failure explicitly unresolved. This is not full shipment sign-off; parent will open a DRAFT PR because the browser gate fails.

## Commits

- `72a97f77` — Task 1 RED: reject extension discovery during actual warming.
- `c875efd9` — Task 1 GREEN: host-only discovery, deleted lifecycle cache, empty external-user identity metadata.
- `cd3ed588` — Task 2 RED: reject obsolete property reads during NIP-07 adaptation.
- `c5e3df72` — Task 2 GREEN: remove binding and verify lifecycle/resource/identity boundaries.
- `38989c0b` — Task 3 documentation, retirement register and Paja patch changeset.

All commits have the requested author trailer. Commit count is measured from the persisted base ledger before the final planning-only commit. Token actual is ceiling(realized code/docs/test diff characters / 4), not harness usage.

## Deviations and environment

- Corrected one stale source assertion from async to synchronous bootstrap selection during Task 1.
- `npx --no-install aislop scan -d` cannot resolve the unversioned package locally (requests absent 0.20.1); no install attempted. Used the existing cached CI-pinned 0.12.0 executable instead, with unchanged `.aislop/config.yml`: 100/100, zero errors, one pre-existing function-length warning in `browser-llm-panel.ts`.
- Browser verification uses existing Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; no browser installation.
- Parent reviewed implementation, resolved the local unit blocker and requested a planning-only completion commit. `.planning/STATE.md` records quick-task completion; `.planning/WINDOWS.md` entry 29 is fixed while entries 30–31 retain the browser failure and existing skip. No phase advance or unrelated requirement completion was claimed. Parent owns the DRAFT PR; no push or PR performed by this executor.

## Deferred issues

**Resolved unit blocker:** `tests/unit/retired-playground-redirect.test.ts:64` expects `apps/playground` not to exist. Parent confirmed no tracked files existed there and preserved the entire retired directory at `/tmp/opencode/kehto-retired-playground-261112-glz`. The original path is now absent. Parent's fresh `pnpm test:unit` exited 0 with 3,416 tests passing across 267 files; verified `/tmp/opencode/glz-unit-clean.log`. No implementation changes or test weakening were needed.

`tests/e2e/paja-firewall-rules.spec.ts:121` reads `popup.url()` immediately after the popup event and receives `""` rather than a URL containing `example.com/docs`. Reproduced in the full suite and one isolated diagnostic (`/tmp/opencode/glz-e2e-diagnostic.log`). The test and external-link implementation were not changed; its fixture does not install a signer or use relay discovery. Root cause was not proven against a separate baseline checkout, so this remains an explicit browser verification failure, not a waived flaky test. No unrelated fix attempted.

The one skipped browser test is the pre-existing `test.fixme` at `tests/e2e/paja-identity.spec.ts:116`: loaded-napplet `identity.changed` delivery across connect/disconnect without frame reinitialization. This task's unit-level lifecycle and correlated relay-response proofs do not claim to fix that separate host reload behavior.

## Known stubs

None introduced. The empty external-user relay map is an intentional, documented NAP-IDENTITY unsupported-result policy, not an unfinished metadata resolver.

## Threat review

No new network endpoints, file access or authentication surfaces. Removed the extension discovery boundary. Existing resource authorization and event verification remain intact.

## Self-Check: PASSED

Verified the changeset and summary exist, all five listed commits resolve, requested author trailers are present, and `git diff --check` passes. This validates the artifact/commit claims, not the failed shipment gates. Only planning files remain dirty; no code changes are uncommitted.
