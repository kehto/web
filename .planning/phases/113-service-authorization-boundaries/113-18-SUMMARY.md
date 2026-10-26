---
phase: 113-service-authorization-boundaries
plan: 18
subsystem: documentation-release-verification
tags: [compatibility, changesets, regression, protocol]
dependency_graph:
  requires: [113-17, 113-19]
  provides: [phase-113-full-gate]
  affects: [runtime, services, shell, paja, playground]
status: complete
---

# Phase 113 Plan 18: service boundary closeout

The published service contracts and host consumers now use Firewall approval requirements and independent rate limits. Package docs, READMEs, the central compatibility register, and changesets describe the shipped behavior and bounded legacy paths. Paja's identity service keeps a stable read-only signer facade per connected or simulated account so asynchronous results are delivered without crossing an account switch. The playground reports the canonical `unsupported-scheme` resource item for its deliberately unsupported data URI route. A duplicate theme broadcast was removed and its static guard was updated.

The validated source head is `0036de8df2efa84e994a93cbaf14f5e7da4e8ba9`. Phase 114 launch admission, approval UI, grant management, and browser CSP isolation remain outstanding, as does Phase 115 shipment.

## Verification

- `pnpm build` and `pnpm type-check` passed.
- `pnpm test:unit` passed: 201 files and 2,578 tests.
- `pnpm test:e2e` passed: 126 browser tests, including Paja fixed/NIP-07 identity, resource errors, and single theme delivery.
- `pnpm docs:check`, `pnpm changeset status`, and `git diff --check` passed.
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json .` scored 100/100. `npx --yes aislop@0.12.0 scan -d` exited zero with score 97/100 and four pre-existing size/length warnings in Paja browser host/intent builder and shell intent URI code. No AI-slop, security, format, or lint findings were reported.

## Protocol authority

At closeout, GitHub still reported NAP-RESOURCE PR #80 head `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, NIP-5D PR #2303 head `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, and `napplet/naps` master `19de5ce1cea40cd4c76089cdd8126e9f87648049`. The individual service summaries record the other exact NAP refs. The resource unsupported-scheme response and optional NAP-SHELL behavior conform to these checked contracts. Browser launch/network policy remains an explicit Phase 114 host decision where the current drafts leave an enforceable CSP mechanism unspecified.
