---
quick_id: 260819-hwm
status: complete
description: Add canonical Blossom scheme support to Paja NAP-RESOURCE with hash verification
---

# Quick Task 260819-hwm Plan

Implement Paja support for canonical `blossom:sha256:<hex>` NAP-RESOURCE requests against host-configured Blossom servers, while retaining Paja's existing `data:` handling and fail-closed behavior for arbitrary network schemes.

Canonical authority: `napplet/naps` NAP-RESOURCE draft PR #80, commit `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`.

## Task 1: Add the policy-bound Blossom fetch adapter

- Extend Paja's resource backend to parse only canonical Blossom SHA-256 identifiers.
- Resolve hashes through normalized, host-configured HTTPS servers (and explicit loopback HTTP development servers).
- Reject redirects, enforce the 10 MiB cap, classify MIME from returned bytes, and return `decode-failed` on hash mismatch.
- Keep `http:` and `https:` resource URLs disabled; they remain transport details behind `blossom:`.
- Reuse configured runtime-pointer, upload, and discovered Blossom server hints where available.

## Task 2: Wire truthful runtime disclosure and regression tests

- Advertise `blossom` only when at least one usable server is configured.
- Cover data compatibility, canonical parsing, HTTPS and loopback-HTTP server transport, server fallback, response status mapping, size/MIME enforcement, hash mismatch, cancellation, and adapter-level NAP wire results.

## Task 3: Synchronize docs and release metadata

- Update Paja documentation and the NAP-RESOURCE policy record with the new supported scheme and exact draft ref.
- Add a Paja changeset.
- Run focused tests, then the repository build, type-check, unit, docs, and AI-slop gates before committing and opening a PR.
