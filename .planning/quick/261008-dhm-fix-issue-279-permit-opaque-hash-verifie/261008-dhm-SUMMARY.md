---
phase: quick-261008-dhm
plan: "01"
status: complete
subsystem: paja-resource
tags: [blossom, resource, mime, sha256, issue-279]
requires:
  - phase: existing-paja-resource
    provides: Capped Blossom resolution and adapter resource service
provides:
  - Blossom-only opaque byte delivery after capped reads and SHA-256 verification
  - Fetch and actual adapter single/bulk resource regressions
  - Synchronized policy documentation and Paja patch changeset
affects: [paja, resource-policy]
tech-stack:
  added: []
  patterns: [internal recognized/opaque/blocked byte classification]
key-files:
  created:
    - .changeset/paja-opaque-blossom-resources.md
  modified:
    - packages/paja/src/browser-resource.ts
    - packages/paja/src/browser-resource.test.ts
    - packages/paja/README.md
    - docs/packages/paja.md
    - docs/policies/SHELL-RESOURCE-POLICY.md
key-decisions:
  - Opaque fallback is Blossom-only and follows capped reads and matching SHA-256.
  - Recognized MIME remains byte-derived; blocked active prefixes cannot use opaque fallback.
  - Preserve existing serial bulk execution and installed server-hint wire projection.
requirements-completed: [ISSUE-279]
plan_head_before: bbbca6492263f32127ce0135e89043b8058416c4
actuals:
  tokens: 9488
  tasks: 3
  commits: 9
duration: approximately 54min elapsed including review gaps
completed: 2026-10-08
---

# Quick Task 261008-dhm: Opaque Blossom Resources Summary

**Capped, hash-verified opaque Blossom bytes now reach Paja resource callers unchanged as `application/octet-stream`, without broadening HTTP(S)/data policy.**

## Accomplishments

- Added an internal recognized/opaque/blocked classification. Recognized binary signatures, checksum-valid Game Boy ROM, JSON and UTF-8 text retain existing MIME. Upstream headers never determine delivery MIME.
- Blossom opaque fallback occurs only after `readCappedResponse` and successful SHA-256 verification. SVG, XML, HTML and script prefixes are inspected before strict UTF-8/NUL classification, including active documents with invalid-UTF-8 or NUL suffixes.
- Added 61 tests (74 Paja resource tests total) covering exact bytes, Blob type and MIME through the actual adapter; scheme isolation; misleading headers; matching-hash markup rejection; mismatch and later matching-server fallback; declared and streamed caps; correlated single errors; mixed ordered bulk siblings; and maxUrls+1 rejection. Existing cancellation and server-cap guards remain green.
- Resolved review blockers CR-01 and CR-02 with complete capped UTF-16LE/BE decoding using matching decoders before opaque classification, plus conservative rejection of identifiable UTF-32 document signatures. Actual-hash boundary and adapter bulk tests prove encoded SVG/XML/HTML/script rejection, including opening tags split across the former inspection cutoff, while opaque NUL-prefix and UTF-16 nonmarkup siblings retain exact octet-stream bytes.
- Updated all three specified docs and added a patch changeset for `@kehto/paja`. No public API, wire, server selection, resource.info, other-scheme policy, or concurrency changes.

## Specification Authority and Bounded Conformance

Before editing source, tests or docs, fetched and checked:

`https://raw.githubusercontent.com/napplet/naps/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md`

This is NAP-RESOURCE PR #80's pinned head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`. The same exact source was fetched and rechecked again before each CR-01 and CR-02 source/test/doc correction. The change preserves byte sniffing, scheme-specific MIME policy, Blossom hash verification, complete Blob results, ordered independent bulk items and the prohibition on raw SVG delivery. Unknown opaque binary is a bounded Kehto Blossom policy, not permission to bypass active-markup rejection; the encoding guard is bounded by the 10 MiB response cap, not a general XML parser or universal markup-security guarantee.

Full draft compliance is **not** claimed. Pre-existing installed `requests`/per-resource server-hint projection differs from the pinned draft's URLs-only wire; developer HTTP policy, browser DNS enforcement limitations, and SVG rejection rather than rasterization remain out of scope and unchanged.

## Atomic Commits

All commits are on `feat/paja-opaque-blossom-resources`, use explicit staged paths, and include `Co-Authored-By: GPT-6.1 Sol <noreply@openai.com>`.

| Task | Commit | Description |
| --- | --- | --- |
| 1 RED | `d66f8242` | `test(paja): reproduce opaque Blossom resource rejection` |
| 1 GREEN | `657547c9` | `fix(paja): permit capped hash-verified opaque Blossom bytes` |
| 2 | `7eac6658` | `test(paja): guard opaque resource integrity and scheme boundaries` |
| 2 strict-type correction | `bdcb38ad` | `test(paja): retain ArrayBuffer-backed ROM vector typing` |
| 3 | `6b099123` | `docs(paja): describe verified opaque Blossom resource policy` |
| CR-01 RED | `77e86729` | `test(paja): reproduce encoded markup opaque fallback bypass` |
| CR-01 GREEN | `8e2574af` | `fix(paja): block byte-identifiable encoded markup before opaque delivery` |
| CR-02 RED | `dfa4e456` | `test(paja): reproduce truncated UTF-16 markup boundary bypass` |
| CR-02 GREEN | `49bb1281` | `fix(paja): inspect complete capped UTF-16 resources for markup` |

