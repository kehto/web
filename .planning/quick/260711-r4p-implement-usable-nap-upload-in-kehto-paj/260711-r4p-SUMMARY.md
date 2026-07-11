---
quick: 260711-r4p
status: complete
branch: feat/paja-blossom-upload
spec: napplet/naps a7cc17463cbf5d9cb87884b31071bc4fc826034c
---

# Usable NAP-UPLOAD in Paja

## Behavior delivered

- Preserved Paja `memory` uploads as the default, explicitly named simulator.
- Added opt-in `blossom` mode through JSON config and repeatable
  `--upload-server` CLI flags.
- Restricted server policy to HTTPS plus loopback HTTP, with ordered
  normalization, explicit-server priority, and truthful `upload.info.returns`.
- Added independently warmed, signer-keyed BUD-03 kind `10063` discovery.
  Upload and info requests read snapshots only and do not trigger relay or
  signer discovery.
- Reconciled configured, provider, signer, discovery-author, and signed-event
  pubkeys. Read-only fixed identities and every mismatch fail closed.
- Added upload-specific consent containing napplet identity, filename, size,
  MIME type, selected server, and a public/durable warning before authorization
  signing or storage egress.
- Reused `createHttpUploader` without a new dependency. Blossom uploads emit
  progress, carry cancellation signals, sign kind `24242`, and send exact bytes
  to the first shell-selected server.
- Required server-confirmed URL, exact local SHA-256, and exact non-negative
  safe-integer size before reporting `complete`; successful results include
  NIP-94 URL/MIME/hash/size tags.
- Added a browser-to-Paja-to-loopback-Blossom proof covering CORS preflight,
  valid authorization signature/tags, byte-for-byte storage, disclosure denial
  with no PUT, and a missing-size response that cannot become success.
- Documented memory versus Blossom behavior, signer/server policy, discovery,
  CORS, integrity, and the deferred mirroring/failover/BUD-10 scope. Added an
  `@kehto/paja` minor and `@kehto/services` patch changeset.

## Files

- Services transport: `packages/services/src/http-uploader.ts` and its test.
- Paja runtime: `packages/paja/src/browser-upload.ts`, adapter, signer, host,
  simulation, CLI, and related tests.
- Browser proof: `tests/e2e/paja-single-window.spec.ts`.
- Docs: Paja README, Paja/CLI package pages, getting-started/local-authoring
  guides, and the stale shell manifest version row required by `docs:check`.
- Release metadata: `.changeset/paja-blossom-upload.md`.

## Commits

- `b56c530cd59609d9f89ad15d274b9d3ef326538f` — services integrity,
  progress, and cancellation checkpoint.
- `3d31859aa2b6d206cc65575eb2dd1ef2dd838d26` — Paja authority, policy,
  discovery, signer, consent, and CLI checkpoint.
- `d4c7da3a80969d1120a25ae18afa3f52875997a0` — stored-byte E2E, docs,
  and changeset checkpoint.

## Verification

- Focused services Vitest: 1 file, 19 tests passed.
- `@kehto/services` type-check and build: passed.
- Focused Paja package: 12 files, 75 tests passed; type-check and build passed.
- Targeted Paja Playwright: 5 tests passed with one worker.
- Full build: 32 Turbo tasks passed.
- Full type-check: passed.
- Full unit suite: 103 files, 1,353 tests passed.
- Full Playwright suite: 72 tests passed with one worker.
- `pnpm docs:check`: passed; nine public package pages audited.
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`: 100/100.
- `git diff --check`: passed.
- Three implementation commits contain Conventional Commit intent lines, Lore
  trailers, verification evidence, and the required Codex co-author trailer.

## Deviations and remaining risks

- `packages/paja/src/host-page.test.ts` changed because the runtime summary now
  explicitly labels memory uploads as a simulator.
- `docs/packages/shell.md` was one patch version stale on the starting branch;
  `docs:check` required `0.17.2`, so the Task 3 docs checkpoint corrected it.
- Production third-party Blossom CORS behavior was not exercised. The test uses
  an in-process CORS-capable loopback server.
- Multi-server mirroring, failover, and BUD-10 URLs remain intentionally out of
  scope. Paja uploads to the first effective server and returns its direct URL.
- Push and PR creation were intentionally left to the leader per execution
  assignment; the local implementation and all requested gates are complete.
