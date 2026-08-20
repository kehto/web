---
quick_id: 260819-hwm
status: complete
completed: 2026-08-19
code_commit: b966aef
docs_commit: 7dec9c6
---

# Quick Task 260819-hwm Summary

Paja now accepts canonical `blossom:sha256:<hex>` NAP-RESOURCE requests whenever a usable host-owned Blossom server is available. It resolves through ordered runtime-pointer, explicit upload, or already-warmed discovery settings; permits HTTPS and explicit loopback HTTP transport; refuses redirects; streams through the 10 MiB cap; verifies SHA-256; and derives MIME from inspected bytes.

Direct `http:` and `https:` resource URLs remain disabled. They are not equivalent to the runtime-selected transport behind a logical `blossom:` identifier.

## Protocol authority

Checked `napplet/naps` NAP-RESOURCE draft PR #80 at exact commit `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`. The implemented URL form, hash verification, error mapping, MIME handling, size cap, and truthful `resource.info` disclosure conform to that draft's Blossom contract.

## Verification

- `pnpm build` — passed
- `pnpm type-check` — passed
- `pnpm test:unit` — 142 files, 1,681 tests passed
- `pnpm test:e2e` — 81 tests passed
- `pnpm docs:check` — passed
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` — 100/100, zero findings
