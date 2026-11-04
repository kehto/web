# Quick Task 261104-fjx: Chase NAP-LLM draft across kehto - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Task Boundary

Bring every Kehto NAP-LLM consumer (services, shell prelude, runtime, ACL, Paja, docs, tests) to
napplet/naps PR #134 head `5e93bdfce0e84c0de728234cb7b3feed498f8635`, in lockstep, against the
published `@napplet/core@0.38.0` / `@napplet/nap@0.37.0`. Prior implementation tracked `3e10939`.

The new contract adds tool calls and results, `thinking` parts, `Generation.content` (replacing
`text`), block-lifecycle deltas (replacing text deltas), `maxTokens`, `temperature`, `tools`,
`toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools`, extended `Usage`, and
conformance cases LLM-C12..C23.
</domain>

<decisions>
## Implementation Decisions

### Dependencies
- Host `packages/*` dev baseline moves to `@napplet/core >=0.38.0 <0.39.0` and `@napplet/nap
  >=0.37.0 <0.38.0` (already applied in the working tree; a spike proved build + type-check green
  and only version guards fail).
- JSR import maps move to `jsr:@napplet/core@^0.38.0` / `jsr:@napplet/nap@^0.37.0` (both exist).
- Published peers widen upper bounds to core `<0.39.0`, nap `<0.38.0`.
- Peer floors: `@kehto/services` and `@kehto/paja` move to core `>=0.38.0`, nap `>=0.37.0` because
  their declarations now import the upstream types. acl, cli, firewall, runtime, shell keep the
  `>=0.32.0` floor (they do not consume LLM types). Guards in
  `tests/unit/napplet-package-alignment.test.ts` and `tests/unit/sdk-migration-guard.test.ts`
  become per-package accordingly.
- **Out of scope, stays pinned:** `@napplet/shim@0.30.0`, `@napplet/sdk@0.28.0`,
  `@napplet/vite-plugin@0.16.2` and the exact `tests/fixtures/napplets/*` core/nap 0.32.0 pins.
  A spike showed shim 0.36 breaks `paja-single-window.spec.ts` "keeps canonical INC protected"
  (real prelude in Paja srcdoc; port-bound identity). That is a separate migration and goes in the
  PR's known gaps. The alignment guard must express two lines: host dev vs fixture exact.
- Docs that state the dev baseline ("Development stays on 0.32.0") must be corrected. Statements
  about the *fixture* matrix remain true. Other local mirrors (intent types etc.) stay; correct any
  comment that becomes false, and if nap 0.37 already exports them note a follow-up in the summary
  rather than absorbing that migration.

### Types
- Retire the mirror: `packages/services/src/llm-types.ts` imports and re-exports its record and
  envelope types as `import type`/`export type` from `@napplet/nap/llm/types`. Keep local runtime
  values (`LLM_DOMAIN`, `LLM_ERROR_CODES`, `LlmServiceError`) so services has no runtime dependency
  on nap. Every type already re-exported from `@kehto/services` stays exported, plus the new ones
  (typedoc runs with `--treatWarningsAsErrors`).

### Breaking changes: no compatibility path
- Draft contract on 0.x: a clean break, `minor` changesets. Do not retain `Generation.text`,
  text-only deltas or `onDelta(text)`. No compat register entry is needed for removed draft shapes.
- `@kehto/services` host API changes: `LlmConnection` gains required `tools: boolean` and
  `toolChoiceModes`. `LlmGenerateHooks.onDelta` and the `HttpLlmProvider` callback take a structured
  block event (`LlmDelta` without `requestId`/`sequence`); the service owns numbering and routing.
- Paja's persisted `kehto:paja:llm-connections:v1` rows: `tools`/`toolChoiceModes` are optional
  fields defaulting to no tool support, so old rows load unchanged and the storage key does not
  change. Users opt in per connection.

### Service (`llm-service.ts`, `llm-validate.ts`)
- Validation produces `invalid-request` before anything else, for all of: every new record field;
  non-positive/non-integer `maxTokens`; non-finite `temperature`; tool names outside
  `^[A-Za-z0-9_-]{1,64}$`; duplicate names; `toolChoice` without non-empty `tools`; forced name not
  listed; `parameters` root not `type: "object"`; structurally malformed JSON Schema; `toolCallId`,
  `toolName`, `isError` outside `toolResult` (and the first two missing on it); `thinking`/`toolCall`
  outside assistant; non text/image in `toolResult`; duplicate call ids across the conversation;
  results not immediately following their assistant turn; missing (including a conversation ending
  on unanswered calls), duplicate, orphaned or name-mismatched results.
- Malformed-schema check: a small dependency-free recursive structural check of 2020-12 keywords
  (`type` values, `properties`/`$defs` maps of schemas, `items`, `required` string list, `enum`
  list, `allOf`/`anyOf`/`oneOf` schema lists, booleans as schemas). JSON Schema keywords are not
  unknown record fields, so unknown keywords pass. Bound recursion depth.
