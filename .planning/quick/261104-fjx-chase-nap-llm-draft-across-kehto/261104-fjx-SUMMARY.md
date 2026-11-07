---
phase: quick-261104-fjx
plan: 01
subsystem: services, shell, paja, runtime, acl, docs
tags: [nap-llm, tools, thinking, block-deltas, paja, napplet-core-0.38, napplet-nap-0.37]
requires:
  - napplet/naps PR #134 at 5e93bdfce0e84c0de728234cb7b3feed498f8635
  - "@napplet/core@0.38.0 and @napplet/nap@0.37.0"
provides:
  - NAP-LLM tool calls and results, thinking parts, Generation.content, block-lifecycle deltas, maxTokens, temperature, tools, toolChoice, Model.tools/toolChoiceModes, Requirements.tools, extended Usage
  - conformance cases LLM-C02, C03, C09, C10, C12..C23 with tests named by ID
  - per-package peer windows and a two-line (host / fixture) version guard
affects: [services, shell, paja, acl, cli, firewall, runtime, docs]
tech-stack:
  added: []
  patterns:
    - "types re-exported from @napplet/nap/llm/types, no local mirror"
    - "dialect modules (openai, anthropic, gemini) behind a facade, shared helpers in llm-provider-shared.ts"
    - "block builder owns blockIndex assignment and the start/delta/end lifecycle"
key-files:
  created:
    - packages/services/src/llm-generation-checks.ts
    - packages/services/src/llm-provider-blocks.ts
    - packages/services/src/llm-provider-shared.ts
    - packages/services/src/llm-provider-openai.ts
    - packages/services/src/llm-provider-anthropic.ts
    - packages/services/src/llm-provider-gemini.ts
    - packages/services/src/llm-service-tools.test.ts
    - packages/services/src/llm-provider-tools.test.ts
    - .changeset/nap-llm-tools-content.md
    - .changeset/nap-llm-peer-window.md
  modified:
    - packages/services/src/{llm-types,llm-validate,llm-service,llm-providers,llm-provider-stream,llm-provider-http,index}.ts
    - packages/shell/src/napplet-namespace.ts
    - packages/paja/src/{browser-llm-connections,browser-llm-panel,browser-confirmation-request,browser-host-signer,host-page}.ts
    - tests/e2e/paja-llm.spec.ts
    - tests/unit/{napplet-package-alignment,sdk-migration-guard,nip5d-conformance-guard}.test.ts
    - docs/llm.md, docs/compatibility.md, docs/policies/NIP-5D-CONFORMANCE.md, RUNTIME-SPEC.md, package READMEs and docs/packages pages
decisions:
  - "Host packages develop on core 0.38.0 / nap 0.37.0; services and paja floor at 0.38.0 / 0.37.0, the rest keep the 0.32.0 floor with widened upper bounds"
  - "Clean break for the removed draft shapes: no compatibility path, minor changesets"
  - "Gemini format json with tools is unsupported (documented API restriction)"
  - "Gemini functionResponse carries no id; results regroup into one user content in the assistant's call order"
  - "isJsonValue depth bound and visit budget guard parameters and arguments before they are inspected"
  - "Gemini model names matching gemini-3 and later default requiresOpaqueReasoning to true"
metrics:
  duration: "about 1h 15m"
  completed: 2026-11-04
status: complete
actuals:
  tokens: 98500
  tasks: 3
  commits: 10
---

# Quick Task 261104-fjx: Chase NAP-LLM draft across Kehto Summary

Kehto's NAP-LLM implementation now conforms to napplet/naps PR #134 at `5e93bdfce0e84c0de728234cb7b3feed498f8635`, end to end, on published `@napplet/core@0.38.0` and `@napplet/nap@0.37.0`: a napplet running in Paja can send tools, watch a `toolCall` block stream, receive an authoritative `toolUse` result, answer it with a `toolResult` and get the continued completion, and no code in services, shell or Paja executes a call.

## Spec check

