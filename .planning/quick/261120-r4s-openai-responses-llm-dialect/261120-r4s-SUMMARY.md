---
status: complete
---

# OpenAI Responses dialect (kehto/web#414)

Implemented on `feat/414-openai-responses-dialect`.

- `@kehto/services`: `LlmProviderProtocol` gains `openai-responses`; new `llm-provider-responses.ts` (request builder, buffered parser, stream accumulator) wired into `buildLlmProviderRequest`, `parseLlmProviderResponse` and `createLlmStreamAccumulator`; `LlmProviderEndpoint.responses` (`LlmResponsesOptions`: `profile`, `reasoningSummary`, `toolNamespace`); an `openai-responses` preset; `createHttpLlmProvider` reads the event stream for endpoints that only stream.
- `@kehto/paja`: the stored-connection protocol allowlist accepts `openai-responses`, so the new preset can be saved.
- Docs: `docs/llm.md` (dialect section, mapping table column, sign-in profile), services README and package doc, Paja README. Changeset: services and Paja minor.
- No compatibility path was introduced; nothing was renamed or removed.

## Verification

- `pnpm build`: 18/18 tasks. `pnpm type-check`: 20/20 tasks.
- `pnpm test:unit`: 275 files, 3,519 tests, all pass (27 new in `llm-provider-responses.test.ts`, plus additions to the stream, preset and Paja connection tests).
- `pnpm docs:check`: pass (strict TypeDoc and package docs audit).
- `npx playwright test tests/e2e/paja-llm.spec.ts --project chromium --workers=1 --trace off`: 7 passed.
- `npx aislop@0.12.0 ci`: 99/100, the same two function-length warnings main already carries in unchanged `browser-llm-panel.ts` and `cvm-service-handler.ts`; no finding in a changed file.

## Contracts and limits

NAP-LLM draft PR #134 head rechecked before shipment: `5e93bdfce0e84c0de728234cb7b3feed498f8635`. Conformant: host-side adapter only, no napplet-facing wire change.

Not exercised against the live API. Unverified and therefore refused or left off: named tool choice and tool history without tools under the sign-in profile, images in assistant history, and whether reasoning models continue a tool turn without encrypted reasoning items (`requiresOpaqueReasoning` stays opt-in). Paja has no sign-in flow.
