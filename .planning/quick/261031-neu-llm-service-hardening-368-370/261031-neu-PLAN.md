---
quick_id: 261031-neu
slug: llm-service-hardening-368-370
issues: [368, 369, 370]
branch: fix/368-370-llm-service-hardening
spec: napplet/naps#134 NAP-LLM draft head 3e10939cf788878bbdcc022c101f0ac6193f316c
status: complete
---

# Quick Task 261031-neu: NAP-LLM service hardening (#368, #369, #370)

## Spec facts (NAP-LLM @ 3e10939)
- Runtime limits are policy and MUST fail explicitly; `selection-expired` covers unknown/revoked/changed handles.
- No release message exists for handles, so refusing selects at a cap would lock a napplet out.
- Cancellation during consent MUST prevent submission; selection change during consent requires fresh selection + consent.
- Deltas optional; when sent: zero-based, ordered, no gaps, none after terminal result; terminal text is authoritative.

## Tasks
1. #368 `maxHandlesPerWindow` (default 32), LRU eviction (successful revalidation refreshes); an evicted handle
   answers `selection-expired`; a generation awaiting consent on an evicted/invalidated handle fails `selection-expired` immediately.
2. #369 optional trailing `{ signal }` for `LlmConnectionHost.select` / `authorize`; aborted only when the request settles
   without the host's answer (cancel, deadline, revoke, destroy, unregister, invalidation/eviction). Pending selects
   answer immediately on invalidation (`selection-expired`) or revoke (`cancelled`). Paja: chooser, consent (`signal` on
   confirmation requests withdraws queued/active dialog) and unlock prompts honor it.
3. #370 opt-in streaming: `buildLlmProviderRequest(endpoint, request, { stream })` (OpenAI/Anthropic `stream: true`,
   OpenAI `stream_options.include_usage`, Gemini `streamGenerateContent?alt=sse`), per-dialect SSE accumulators,
   `createHttpLlmProvider({ stream: true })` with `onDelta` 4th arg resolving the same `LlmGeneration`; `LlmFetch`
   gains optional `body`/`headers`. Paja opts in and forwards `hooks.onDelta`.
4. Tests for each, docs (`docs/llm.md`, services README), changesets (services, paja), gates, PR.