- **Spec checked:** `naps/NAP-LLM.md` from `napplet/naps` PR #134, head `5e93bdfce0e84c0de728234cb7b3feed498f8635` (local copy in the scratchpad).
- **Draft recheck at the end of the run:** `gh api repos/napplet/naps/pulls/134 --jq .head.sha` returned `5e93bdfce0e84c0de728234cb7b3feed498f8635`, so the draft did not move.
- **Result:** conformant at that head for the wire records, lifecycle, error mapping and cases LLM-C01..C23 as exercised by the tests below. It is a draft, so this is a statement about the checked head only.
- **Packaged contract:** `@napplet/nap/llm/types` 0.37.0 and the `Llm*` records in `@napplet/core` 0.38.0 were compared against the spec. Fields match; upstream's `Reply` helper is not exported, so `LlmReply` stays local.
- **Spec readings that needed a call (none contradicted CONTEXT):**
  - The Delta table says `name` is "text" for a `toolCall` start while the Part table says "non-empty text". Followed the stricter reading and CONTEXT: a `toolCall` start needs a non-empty `toolCallId` and `name`, and both are rejected anywhere else.
  - The spec is silent on blank-index gaps between streamed blocks. Not enforced beyond "an ended block must match the terminal content at the same index".
  - Spec: "Cancellation/other lifecycle" untouched. Spec does not define how `none` maps for Anthropic; used the documented `tool_choice: {type: "none"}`.

## What shipped (10 commits)

| Commit | Message |
| ------ | ------- |
| d3634d41 | chore(deps): move host packages to core 0.38 and nap 0.37 |
| 2207dc34 | feat(services,shell,paja): carry NAP-LLM content and block deltas end to end (tracer) |
| f5e323c4 | refactor(services): split NAP-LLM provider dialects |
| f14ffc5e | feat(services): validate NAP-LLM tool requests, terminals and block lifecycle |
| 7f63d67a | feat(services): implement NAP-LLM tool calls, thinking and usage extras |
| db935081 | feat(paja): opt-in tool calling for model connections with consent disclosure |
| 662e7537 | test(e2e): cover a NAP-LLM tool round trip through the Paja host |
| 559134c2 | docs: document NAP-LLM tools, thinking and block deltas at the checked head |
| caa50640 | chore: add changesets for NAP-LLM tools and the widened peer windows |
| 36612434 | chore(services): drop an unused import and a cross-reference comment |

- **Baseline:** peers per package (services and paja `>=0.38.0 <0.39.0` / `>=0.37.0 <0.38.0`; acl, cli, runtime, shell `>=0.32.0 <0.39.0` / `>=0.32.0 <0.38.0`; firewall core only), JSR maps to `^0.38.0` / `^0.37.0`, lock reconciled and `pnpm install --frozen-lockfile` passes. `napplet-package-alignment` and `sdk-migration-guard` now express two lines: host dev range and per-package peer windows versus exact fixture pins. Fixture pins, `@napplet/shim@0.30.0`, `@napplet/sdk@0.28.0` and `@napplet/vite-plugin@0.16.2` are untouched and guarded.
- **Tracer:** one text generation proven in Chromium through prelude, runtime, service, OpenAI stream mapping and Paja as `[0 start] [1 delta Hello] [2 delta ", napplet"] [3 end]` plus a `content` result.
- **Services:** upstream types re-exported; role-discriminated request validation; a dependency-free structural JSON Schema check; `isJsonValue` (depth 64, 50 000 visits) so cycles, heavily shared graphs and non-plain objects are `invalid-request` promptly; unsupported-before-consent ordering (tools, mode, historical parts, images, JSON); terminal normalisation and validation; a delta lifecycle tracker and stream-to-terminal matcher; three dialect modules with tool mapping, reasoning, usage extras, opaque-reasoning handling and block streaming.
- **Shell:** `makeLlm` forwards the full structured delta only for the next sequence with valid fields.
- **Paja:** Tool calling and Required/Named choice checkboxes, canonical stored `toolChoiceModes`, credential-free preflight in `authorize`, consent copy naming tool definitions and counting tool results, counts-only audit log.
- **Runtime and ACL:** no code change. Confirmed `llm.delta` still gates by capability and nothing inspects delta or result text (`packages/runtime/src`, `packages/acl/src`); only fixtures and comments in two test files changed.
- **Docs:** `docs/llm.md` (new "Tools, thinking and block deltas" section with the dialect table), NAP-LLM paragraph copies, per-package peer paragraphs and tables, NIP-5D conformance policy, RUNTIME-SPEC toolchain rows, Paja pages and how-tos, a compatibility register row (`PAJA_LLM_TOOL_FIELDS`) for the optional persisted Paja fields.
- **Changesets:** `minor` for `@kehto/services`, `@kehto/shell`, `@kehto/paja`; `patch` for `@kehto/acl`, `@kehto/cli`, `@kehto/firewall`, `@kehto/runtime`.