- `unsupported` before consent, comparing against the connection: `tools` present and
  `!connection.tools`; requested mode not in `toolChoiceModes` (absent choice with tools is `auto`;
  named is `tool`); historical `toolCall`/`toolResult` on a `!connection.tools` connection; image
  anywhere (tool results included) on `!connection.images`.
- Terminal normalisation in the service (hosts are pluggable, so the rule sits here, adapters
  normalise too): completed `stop`/`toolUse` with any `toolCall` becomes `toolUse`; `toolUse` with no
  call is `provider-error`; `length`/`refusal` have `toolCall` parts stripped and finish preserved.
- Terminal validation, `provider-error` with a safe message and no body: unknown tool name against
  current `tools` (including any call when no tools were sent); duplicate id within the result or
  colliding with the request history; mode violations on a completed turn (`none` with calls,
  `required`/named with none, named with another name); arguments non-object; malformed Generation;
  `format: "json"` on `stop` where concatenated text parts do not parse to an object.
- Deltas: hosts emit `{event, block, blockIndex, text?, toolCallId?, name?}`; the service assigns the
  contiguous `sequence`, adds `requestId`, and suppresses after settlement. Any lifecycle violation
  fails the generation with `provider-error`, never a silent drop: second `start`, `delta`/`end`
  before `start`, kind change on an index, event after `end`, `text` on non-`delta`, missing
  `toolCallId`/`name` on a `toolCall` `start`.
- On `stop`/`toolUse`, streamed blocks that ended must match the terminal content at the same index:
  same kind, concatenated text equal, id/name equal, concatenated fragments parsing deep-equal to
  `arguments`. Mismatch is `provider-error`. `length`/`refusal` skip this check.
- `sameConnection` and `toModel` include `tools` and `toolChoiceModes`. `meetsRequirements` honours
  `tools`. Connection output is `toolChoiceModes: []` when `tools` is false.
- The runtime never executes a tool call. No code path in services, shell or Paja may do so.

### Provider dialects (`llm-providers.ts`, `llm-provider-stream.ts`)
- `maxFileLoc: 700` is enforced by aislop. Split per dialect when it helps
  (`llm-provider-openai.ts`, `llm-provider-anthropic.ts`, `llm-provider-gemini.ts`) and keep public
  exports stable.
- `maxTokens`: send the smaller of `request.maxTokens` and `endpoint.maxOutputTokens`; Anthropic's
  required default stays when both are absent.
- `temperature`: out-of-range for the dialect is `unsupported` (openai-chat and gemini 0..2,
  anthropic 0..1).
- Thinking is omitted from provider input on replay. A message left empty by that omission is
  dropped from provider input; this is the spec's display-only exception.
- Tool definitions: omitted `parameters` becomes
  `{"type":"object","properties":{},"additionalProperties":false}`.
  - OpenAI: `tools[].function`, `tool_choice` auto/none/required/`{type:"function",function:{name}}`.
    Assistant `tool_calls` with `JSON.stringify(arguments)`; results `{role:"tool",tool_call_id,content}`.
    Tool-result images are `unsupported`. `isError` uses the prefix text.
  - Anthropic: `tools[].input_schema`, `tool_choice` auto/none/any/`{type:"tool",name}`. `tool_use`
    blocks; results merged into a user turn as `tool_result` with `is_error` natively, images allowed.
    Historical calls with no current `tools` are `unsupported` (the API needs definitions present).
  - Gemini: `functionDeclarations` with `parametersJsonSchema`, `functionCallingConfig` mode
    AUTO/NONE/ANY with `allowedFunctionNames`. `functionCall`/`functionResponse` parts; tool-result
    images are `unsupported`; `isError` uses the prefix text.
- `isError` prefix without a native flag: a leading text part exactly `Tool execution failed.`
  followed by the supplied content (LLM-C22).
- Opaque reasoning (LLM-C17): `LlmProviderEndpoint.requiresOpaqueReasoning?: boolean`. When true,
  history containing `toolCall` parts is `unsupported` before any request is built. The Gemini
  builder treats models matching `/^(models\/)?gemini-([3-9]|\d{2,})/` as requiring it by default
  (their function-call continuation needs thought signatures this contract cannot represent); the
  explicit flag overrides. Document this. Kehto never enables Anthropic extended thinking, so no
  signed blocks arise there.
- Response parsing: OpenAI `tool_calls`, `reasoning_content`/`reasoning` to `thinking`,
  `tool_calls` finish to `toolUse`, `stop` with calls normalised to `toolUse`. Anthropic `tool_use`,
  `thinking`, redacted blocks omitted with indices compacted, `tool_use` stop reason to `toolUse`.
  Gemini `functionCall`, `thought: true` to `thinking`, `STOP` with calls to `toolUse`;
  `MALFORMED_FUNCTION_CALL`/`UNEXPECTED_TOOL_CALL` remain no marker, so `provider-error`.
- Missing call id: synthesize once with `crypto.randomUUID` (counter fallback) so the same id appears
  in deltas and the terminal result (LLM-C14).
- Completed turn with malformed/non-object arguments or a call missing its completion is
  `provider-error`. Truncated/refused turns discard calls and keep the finish (LLM-C15).
