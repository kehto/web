---
status: complete
---
# NAP-LLM across the kehto stack

Implemented draft NAP-LLM end to end on `feat/nap-llm`. Authority: napplet/naps PR #134
(`nap-llm`) at `3e10939cf788878bbdcc022c101f0ac6193f316c`. The published
`@napplet/nap@0.32.0` has no `llm` subpath, so `@kehto/services` mirrors the upstream
napplet `feat/nap-llm` draft types (`6e5c9fa9`); recorded as upstream drift to replace
with `@napplet/nap/llm/types` when it ships. Conformant for every checked surface; no
semantic contradiction found in the draft.

Delivered: `llm:generate` ACL capability and map; runtime `llm` dispatch with shaped
`unsupported` results for missing-service and ACL denial; `@kehto/services`
`createLlmService` (handles, consent gate, duplicate ids, cancel/timeout races,
ordered deltas, safe errors) behind an `LlmConnectionHost` seam, pure mappers for the
OpenAI Chat Completions, Anthropic Messages and Gemini dialects, `createHttpLlmProvider`
and `LLM_PROVIDER_PRESETS`; shell `llm` advertisement, `ShellAdapter.llm`,
`getShellDomainState` (`supported | unconfigured | disabled`) and the
`window.napplet.llm` prelude; Paja Language models panel, AES-GCM/PBKDF2 credential
vault with a session-only tier, chooser, configure prompt, per-generation consent and
the yellow `⚠ llm` unconfigured toggle; playground echo host; docs (`docs/llm.md`,
package docs, READMEs, conformance policy row, how-to) and five minor changesets.

Decision: advertisement stays binary on the wire; the third state is host-facing and
`llm.select` prompts to configure, answering `unsupported` until a connection exists.
Consent is asked per generation and never remembered.

Validation: `pnpm build`, `pnpm type-check`, `pnpm docs:check` pass; full units
190 files / 2452 tests pass (new: ACL map, runtime dispatch, 13 service conformance
cases LLM-C01..C11, provider mappers/presets, shell init/state/prelude/bridge, Paja
vault/store/host/adapter/toggles/parity/host-page). Chromium Playwright:
`tests/e2e/paja-llm.spec.ts` plus `paja-single-window`, `paja-console-visibility`,
`paja-runtime-pointer` and `gamepad` specs pass (29 tests). aislop@0.12.0 CI scores
95/100 with only the five pre-existing complexity rows outside this change.