## Deviations from Plan

None that needed a rule-based fix beyond these notes:

- **Commit granularity.** CHECKPOINT 2 (request gates) and CHECKPOINT 3 (terminal and stream rules) share `llm-validate.ts` and `llm-service.ts` and were committed together as `f14ffc5e`. The Task 3 code, test and docs steps were committed in the planned separate commits.
- **Test order.** The Task 2 conformance tests were written after each implementation checkpoint and before its commit, not strictly red-first. Every case listed in the plan has a test named by ID (`LLM-C12` through `LLM-C23` all grep-resolve under `packages/services/src`).
- **Gap decisions the plan left open, as decided:** Gemini `functionResponse.response` is `{ output: text }` with no ids and results regrouped in call order; absent Gemini `args` and an empty OpenAI `arguments` mean `{}`; an `isError` result without a native flag is the exact sentence, a newline, then the text parts joined by newlines (asserted in LLM-C22); Gemini `format: "json"` with tools is `unsupported`.
- **aislop (rule 3 fix).** First run showed an unused import (`nonCallParts` in the Gemini module) and a narrative-comment finding; both fixed in `36612434`.

## Verification (actual final output)

Run from the worktree after the last commit.

- `pnpm build`: exit 0. `Tasks: 16 successful, 16 total`, `Cached: 12 cached, 16 total`.
- `pnpm type-check`: exit 0. `Tasks: 17 successful, 17 total`, `Cached: 13 cached, 17 total`.
- `pnpm test:unit`: exit 0. `Test Files  174 passed (174)`, `Tests  2396 passed (2396)`. This includes `tests/unit/nip5d-conformance-guard.test.ts`, `packages/paja/src/parity.test.ts`, `napplet-package-alignment`, `sdk-migration-guard` and `published-napplet-contract`.
- `pnpm docs:check`: exit 0. `[audit:docs] OK — checked 9 public package docs, VitePress routes, TypeDoc targets, and docs gate wiring`.
- `npx playwright test tests/e2e/paja-llm.spec.ts tests/e2e/paja-single-window.spec.ts --project chromium`: exit 0, `25 passed`, including `keeps canonical INC protected through the real shim assignment in an opaque Paja srcdoc` (shim 0.30.0).
- Full `pnpm test:e2e` (builds first): exit 0, `117 passed`, `1 skipped`. The skip is the existing `test.fixme` in `tests/e2e/paja-identity.spec.ts:113` (identity.changed re-initialisation gap), not a skip added here. This run preceded the final lint-only commit `36612434` (an import and a comment); the build, unit, docs and the 25 targeted e2e tests above ran after it.
- `npx -y aislop@0.12.0 ci --json`: score **93**, 0 errors, 6 warnings. I ran the same command against an extract of `origin/main`: also **93** with the identical six warnings (`browser-host.ts` file size and function length, `browser-intent-builder.ts`, `browser-llm-panel.ts` function length, `cvm-nostr-transport.ts` file size, `shell/src/intent-uri.ts`). So there are **no new findings**; note the measured baseline is 93, not the 94 to 96 the plan and CONTEXT recorded. `browser-llm-panel.ts` stays flagged as before (the function grew by about 4 lines). All new files are under 700 non-blank lines (largest: `llm-service-tools.test.ts` at 556, `llm-service.ts` at 519).
- `git diff --check origin/main...HEAD`: clean (it first caught a trailing blank line at the end of `llm-providers.ts`, fixed in `36612434`).
- Stale-string grep `3e10939|nap@0\.35|<0\.37\.0|Development stays on|baseline 0\.32` outside changelogs, `.planning` and the lock: no matches.
- `pnpm install --frozen-lockfile`: passes.