Actual commit count is measured by `git rev-list --count bbbca6492263f32127ce0135e89043b8058416c4..HEAD` (9). Tokens are `ceil(realized git diff character count / 4)` (9488), not harness usage. Metrics include both review corrections.

## Verification

| Gate | Final result | Evidence |
| --- | --- | --- |
| Tracer before implementation | 2 expected failures, 13 passes | `/tmp/opencode/279-tracer-red.log` |
| Tracer after implementation | 15 passed | `/tmp/opencode/279-tracer-green.log` |
| CR-01 before implementation | 5 expected failures, 53 passes | `/tmp/opencode/279-cr01-red.log` |
| CR-02 before implementation | 9 expected failures, 65 passes | `/tmp/opencode/279-cr02-red.log` |
| Focused Paja + service regressions after CR-02 | 93 passed | `/tmp/opencode/279-cr02-focused.log` |
| `pnpm build` after final code edits | PASS | `/tmp/opencode/279-cr02-build.log` |
| `pnpm type-check` after final code edits | PASS | `/tmp/opencode/279-cr02-type-check.log` |
| `pnpm test:unit` after final code edits | 150 files, 1867 tests passed | `/tmp/opencode/279-cr02-unit.log` |
| `pnpm docs:check` after final code/doc edits | PASS | `/tmp/opencode/279-cr02-docs.log` |
| `pnpm test:e2e` with existing executable-path override after final code edits | 86 passed, 2.6 minutes | `/tmp/opencode/279-cr02-e2e.log` |
| `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` after final edits | 100/100, zero diagnostics/errors/warnings | `/tmp/opencode/279-cr02-final-slop.json` |
| `git diff --check` | PASS | Final working-tree check |

