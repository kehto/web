---
phase: quick-260711-r4p
verified: 2026-07-11T18:40:15Z
status: passed
score: 10/10 must-have truths verified
re_verification: true
---

# Quick Task 260711-r4p Verification

**Goal:** Implement usable NAP-UPLOAD in Kehto Paja using Hyprgate's Blossom backend as guidance.

**Verdict:** `passed`. The implementation, local gates, pushed branch, clean pre-verification worktree, and open PR are verified against current local and GitHub state.

## Authority checked

- Protocol: `/home/sandwich/Develop/naps`, commit `a7cc17463cbf5d9cb87884b31071bc4fc826034c`, `naps/NAP-UPLOAD.md` from `origin/nap-upload`.
- Guidance: Hyprgate `apps/shell/src/lib/services/upload-blossom.ts` and `apps/shell/src/lib/blossom/blossom-servers.ts`.
- Implementation: actual `origin/main...d4c7da3` source diff; delivery head `cda8b6d0d323ea56de67cf03aa2d888234a500c4` adds only GSD evidence/state artifacts and does not change source. No reliance on the quick-task summary.

The pinned NAP requires shell-owned server selection, consent/policy enforcement, shell-constructed Blossom authorization, exact integrity reporting, advisory `upload.info`, and no false `complete` result. The implementation satisfies those protocol obligations locally.

## Must-have truths