## Known Gaps

- **Out of scope, still pinned:** the `@napplet/shim` 0.36 migration. A spike showed shim 0.36 breaks `paja-single-window.spec.ts` "keeps canonical INC protected" (real prelude in a Paja srcdoc; port-bound identity), so shim 0.30.0, sdk 0.28.0 and vite-plugin 0.16.2 and the fixture pins are unchanged. Separate migration.
- **Gemini 3+ tool continuation answers `unsupported`.** Continuing a function-calling turn on a model matching `gemini-3` or later needs thought signatures NAP-LLM cannot represent, so history containing `toolCall` parts is `unsupported` there. A first tool turn works. An endpoint can override with `requiresOpaqueReasoning: false`.
- **Follow-up: adopt nap 0.37 intent types.** `@napplet/nap@0.37.0` exports `IntentCandidate` and related types and `@napplet/core@0.38.0` declares `intent.onDelivery`. Kehto's local `intent-types.ts` mirror and host-owned `onDelivery` binding are unchanged. Wording that said nap 0.32 "has not published" them was corrected to point at this follow-up.
- ~~`@kehto/cli` keeps its 0.32 peer floor~~ Resolved in orchestrator review: cli now matches the Paja floor and takes a `minor` bump.
- **Dialect `unsupported` after consent for non-Paja hosts.** The service does not know the provider dialect, so restrictions such as Anthropic needing tool definitions for tool history are raised by `buildLlmProviderRequest`. Paja preflights it before any prompt (`authorize`); another host that does not will answer `unsupported` only after its own consent step. Documented in the host checklist in `docs/llm.md`.
- **Not re-audited against 0.37.** Statements that describe the released 0.32 line as fact were kept where they remain true of that release: `docs/media.md`, `docs/compatibility.md` (media retention reason, around line 291), `docs/policies/SHELL-RESOURCE-POLICY.md`, `docs/migrations/NIP-5D-EVENT-SCHEMA.md`, and the NAP-INC/relay `EventTemplate` drift notes in `NIP-5D-CONFORMANCE.md`. I did not check whether nap 0.37.0 changed any of those behaviours.
- **Not run:** Firefox or WebKit Playwright projects (the suite runs Chromium); no live provider calls (providers are stubbed, dialect shapes follow each provider's documented format, not a recorded exchange).
- **No tool-capable preset flag.** `LLM_PROVIDER_PRESETS` has no per-preset tool capability hint, so tool support is a user opt-in per connection by design.

## Threat Flags

None beyond the plan's register (T-fjx-01..09). New free-form napplet input (`parameters`, `arguments`) is covered by `isJsonValue` (T-fjx-05) and the LLM-C02 cyclic, shared and non-plain cases.

## Self-Check: PASSED

- Files above exist; the six new services modules and two test files are present.
- Commits `d3634d41`, `2207dc34`, `f5e323c4`, `f14ffc5e`, `7f63d67a`, `db935081`, `662e7537`, `559134c2`, `caa50640` and `36612434` are on `feat/nap-llm-tools-content`.
- Not committed by design: this SUMMARY, STATE.md, PLAN.md and CONTEXT.md. ROADMAP.md untouched; nothing pushed, no PR opened.

## Orchestrator review

Reviewed against the spec after execution. Three follow-up commits: literal `null` tool arguments are `provider-error`; the service refuses host connections whose `toolChoiceModes` break the Model rules; `@kehto/cli` matches the Paja peer floor. The empty `stop` result is recorded as a spec gap in `llm-generation-checks.ts` with a test. Final gates on the pushed code: build, type-check, 2398 unit tests, docs:check, 117 Chromium e2e passed with 1 pre-existing skip, aislop 93 (same as origin/main). `paja-llm.spec.ts:118` passed on retry once in a cold run right after a rebuild, then 6/6 with no retries and clean in the final full run.
