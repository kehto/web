---
quick_id: 261031-neu
status: complete
issues: [368, 369, 370]
spec: napplet/naps#134 @ 3e10939cf788878bbdcc022c101f0ac6193f316c (open draft, unchanged)
---

# Summary: 261031-neu — NAP-LLM service hardening

- #368: `maxHandlesPerWindow` (default 32), LRU eviction refreshed by successful revalidation; evicted handle →
  `selection-expired`; a consent-pending generation on an evicted/invalidated handle fails at once and its prompt aborts.
  Eviction (not `quota-exceeded`) chosen because NAP-LLM has no handle-release message.
- #369: optional `{ signal }` (`LlmPromptOptions`) for `select`/`authorize`, aborted only when the service settles
  without the host's answer. Pending selects answer `selection-expired` on invalidation, `cancelled` on revoke.
  Paja forwards it to chooser, configure/consent confirmations (new `PajaConfirmationRequest.signal`) and vault unlock.
- #370: `buildLlmProviderRequest(..., { stream })`, `createHttpLlmProvider({ stream: true })` with `onDelta`,
  per-dialect SSE accumulators sharing buffered finish/usage mapping; `readLlmSseData`/`createLlmStreamAccumulator`
  exported. Paja streams by default.
- Tests: service (4 new, fail on old code), stream provider (real event shapes, chunk splits incl. CRLF/UTF-8,
  errors, abort, JSON fallback), Paja host/controller, Paja e2e (SSE → ordered deltas; napplet cancel closes consent).
- Gates: build, type-check, test:unit 2470, docs:check, Paja e2e 69/69 chromium, aislop 95 (baseline rows only).