E2E final command:

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/robert/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome pnpm test:e2e`

## TDD Gate Compliance

Task 1 fetch and actual-adapter regressions were written and executed before implementation. The adapter assertion expected `resource.bytes.result` with octet-stream MIME but received `resource.bytes.error` (`decode-failed`). RED and GREEN were committed separately. No refactor was needed.

GSD's RED evidence checker accepts flat node-style TAP only; Vitest produces nested TAP without node summary counts. The initial raw record therefore returned `INVALID_RED`. The evidence record was then normalized from the actual Vitest leaf TAP rows (15 tests, 13 pass, 2 fail), retaining the unmodified transcript as `rawOutput`. `check tdd-red-evidence /tmp/opencode/279-tracer-red.json` returned `RED_EVIDENCE_OK` before source edits. The record documents this normalization.

Task 2 is regression-only expansion: the task-1 implementation and existing caps/services already satisfy the added behaviors. No additional production behavior was introduced and no artificial failing assertion was committed.

CR-01 RED ran before the encoding guard: all four encoded-markup boundary cases resolved successfully instead of rejecting, and the actual adapter bulk assertion received `ok: true` instead of `ok: false`/`decode-failed`. The existing 53 tests passed. The persisted `/tmp/opencode/279-cr01-red.json` retains raw Vitest TAP and normalizes leaf rows exactly as above; the GSD checker returned `RED_EVIDENCE_OK` before source edits. RED commit `77e86729` precedes GREEN `8e2574af`. The complete final focused suite has 62 Paja plus 19 service tests; all pass.

CR-02 RED ran before removing truncation: nine tests failed intentionally (eight boundary tests plus actual adapter bulk), with 65 passing. SVG after 508–510 spaces and analogous longer markers were successfully delivered instead of rejected. `/tmp/opencode/279-cr02-red.json` retains the raw transcript with the same documented leaf-TAP normalization; GSD returned `RED_EVIDENCE_OK`. RED `dfa4e456` precedes GREEN `49bb1281`. Final focused results supersede CR-01 counts: 74 Paja plus 19 service tests (93 passed).

## Review Blocker CR-01 Resolution

- **Finding:** BOM-prefixed UTF-16LE/BE SVG was misclassified as opaque and newly delivered. This was a genuine task-introduced bug against the pinned raw-SVG rule, not pre-existing server-hint drift.
- **Fix:** UTF-16 BOM or initial alternating `<` bytes select the matching UTF-16LE/BE decoder and reuse existing normalized blocked-prefix checks. The initial 1 KiB inspection was subsequently removed by CR-02; the complete capped buffer is now decoded. UTF-32 BOM and initial `<` document signatures are conservatively rejected before the overlapping UTF-16LE BOM check. No parser, dependency, wire or API change.
- **Boundary evidence:** Actual SHA-256 vectors exercise both endiannesses, BOM and initial-byte recognition, SVG, XML-prefixed SVG, HTML, doctype and script, including case and BOM-leading whitespace. Additional tests cover markup beyond the prefix inspection bound. UTF-16 nonmarkup still returns exact octet-stream bytes and remains rejected via HTTP(S)/data.
- **Adapter evidence:** One correlated mixed `bytesMany` result preserves exact order and length. After CR-02 expansion, all fourteen encoded-document items return `decode-failed` without Blob; six UTF-16 nonmarkup items (including long whitespace before plain text) and the NUL-prefix binary item succeed with exact bytes, Blob.type and MIME equal to `application/octet-stream`.
- **Scope:** This bounded encoding guard addresses CR-01 and the identical recognizable UTF-32 bypass; it does not claim general XML/markup parsing. Existing hash/cap/mismatch/recognized-MIME regressions remain green. Docs explicitly record conservative encoding policy.
- **State:** Original short vectors fixed in `8e2574af`; remaining truncation bypass corrected in `49bb1281`. REVIEW.md remains historical evidence for orchestrator re-review, not edited to self-approve.

## Review Blocker CR-02 Resolution

- **Finding:** A UTF-16 BOM plus 508–510 spaces put only a partial `<svg` token inside the former 1 KiB window. The whitespace-only fallback did not block these partial tokens, allowing raw SVG delivery.
- **Fix:** Removed the arbitrary inspection slice and whitespace-only truncation branch. The matching UTF-16 decoder now reads the complete already capped buffer, then applies `hasBlockedMarkupPrefix`, matching the full-buffer UTF-8 policy. The UTF-32 conservative guard is unchanged. This simplifies production code rather than adding partial-token logic.
- **Regression evidence:** Both endiannesses at 507, 508, 509, 510, 511, 600 and 4096 spaces are tested with actual SHA-256 for SVG, XML-prefixed SVG, HTML, doctype and script. Each returns `decode-failed`. Adapter bulk now includes all six SVG boundary vectors along with intact opaque/nonmarkup siblings; errors have no Blob and successes retain exact byte/MIME fidelity.
- **Docs:** Removed introduced 1 KiB and inconclusive-prefix policy claims in all three specified docs; documented complete decoding bounded by the existing response cap. No universal parser/security claims added.
- **Verification:** All full gates were rerun after the final code/doc edits, with 1867 unit tests, 86 E2E tests and AI-slop 100/100. CR-02 is fixed and verified in `49bb1281`; independent reviewer closeout remains with the orchestrator.

## Deviations and Resolved Issues

1. **Bulk completion-order assumption:** Existing `handleBytesMany` awaits each item serially. A test waiting for later items while the first was held could not complete. Replaced the impossible out-of-order premise with delayed-first-fetch proof, no early terminal result, exact serial completion order, exact item URL order/length, sibling success/error isolation, and one terminal result. Did not change service concurrency or scope.
2. **[Rule 1 - Bug] Strict fixture typing:** Full type-check exposed generic `Uint8Array<ArrayBufferLike>` from the pre-existing ROM helper in new Response fixtures. Narrowed its return annotation to its actual `Uint8Array<ArrayBuffer>` backing. Full type-check and unit gates then passed (`bdcb38ad`).
3. **[Rule 3 - Environment] Chromium path:** Initial E2E launch could not find `/usr/bin/chromium`. Used a verified existing cached executable through the already supported environment override; no install or configuration edit. The first cached-browser run hit the tool's 120-second timeout after 68 passes. Re-ran with a 600-second tool timeout; the entire 86-test suite passed.
4. **[Rule 1 - Bug] CR-01 encoded markup:** Added RED actual-hash boundary/bulk regressions and fixed the newly admitted UTF-16 SVG category with bounded encoding detection and conservative UTF-32 document rejection. All full gates rerun after final edits; seven total scoped commits.
5. **[Rule 1 - Bug] CR-02 truncated opening tags:** Added RED boundary/bulk regressions and replaced truncated UTF-16 inspection with complete capped decoding. Updated docs and reran every full gate; nine total scoped commits. No other policy or public contract changed.

No unresolved blocker, known stub, skipped test, unrun verification, or new unmodeled network/auth/schema surface remains. Existing build/localStorage warnings were not changed. AI-slop configuration was not weakened.

## Handoff

The approved existing baseline and branch were retained; no worktree or branch change. No push, PR, publication, STATE update, ROADMAP update, or planning-artifact commit was performed. The orchestrator owns planning metadata and shipping. Working tree contains only the untracked quick-task planning directory; all source, tests, docs and changeset changes are committed.

## Self-Check: PASSED

## Orchestrator Closeout

After the final reviewer call was interrupted, the orchestrator inspected complete capped UTF-16 decoding and boundary/bulk regressions directly and independently reran 93 focused tests (all passed). REVIEW now closes CR-01/CR-02; VERIFICATION is passed; L1 SECURITY verifies all five planned mitigations with zero open threats. Planning artifacts and STATE completion record are committed as the final quick-task checkpoint before shipping.

All six changed deliverable files and the SUMMARY exist. All nine listed commits resolve in the current branch history. Final post-CR-02 full gates and diff checks passed; commit count and diff-scale actuals were measured from the approved baseline.
