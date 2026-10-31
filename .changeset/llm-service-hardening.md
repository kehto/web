---
'@kehto/services': minor
'@kehto/paja': minor
---

Harden the NAP-LLM service and add streaming providers (kehto/web#368, #369, #370):

- `createLlmService` bounds live model handles per window with `maxHandlesPerWindow` (default 32). Selecting beyond the bound evicts the least recently used handle, which then answers `selection-expired`; a successful `describe` or generation refreshes a handle.
- `LlmConnectionHost.select` and `authorize` receive an optional trailing `{ signal }` (`LlmPromptOptions`). It aborts when the request settles without the host's answer (cancel, deadline, handle invalidation or eviction, revocation, window destruction or unregistration), so hosts can close stale chooser and consent prompts. A pending selection answers `selection-expired` on invalidation and `cancelled` on revocation.
- `buildLlmProviderRequest(endpoint, request, { stream: true })` and `createHttpLlmProvider({ stream: true })` use each dialect's server-sent-event form. The provider forwards text fragments through a new optional `onDelta` argument and resolves the same generation as the buffered path. `LlmFetch` responses may expose `body` and `headers` (`LlmFetchResponse`), and `readLlmSseData` / `createLlmStreamAccumulator` are exported for custom transports.
- Paja streams provider output as `llm.delta`, and closes its chooser, consent and vault-unlock prompts when the request dies. `PajaConfirmationRequest` accepts an optional `signal` that withdraws a queued or open confirmation.
