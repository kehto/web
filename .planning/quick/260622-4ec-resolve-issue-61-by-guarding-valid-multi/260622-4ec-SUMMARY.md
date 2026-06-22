---
quick_id: 260622-4ec
status: complete
date: 2026-06-22
commit: ac262e7
---

# Quick Task 260622-4ec Summary

## Result

Issue #61 is covered by a runtime regression guard. A single init-time
`outbox.subscribe` envelope carrying more filters than `DEFAULT_BURST_MAX_OPS`
is accepted and delivered to the outbox service as one request, while more than
`DEFAULT_BURST_MAX_OPS` separate subscribe envelopes still trip the generic
startup burst guard.

## Changed Files

- `packages/runtime/src/outbox-dispatch.test.ts`

## Verification

- `pnpm exec vitest run packages/runtime/src/outbox-dispatch.test.ts`
- `pnpm type-check`
- `pnpm build`
- `pnpm test:unit`
- `pnpm docs:check`

## Remaining Risk

This task intentionally adds coverage only. The current runtime already counts
startup burst cost by envelope, so no firewall behavior change was needed.
