---
"@kehto/services": minor
---

Add the NAP-LLM reference service (napplet/naps PR #134 at `3e10939`): `createLlmService({ host })` with endpoint-scoped handles, schema and capability checks, consent before submission, duplicate-id rejection, cancellation and deadline races, ordered deltas and safe typed errors behind a `LlmConnectionHost` seam. Also exports the mirrored NAP-LLM types, `LlmServiceError`, pure request/response mappers for the OpenAI Chat Completions, Anthropic Messages and Google Gemini dialects, `createHttpLlmProvider()` and `LLM_PROVIDER_PRESETS`.