- Usage extras: OpenAI `prompt_tokens_details.cached_tokens`, `completion_tokens_details.reasoning_tokens`;
  Anthropic `cache_read_input_tokens`, `cache_creation_input_tokens`; Gemini
  `cachedContentTokenCount`, `thoughtsTokenCount`. Omit when not reported.
- Streaming: accumulator `push()` returns an ordered list of block events and `finish()` the
  Generation. Terminal content is ordered by `blockIndex`. Text and thinking get a block each on first
  appearance; each tool call gets its own block whose `start` waits until id and name are known
  (id synthesized if the provider omits it). All open blocks get `end` at normal completion. Blocks
  may interleave. A no-argument call emits a single `{}` fragment so fragments parse to the final
  object. Gemini whole-object `functionCall` emits start, one `JSON.stringify(args)` delta, end.
  A stream ending without its completion marker stays `provider-error`.

### Shell prelude (`napplet-namespace.ts`)
- `onDelta` receives the full structured delta and accepts it only when `sequence` is the next
  expected and the required fields are valid for the event. `generate` keeps returning a promise
  carrying `requestId`. `Model`/`Generation` pass through unchanged.

### Paja
- Connection editor: "Tool calling" checkbox plus two sub-options "Required tool choice" and "Named
  tool choice", with stable ids `paja-llm-tools`, `paja-llm-tool-required`, `paja-llm-tool-named`.
  Stored `toolChoiceModes` is canonical, ordered `auto, none, required, tool`, de-duplicated, always
  includes `auto, none` when tools are on, empty when off. The sub-options are disabled until tools
  is on.
- `meets`, `describeRequirements`, `toConnection` honour tools.
- Consent (`action: 'llm'`) discloses tool definition names and count, tool result count, and counts
  characters across text, tool results, tool arguments and tool schemas. The warning text names tool
  definitions and results as disclosed data. `browser-confirmation-request.ts` and the dialog
  renderer are updated together.
- Paja's `authorize` runs `buildLlmProviderRequest` with no credential before asking for consent, so a
  dialect `unsupported` answers without a pointless prompt (LLM-C03).
- Paja never executes tool calls.

### Runtime and ACL
- No wire-surface changes expected. Verify `llm.delta` still gates by capability and that nothing
  inspects `delta.text` or `result.text`. Update any stale comments.

### Tests
- Assert real vectors from the spec's examples where possible. Cover each new conformance case:
  LLM-C12 through LLM-C23 by ID in test names, plus the changed C02, C03, C09, C10.
- `tests/e2e/paja-llm.spec.ts`: update for the new `result.content` and delta shapes, and add a
  tool-call round trip through the real Paja host against the existing stub provider (consent shows
  tool disclosure; streamed `toolCall` block; authoritative `toolUse`; `toolResult` continuation).
- `tests/unit/nip5d-conformance-guard.test.ts` and the Paja `parity` tests stay green.

### Docs
Update in the same change: `docs/llm.md`, `docs/packages/{services,shell,paja,runtime,acl,cli,firewall}.md`
(peer rows), `docs/policies/NIP-5D-CONFORMANCE.md`, `RUNTIME-SPEC.md` dev-baseline rows,
`docs/how-tos/paja-getting-started.md`, `docs/how-tos/paja-local-authoring.md`,
`docs/compatibility.md` where the baseline is named, and the READMEs of services, shell, paja, runtime
and acl. Replace every `3e10939…` and `@napplet/nap@0.35.x` reference with the checked head and
current line. Grep for stale strings before committing.

### Claude's Discretion
- Internal file layout within the 700-LOC budget, helper naming, exact safe error messages.
</decisions>

<specifics>
## Specific Ideas

- Changesets (`minor`, breaking on 0.x) for shipped output: `@kehto/services`, `@kehto/shell`,
  `@kehto/paja`; add `patch` for any other package whose published `package.json` peer range changes
  (acl, cli, firewall, runtime). Feature PR keeps its `.changeset/*.md` files.
- Gate commands: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm docs:check`,
  `npx playwright test tests/e2e/paja-llm.spec.ts --project chromium`,
  `npx -y aislop@0.12.0 ci` (JSON diagnostics; baseline 94-96, target no new findings; `as unknown as`
  casts are flagged; keep functions under 150 LOC, nesting under 5, params under 6).
- zsh does not word-split `$VAR`; generate bulk edits with node.
</specifics>

<canonical_refs>
## Canonical References

- Authority: `naps/NAP-LLM.md` in napplet/naps at `5e93bdfce0e84c0de728234cb7b3feed498f8635`. Local copy:
  `/private/tmp/claude-501/-Users-sandwich-Develop-kehto/6dfa8500-219c-4b85-9e7f-83898f660794/scratchpad/NAP-LLM-head.md`.
  Previous revision: `.../scratchpad/NAP-LLM-old.md`.
- Packaged contract: `@napplet/nap/llm/types` 0.37.0 and `LlmApi` in `@napplet/core` 0.38.0 (installed
  under `packages/services/node_modules/@napplet/`). Checked: matches the spec's fields.
</canonical_refs>
</content>
</invoke>