| # | Truth | Status | Current-state evidence |
|---|---|---|---|
| 1 | Exact bytes reach a shell-selected Blossom server; `complete` requires server-confirmed local SHA-256 and exact non-negative safe-integer size | VERIFIED | `packages/services/src/http-uploader.ts:243-308` performs the PUT and rejects missing/mismatched hash or invalid/mismatched size. `tests/e2e/paja-single-window.spec.ts:316-344` proves the exact non-empty byte vector, URL, hash, size, MIME, NIP-94 tags, valid signature, kind 24242, `t`, `x`, and expiration. The missing-size negative case is at lines 354-359. |
| 2 | The napplet cannot select a server or bypass rail, size, MIME, disclosure, or consent policy | VERIFIED | `packages/paja/src/browser-upload.ts:114-145` applies rail/size/MIME checks, reads only the host-selected effective server, and obtains upload-specific consent before constructing the transport. Unit regressions verify policy rejection occurs before consent/sign/fetch. |
| 3 | Explicit servers win; otherwise upload reads an independently warmed, signer-scoped newest kind-10063 cache; info/upload do not discover | VERIFIED | `packages/paja/src/browser-upload.ts:64-111` is the only warm path; lines 207-228 preserve explicit priority, newest-event selection, ordered tags, normalization, and signer scoping. Upload and info paths at lines 114-188 only read snapshots. The cache-only test confirms one warm query and no additional query from info/upload. |
| 4 | Configured/provider/getPublicKey/discovery/signed-event pubkeys are coherent or fail closed | VERIFIED | `packages/paja/src/browser-upload.ts:71-110` reconciles configured, provider, signer, and discovery author; lines 150-155 reject a returned signed event with a different pubkey. Tests cover configured/provider, NIP-07/NIP-46-labelled provider/signer, signed-event, signer-change invalidation, and fixed-pubkey-only failures with zero downstream egress. |
| 5 | Blossom authorization uses an active writable Dev, NIP-07, or NIP-46 signer and kind 24242; fixed-only identity cannot upload | VERIFIED | `packages/paja/src/browser-adapter.ts:272-319` supplies writable active signers without fabricating signing for fixed identity. `http-uploader.ts:246-268` constructs kind 24242 and performs the authenticated PUT. Unit and E2E tests prove fixed-only failure and cryptographically valid Dev authorization. |
| 6 | `upload.info` is advisory, network-free, and truthfully reports HTTPS or permitted loopback HTTP plus configured limits | VERIFIED | `packages/paja/src/browser-upload.ts:175-188` is synchronous snapshot-only introspection. `packages/paja/src/simulation.ts:369-400` accepts HTTPS and only localhost, 127/8, or ::1 HTTP while rejecting credentials/query/fragment. Unit and browser evidence prove `returns: ['https']` and `returns: ['http']`, max bytes, MIME policy, and no server request. |
| 7 | Memory remains the explicit deterministic default; Blossom is opt-in through config/CLI | VERIFIED | `packages/paja/src/simulation.ts:223-228,277-322` defaults to memory and normalizes Blossom options. CLI accepts `--upload-mode blossom` and repeatable `--upload-server`; config merge tests prove CLI replacement. Docs explicitly call memory a simulator that stores nothing. |
| 8 | Browser E2E proves stored bytes, signed authorization, consent denial without PUT, and incomplete proof without false success | VERIFIED | `tests/e2e/paja-single-window.spec.ts:256-365` and the in-process CORS Blossom server at lines 615-684. Fresh targeted run: 5/5 passed. |
| 9 | No dependency is added; Kehto reuses `createHttpUploader`; Hyprgate is behavioral guidance | VERIFIED | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml packages/*/package.json` is empty. `packages/paja/src/browser-upload.ts:147-161` delegates to `@kehto/services` `createHttpUploader`. Hyprgate comparison confirms the same rail rejection, signer requirement, progress/cancel, authorization, NIP-94, and separately warmed server-list shape without importing or copying its Blossom SDK. |
| 10 | Fully gated, three atomic Lore checkpoints pushed, and an open PR cites the pinned draft | VERIFIED | Pre-verification `git status --short --branch` was clean and tracking `origin/feat/paja-blossom-upload`. Local HEAD, fetched remote ref, `git ls-remote`, and PR #191 `headRefOid` all equal `cda8b6d0d323ea56de67cf03aa2d888234a500c4`. PR #191 is OPEN at `https://github.com/kehto/web/pull/191`; its body cites the exact pinned draft, states conformance, records Hyprgate guidance and no copied code/new dependency, lists verification, and explicitly defers mirroring/failover/BUD-10. |

## Required artifacts

| Artifact | Status | Evidence |
|---|---|---|
| `packages/services/src/http-uploader.ts` | VERIFIED | `createHttpUploader` registers an `AbortController` before byte conversion/digest (`:120-126`), passes its signal to PUT, emits uploading status, validates descriptor hash and size, and returns NIP-94 output. |
| `packages/paja/src/browser-upload.ts` | VERIFIED | Contains the Paja-owned policy, identity snapshot, BUD-03 warm/cache boundary, consent gate, `createHttpUploader` link, URL-policy validation, and truthful info provider. |
| `packages/paja/src/simulation.ts` | VERIFIED | Contains `memory | blossom | disabled`, ordered normalized server policy, discovery/maxBytes/MIME configuration, and memory default. |
| `packages/paja/src/cli.ts` | VERIFIED | Contains `--upload-mode blossom`, repeatable `--upload-server`, help text, and mode-specific summary; parser/config/summary tests pass. |
| `tests/e2e/paja-single-window.spec.ts` | VERIFIED | Contains the real CORS-capable server, exact body capture, authorization decode/signature check, kind `24242`, positive proof, consent denial, and missing-size failure. |
| `.changeset/paja-blossom-upload.md` | VERIFIED | Exactly `@kehto/paja: minor` and `@kehto/services: patch`; no unrelated package bump. |

## Key links

| From | To | Status | Evidence |
|---|---|---|---|
| Paja upload runtime | `createHttpUploader` | WIRED | `packages/paja/src/browser-upload.ts:147-161`, after policy, snapshot, server, and consent checks. |
| Host/signer lifecycle | kind-10063 discovery | WIRED | `browser-upload.ts:64-111`; called at adapter startup and via signer subscription at lines 194-202, never from info/upload. |
| Adapter services/capability | one upload runtime | WIRED | `packages/paja/src/browser-adapter.ts:488-560` creates one runtime; `createDevServices` wires its uploader/info into `createUploadService`, and `ShellAdapter.upload` reads its backend. |
| Active signer | kind-24242 transport | WIRED | `browser-upload.ts:150-155` wraps the active signer and validates returned pubkey; `http-uploader.ts:246-268` constructs auth and sends bytes. |
| Browser fixture | Paja upload runtime | WIRED | `tests/e2e/paja-single-window.spec.ts:256-365,615-684` records actual PUT bytes/headers and returns the descriptor asserted through `upload.upload.result`. |
| Pinned NAP-UPLOAD draft | implementation/docs | WIRED | Plan and Paja docs cite the exact `a7cc17463cbf5d9cb87884b31071bc4fc826034c` URL and describe the implemented conformance boundary. |

## Cancellation and race evidence

- `createHttpUploader` puts the controller in `inFlight` before `toBytes()` or digest can yield (`http-uploader.ts:120-126`), so teardown cancellation is not lost during Blob conversion or hashing.
- `cancel()` aborts the fetch signal (`:143-145`) and the catch path returns structured `status: 'cancelled', error: 'user cancelled'` (`:133-136,321-323`).
- Focused regressions include in-flight abort and the pre-hash teardown race (`packages/services/src/http-uploader.test.ts:275-329`).
- Paja records its delegate in `activeUploads` before awaiting transport (`browser-upload.ts:159-168`), so `createUploadService.onWindowDestroyed()` can reach the transport cancellation hook.

## Fresh verification commands

All implementation commands ran against source head `d4c7da3a80969d1120a25ae18afa3f52875997a0`, after the last source change. Delivery head `cda8b6d0d323ea56de67cf03aa2d888234a500c4` changes only `.planning` evidence/state files.

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/services/src/http-uploader.test.ts packages/paja/src/browser-upload.test.ts` | PASS — 2 files, 31 tests |
| `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` | PASS — 5 tests |
| `pnpm build` | PASS — 32/32 tasks |
| `pnpm type-check` | PASS — 17/17 tasks |
| `pnpm test:unit` | PASS — 103 files, 1,353 tests |
| `pnpm test:e2e` | PASS — 72 tests |
| `pnpm docs:check` | PASS — TypeDoc strict, VitePress build, and audit-docs |
| `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` | PASS — 100/100, no issues |
| `git diff --check origin/main...HEAD` | PASS — no whitespace errors |

The three implementation checkpoints are atomic and Lore-formatted:

- `b56c530` — services transport and integrity hardening (2 files)
- `3d31859` — Paja policy/config/signer/consent wiring (11 files)
- `d4c7da3` — stored-byte E2E, docs, and changeset (8 files)

Each records constraints, rejected alternatives, confidence, scope risk, directives, tested/not-tested evidence, and co-author trailer. The final current-state scan independently verifies 100/100; the historical per-checkpoint scans are recorded in their `Tested:` trailers.

## Delivery re-verification

- `git status --short --branch` before this verifier output: clean, `feat/paja-blossom-upload...origin/feat/paja-blossom-upload`.
- Local HEAD: `cda8b6d0d323ea56de67cf03aa2d888234a500c4`.
- Fetched `origin/feat/paja-blossom-upload`: `cda8b6d0d323ea56de67cf03aa2d888234a500c4`.
- `git ls-remote --heads origin feat/paja-blossom-upload`: the same SHA.
- PR readback: #191, OPEN, head `feat/paja-blossom-upload`, head OID the same SHA, base `main`, URL `https://github.com/kehto/web/pull/191`.
- PR body contains the exact `a7cc17463cbf5d9cb87884b31071bc4fc826034c` authority link and conformance result; Hyprgate guidance/no copied code/no new dependency; local gate results; and explicit mirroring, failover, and BUD-10 deferral.
- At re-verification time, Detect CI Scope, Changeset Guard, and Detect Playwright Scope were successful; Build & Type-Check and Vitest were still in progress. Those live checks are not used as substitutes for the fresh full local gates above, and the repository's task stop condition is an open PR after those local gates pass.

No implementation or delivery gap remains.
