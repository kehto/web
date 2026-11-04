---
phase: 113-service-authorization-boundaries
plan: 07
subsystem: upload authorization
tags: [firewall, upload, blossom, paja, lifecycle]
dependency_graph:
  requires: [113-02]
  provides: [prepared-upload-approval, source-owned-upload-status]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [immutable-upload-plan, composed-resource-network-approval, abortable-transport]
key_files:
  modified:
    - packages/services/src/upload-service.ts
    - packages/services/src/http-uploader.ts
    - packages/paja/src/browser-upload.ts
decisions:
  - Upload plans select an exact HTTP endpoint and host-attested signing pubkey before approval, without signing or egress.
  - Public result URLs may use a separate CDN origin and do not grant napplet network access.
  - Upload cancellation is host-owned; no unsupported upload.cancel wire message is added.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 07: Upload Authorization Summary

Uploads now bind detached payload bytes, content digest, media metadata, selected HTTP endpoint, and signing identity to one resource-plus-network Firewall approval before Paja confirmation, signing, or byte egress.

## Delivered

- The service snapshots request bytes and metadata before planning, rejects replayed correlation IDs, and binds approval to an exact upload scope and selected network origin.
- The reference HTTP uploader prepares NIP-96 or Blossom endpoints without I/O, propagates approval cancellation through signing and fetch, uses manual redirects, and rejects responses from another endpoint.
- Paja chooses the first configured or warmed Blossom server before approval, verifies the same signer/server after asynchronous confirmation, and checks signed-event identity before fetch.
- Revocation and teardown abort active transport, suppress late progress/results, and retire window-owned status. Unknown upload IDs cannot reach the backend status hook or cross source windows.
- `FW-UPLOAD-LEGACY-001` warns once when the retained host-only path is used. Runtime-attached backends without a prepared plan fail closed. The migration is registered in `docs/compatibility.md` and has a services/Paja changeset.

## Protocol Authority

Rechecked NAP-UPLOAD draft PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67` before implementation. Canonical upload/info/status envelopes are preserved. Host cancellation and scoped approvals are additional shell policy, with no new napplet wire action. The draft permits a public result URL distinct from the approved egress server; such URLs are validated as HTTP(S) metadata only.

## Verification

- `pnpm exec vitest run packages/services/src/upload-service.test.ts packages/services/src/http-uploader.test.ts packages/paja/src/browser-upload.test.ts` — 57 tests passed.
- `pnpm --filter @kehto/services exec tsc --noEmit` and `pnpm --filter @kehto/paja exec tsc --noEmit` — passed.
- `pnpm --filter @kehto/services build` and `pnpm docs:check` — passed.
- Whole-phase build, unit, browser, and quality gates remain Phase 113 integration work.

## Self-Check: PASSED
