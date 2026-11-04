---
phase: quick-261104-fjx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Baseline commit (Task 1, step A)
  - packages/acl/package.json
  - packages/cli/package.json
  - packages/firewall/package.json
  - packages/paja/package.json
  - packages/runtime/package.json
  - packages/services/package.json
  - packages/shell/package.json
  - packages/acl/jsr.json
  - packages/firewall/jsr.json
  - packages/paja/jsr.json
  - packages/runtime/jsr.json
  - packages/services/jsr.json
  - packages/shell/jsr.json
  - pnpm-lock.yaml
  - tests/unit/napplet-package-alignment.test.ts
  - tests/unit/sdk-migration-guard.test.ts
  # Services
  - packages/services/src/index.ts
  - packages/services/src/llm-types.ts
  - packages/services/src/llm-validate.ts
  - packages/services/src/llm-service.ts
  - packages/services/src/llm-generation-checks.ts
  - packages/services/src/llm-providers.ts
  - packages/services/src/llm-provider-shared.ts
  - packages/services/src/llm-provider-blocks.ts
  - packages/services/src/llm-provider-openai.ts
  - packages/services/src/llm-provider-anthropic.ts
  - packages/services/src/llm-provider-gemini.ts
  - packages/services/src/llm-provider-stream.ts
  - packages/services/src/llm-provider-http.ts
  - packages/services/src/llm-service.test.ts
  - packages/services/src/llm-service-tools.test.ts
  - packages/services/src/llm-providers.test.ts
  - packages/services/src/llm-provider-tools.test.ts
  - packages/services/src/llm-provider-stream.test.ts
  # Shell, runtime, ACL
  - packages/shell/src/napplet-namespace.ts
  - packages/shell/src/napplet-namespace.test.ts
  - packages/runtime/src/llm-dispatch.test.ts
  - packages/acl/src/resolve.test.ts
  # Paja
  - packages/paja/src/browser-llm-connections.ts
  - packages/paja/src/browser-llm-connections.test.ts
  - packages/paja/src/browser-llm-panel.ts
  - packages/paja/src/browser-confirmation-request.ts
  - packages/paja/src/browser-host-signer.ts
  - packages/paja/src/host-page.ts
  - packages/paja/src/host-page.test.ts
  - packages/paja/src/parity.test.ts
  - tests/e2e/paja-llm.spec.ts
  - tests/unit/nip5d-conformance-guard.test.ts
  # Docs and release metadata
  - docs/llm.md
  - docs/compatibility.md
  - docs/policies/NIP-5D-CONFORMANCE.md
  - docs/packages/acl.md
  - docs/packages/cli.md
  - docs/packages/firewall.md
  - docs/packages/paja.md
  - docs/packages/runtime.md
  - docs/packages/services.md
  - docs/packages/shell.md
  - docs/how-tos/paja-getting-started.md
  - docs/how-tos/paja-local-authoring.md
  - RUNTIME-SPEC.md
  - packages/acl/README.md
  - packages/firewall/README.md
  - packages/paja/README.md
  - packages/runtime/README.md
  - packages/services/README.md
  - packages/shell/README.md
  - .changeset/nap-llm-tools-content.md
  - .changeset/nap-llm-peer-window.md
autonomous: true
requirements: [QUICK-261104-fjx]

estimate:
  tokens: 200000
  raw_tokens: 200000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Through the real Paja host, a napplet can send tools, see a streamed toolCall block, receive an authoritative finish toolUse result, answer it with a toolResult message and get a continued completion (LLM-C14, C18, C21)."
    - "Every terminal result carries content parts and every llm.delta is a start/delta/end block event; the earlier flat result text field and text-only deltas no longer exist in services, shell, Paja or docs."
    - "Malformed tool records and histories answer invalid-request with zero provider contact; connection or dialect restrictions answer unsupported before consent, and Paja shows no pointless consent prompt (LLM-C02, C03, C12, C19, C20, C21, C22)."
    - "Provider output that breaks the contract (unknown tool, mode violation, bad arguments, broken block lifecycle, stream/terminal mismatch) answers provider-error with no raw body, and truncated or refused turns keep their finish with no executable calls (LLM-C10, C13, C15, C16, C18)."
    - "Paja consent names tool definitions and counts tool results before anything leaves the page; declining means zero provider submissions, and no code path in services, shell or Paja executes a tool call (LLM-C23)."
    - "Host packages build and test on core 0.38.0 / nap 0.37.0 while tests/fixtures/napplets stay on the exact 0.32.0 line and shim 0.30.0 / sdk 0.28.0 / vite-plugin 0.16.2 stay pinned; guards express both lines and the per-package peer windows."
    - "A persisted kehto:paja:llm-connections:v1 row without the new fields loads unchanged as a tools-off connection under the same storage key."
  artifacts:
    - path: "packages/services/src/llm-types.ts"
      provides: "Upstream record and envelope types re-exported from @napplet/nap/llm/types; local LLM_DOMAIN, LLM_ERROR_CODES, LlmServiceError, LlmReply, LlmBlockEvent"
      contains: "@napplet/nap/llm/types"
    - path: "packages/services/src/llm-generation-checks.ts"
      provides: "Terminal normalisation, terminal validation, delta lifecycle tracking and stream-to-terminal matching"
    - path: "packages/services/src/llm-provider-blocks.ts"
      provides: "Block event builder shared by the dialect stream accumulators"
    - path: "packages/services/src/llm-provider-openai.ts"
      provides: "OpenAI Chat Completions request, response and stream mapping including tools"
    - path: "packages/services/src/llm-provider-anthropic.ts"
      provides: "Anthropic Messages request, response and stream mapping including tools"
    - path: "packages/services/src/llm-provider-gemini.ts"
      provides: "Gemini generateContent request, response and stream mapping including tools and the opaque-reasoning default"
    - path: "packages/services/src/llm-service-tools.test.ts"
      provides: "LLM-C12..C23 service conformance by ID"
    - path: "packages/services/src/llm-provider-tools.test.ts"
      provides: "LLM-C14..C18 and C22 dialect conformance by ID, using spec vectors"
    - path: "tests/e2e/paja-llm.spec.ts"
      provides: "Tool-call round trip through the real Paja host against the stub provider"
      contains: "toolUse"
    - path: "docs/llm.md"
      provides: "Host guide at the checked head, including tools, thinking, block deltas and dialect limits"
      contains: "5e93bdfce0e84c0de728234cb7b3feed498f8635"
    - path: ".changeset/nap-llm-tools-content.md"
      provides: "minor bumps for @kehto/services, @kehto/shell, @kehto/paja"
  key_links:
    - from: "packages/services/src/llm-service.ts"
      to: "packages/services/src/llm-generation-checks.ts"
      via: "runGeneration routes every onDelta through the tracker and every result through terminal normalisation before settling"
      pattern: "llm-generation-checks"
    - from: "packages/services/src/llm-providers.ts"
      to: "packages/services/src/llm-provider-openai.ts"
      via: "buildLlmProviderRequest and parseLlmProviderResponse dispatch by protocol; public exports stay on llm-providers"
      pattern: "llm-provider-(openai|anthropic|gemini)"
    - from: "packages/paja/src/browser-llm-connections.ts"
      to: "packages/services/src/llm-providers.ts"
      via: "authorize runs buildLlmProviderRequest with no credential before any unlock or consent prompt"
      pattern: "buildLlmProviderRequest"
    - from: "packages/paja/src/browser-host-signer.ts"
      to: "packages/paja/src/browser-confirmation-request.ts"
      via: "The consent renderer shows tool names, tool count and tool result count; the log records counts only"
      pattern: "toolResults"
    - from: "packages/shell/src/napplet-namespace.ts"
      to: "@napplet/core LlmDelta"
      via: "makeLlm forwards the full structured delta only for the next sequence with valid event fields"
      pattern: "blockIndex"
---

<objective>
Bring every Kehto NAP-LLM consumer to `napplet/naps` PR #134 head `5e93bdfce0e84c0de728234cb7b3feed498f8635`, in lockstep, against published `@napplet/core@0.38.0` and `@napplet/nap@0.37.0`: tool calls and results, `thinking`, `Generation.content`, block-lifecycle deltas, `maxTokens`, `temperature`, `tools`, `toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools`, extended `Usage` and conformance cases LLM-C12..C23.

Purpose: Kehto's implementation tracks an older draft head, so napplets on Kehto hosts cannot represent agentic turns. This is a clean break on a 0.x draft contract, with no compatibility path for the removed shapes.

Output: three green checkpoints: baseline plus a text path proven end to end on the new contract; the full tool turn in `@kehto/services`; then Paja tool support, the end-to-end tool round trip, docs and changesets.

**Working directory:** every path and command is under `/Users/sandwich/.worktrees/kehto/nap-llm-tools-content` (branch `feat/nap-llm-tools-content`). Never touch `/Users/sandwich/Develop/kehto`.

**Stop line:** this plan ends at committed code plus `261104-fjx-SUMMARY.md`. Do not edit `.planning/STATE.md`, push or open a PR; the orchestrator does those. Stage by explicit path, never `git add -A`, and leave `.planning/quick/261104-fjx-*/` untracked unless it is the SUMMARY step of the workflow.

**Decision authority:** `261104-fjx-CONTEXT.md` is locked and detailed. Tasks cite its sections as "CONTEXT Service", "CONTEXT Provider dialects" and so on, and do not restate every clause. Read those sections in full before starting the task that cites them. Where this plan adds detail, it fills a gap the CONTEXT leaves open and is marked as such.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/quick/261104-fjx-chase-nap-llm-draft-across-kehto/261104-fjx-CONTEXT.md

Spec authority (local copy of `naps/NAP-LLM.md` at the checked head; refetch with `gh api` at that ref if the file is gone):
@/private/tmp/claude-501/-Users-sandwich-Develop-kehto/6dfa8500-219c-4b85-9e7f-83898f660794/scratchpad/NAP-LLM-head.md

Packaged contract, installed once the baseline is in place: `packages/services/node_modules/@napplet/nap/dist/llm/types.d.ts` and the `Llm*` declarations in `packages/services/node_modules/@napplet/core/dist/index.d.ts`. Upstream's `Reply` helper is not exported, so `LlmReply` stays local.

<interfaces>
Contracts this plan introduces or changes. Use these names and signatures so later tasks do not have to rediscover them.

```ts
// packages/services/src/llm-types.ts
export type LlmBlockEvent = Omit<LlmDelta, 'requestId' | 'sequence'>;

// packages/services/src/llm-service.ts
export interface LlmConnection {
  /* existing fields */
  readonly tools: boolean;
  readonly toolChoiceModes: readonly LlmToolChoiceMode[];
}
export interface LlmGenerateHooks {
  readonly signal: AbortSignal;
  /** The service assigns sequence and requestId, validates the lifecycle and routes it. */
  onDelta(event: LlmBlockEvent): void;
}

// packages/services/src/llm-provider-http.ts
export type HttpLlmProvider = (
  endpoint: LlmProviderEndpoint,
  request: LlmGenerationRequest,
  signal: AbortSignal,
  onDelta?: (event: LlmBlockEvent) => void,
) => Promise<LlmGeneration>;

// packages/services/src/llm-provider-stream.ts
export interface LlmStreamAccumulator {
  /** Ordered block events produced by this provider event; empty when it carried none. */
  push(event: unknown): LlmBlockEvent[];
  finish(): LlmGeneration;
}

// packages/services/src/llm-providers.ts
export interface LlmProviderEndpoint {
  /* existing fields */
  /** History containing toolCall parts is unsupported when true. Gemini defaults it from the model name. */
  readonly requiresOpaqueReasoning?: boolean;
}

// packages/paja/src/browser-llm-connections.ts
export interface PajaLlmConnectionRecord {
  /* existing fields */
  readonly tools?: boolean;
  readonly toolChoiceModes?: readonly LlmToolChoiceMode[];
}

// packages/paja/src/browser-confirmation-request.ts, action 'llm' gains
readonly tools: readonly string[];   // tool definition names, sent to the dialog only
readonly toolResults: number;
```

Existing public exports of `@kehto/services` all stay exported from `packages/services/src/index.ts`. `LlmReply` stays a local type. Added type exports: `LlmBlockEvent`, `LlmDeltaBlock`, `LlmDeltaEvent`, `LlmNamedToolChoice`, `LlmOutputPart`, `LlmThinkingPart`, `LlmTool`, `LlmToolCallPart`, `LlmToolChoice`, `LlmToolChoiceMode`, `LlmApi`, `LlmGenerateOptions`, `LlmPendingGeneration`.
</interfaces>
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Baseline commit, then one text generation end to end on the new contract</name>
  <files>packages/*/package.json, packages/*/jsr.json, pnpm-lock.yaml, tests/unit/napplet-package-alignment.test.ts, tests/unit/sdk-migration-guard.test.ts, docs/packages/{acl,cli,firewall,paja,runtime,services,shell}.md, packages/services/src/{llm-types,llm-validate,llm-service,llm-providers,llm-provider-blocks,llm-provider-stream,llm-provider-http,index}.ts, packages/services/src/{llm-service,llm-providers,llm-provider-stream}.test.ts, packages/shell/src/napplet-namespace.ts, packages/shell/src/napplet-namespace.test.ts, packages/paja/src/browser-llm-connections.ts, packages/paja/src/browser-llm-connections.test.ts, packages/runtime/src/llm-dispatch.test.ts, packages/acl/src/resolve.test.ts, tests/e2e/paja-llm.spec.ts</files>
  <action>
Orient first: run `git status`, `git branch --show-current`, `git log --oneline -5`. The uncommitted `packages/*/package.json` devDependency moves and `pnpm-lock.yaml` are the expected baseline edits; the untracked quick directory is expected.

STEP A, the baseline commit (CONTEXT Dependencies). Generate bulk edits with a node script, because zsh does not word-split.
- Peers: `@kehto/services` and `@kehto/paja` become core `>=0.38.0 <0.39.0`, nap `>=0.37.0 <0.38.0`. `@kehto/acl`, `cli`, `runtime` and `shell` become core `>=0.32.0 <0.39.0`, nap `>=0.32.0 <0.38.0`. `@kehto/firewall` becomes core `>=0.32.0 <0.39.0`.
- Every `packages/*/jsr.json` import of core or nap moves to `jsr:@napplet/core@^0.38.0` and `jsr:@napplet/nap@^0.37.0`.
- Run `pnpm install --no-frozen-lockfile`, then prove `pnpm install --frozen-lockfile` passes.
- Peer rows in `docs/packages/{acl,cli,firewall,paja,runtime,services,shell}.md` must match the manifests, because `sdk-migration-guard` reads them.
- Rewrite `tests/unit/napplet-package-alignment.test.ts` to express two lines. A fixture exact matrix (core 0.32.0, nap 0.32.0, shim 0.30.0, sdk 0.28.0, vite-plugin 0.16.2) applies to `tests/fixtures/napplets/*`, with shim, sdk and vite-plugin exact wherever they appear. A host line (dev range core `>=0.38.0 <0.39.0` / nap `>=0.37.0 <0.38.0`, resolving 0.38.0 / 0.37.0) applies to `packages/*`. Check dev and peer groups separately, with a per-package peer lookup. JSR expectations become the new maps. The importer lock check picks the line by importer path; the snapshot and installed-metadata tests assert both lines exist. Keep the superseded-matrix negative check.
- Make the `tests/unit/sdk-migration-guard.test.ts` test "accepts the baseline through LLM peer release lines…" per-package in the same way and rename it. Remove the comments explaining the older peer window.
- Do not touch shim, sdk or vite-plugin pins or fixture pins.
- Check: `npx vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/published-napplet-contract.test.ts` plus `pnpm build && pnpm type-check`. Commit `chore(deps): move host packages to core 0.38 and nap 0.37`, staged by path.

STEP B, the tracer (CONTEXT Types, Breaking changes, Runtime and ACL, Shell prelude): one text generation goes from a napplet through prelude, runtime, service, OpenAI stream mapping and Paja, and back as block deltas plus `content`.
- `llm-types.ts`: per CONTEXT Types, retire the mirror. Re-export every record and envelope type as `export type` from `@napplet/nap/llm/types`, keep `LLM_DOMAIN`, `LLM_ERROR_CODES`, `LlmServiceError` and local `LlmReply`, add `LlmBlockEvent`. Update `index.ts` per the interfaces block. The header cites the checked head and the 0.37.0 export.
- `llm-validate.ts`: the Generation validator becomes `{content, finish, usage?}` where content parts are text, thinking or toolCall, finish adds `toolUse`, and usage admits the three optional extras. Requirements admit `tools`. Add a helper returning concatenated text parts, used for the JSON-object check. Request-side tool fields arrive in Task 2; until then the exact-record check keeps rejecting them, which fails closed.
- `llm-service.ts`: `LlmConnection` gains the two fields. `sameConnection` compares them, `toModel` copies modes and emits `[]` when `tools` is false, `meetsRequirements` honours `tools`. `onDelta` takes `LlmBlockEvent`, assigns the contiguous `sequence`, adds `requestId`, builds the wire delta from known fields only and suppresses after settlement. The `format: "json"` check reads concatenated text parts on `stop`.
- New `llm-provider-blocks.ts`: a block builder owning `blockIndex` assignment for text and thinking blocks. A block gets its index and `start` on first appearance, fragments become `delta` events, `closeAll()` emits `end` for open blocks, and it produces terminal content ordered by `blockIndex`. Task 2 extends it with tool blocks.
- `llm-providers.ts` and `llm-provider-stream.ts`: `finished` and `completed` build `content` (text becomes one text part only when non-empty; refusal content is `[]`). All three accumulators return block events from `push` and emit `end` on the provider's normal completion marker. Process a chunk's content before its finish marker, because OpenAI and Gemini may carry both in one chunk. `readStream` in `llm-provider-http.ts` forwards each event while not aborted.
- `napplet-namespace.ts` `makeLlm`: `onDelta` receives the full structured delta (`requestId`, `sequence`, `event`, `block`, `blockIndex`, and `text`, `toolCallId`, `name` when valid). Accept it only when `sequence` is the next expected and the fields are valid for the event: `event` and `block` in their enums, `blockIndex` a non-negative integer, `text` a string on `delta` and absent otherwise, non-empty `toolCallId` and `name` on a `toolCall` `start` and absent otherwise. Helpers stay inside `makeLlm`, because the prelude is serialized. `generate` keeps returning a promise carrying `requestId`.
- `browser-llm-connections.ts` (CONTEXT Breaking changes, Paja): records gain the optional fields. `normalizeRecord` always emits `tools` and canonical `toolChoiceModes` (ordered `auto, none, required, tool`, de-duplicated, always including `auto, none` when on, `tools: false` with `[]` when off or absent), and the storage key is unchanged. `toConnection`, `meets` and `describeRequirements` honour tools. `countCharacters` handles the wider part union; Task 3 extends it. The provider callback forwards events.
- Runtime and ACL (CONTEXT Runtime and ACL): confirm `llm.delta` still gates by capability and nothing inspects delta or result text in `packages/runtime/src` or `packages/acl/src`. Update the fixtures in `llm-dispatch.test.ts` to the new shapes. Replace the previous checked head in comments in `llm-dispatch.test.ts`, `resolve.test.ts`, `llm-service.ts`, `llm-service.test.ts`, `napplet-namespace.test.ts` and `tests/e2e/paja-llm.spec.ts`.
- Tests: move existing service, provider, stream and Paja fixtures to the new shapes, using the spec's `g1` vector where it fits. In `napplet-namespace.test.ts`, use the spec's `g1` and streamed `g2` deltas, and keep the forged-source, wrong-request and out-of-order negatives, plus a malformed-delta negative (`text` on `start`, non-integer `blockIndex`, missing `toolCallId`). In `paja-llm.spec.ts`, the streaming test now expects `[0 start] [1 delta Hello] [2 delta ", napplet"] [3 end]`, a result with `content: [{type:'text', text:'Hello, napplet'}]`, and the first test's model includes `tools: false, toolChoiceModes: []`.

Commit `feat(services,shell,paja): carry NAP-LLM content and block deltas end to end`. Mark it breaking in the message body; the changeset comes in Task 3.
  </action>
  <verify>
    <automated>pnpm build &amp;&amp; pnpm type-check &amp;&amp; npx vitest run packages/services packages/shell packages/paja packages/runtime packages/acl tests/unit/napplet-package-alignment.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts &amp;&amp; npx playwright test tests/e2e/paja-llm.spec.ts --project chromium</automated>
  </verify>
  <done>Two commits exist. The first leaves only dependency, lock, guard and peer-row changes, and `pnpm install --frozen-lockfile` passes. The second proves in Chromium that a Paja napplet receives ordered block deltas and an authoritative `content` result. Removed draft shapes have no compatibility path.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Full tool turn in @kehto/services, with conformance by case ID</name>
  <files>packages/services/src/llm-validate.ts, packages/services/src/llm-service.ts, packages/services/src/llm-generation-checks.ts, packages/services/src/llm-providers.ts, packages/services/src/llm-provider-shared.ts, packages/services/src/llm-provider-blocks.ts, packages/services/src/llm-provider-openai.ts, packages/services/src/llm-provider-anthropic.ts, packages/services/src/llm-provider-gemini.ts, packages/services/src/llm-provider-stream.ts, packages/services/src/llm-provider-http.ts, packages/services/src/llm-service-tools.test.ts, packages/services/src/llm-provider-tools.test.ts</files>
  <behavior>
    Name tests by ID, using spec example vectors (`g1`, `g2`, `g3`, the streamed `g2` deltas, `g4`) wherever they fit.
    - LLM-C02: every new record field, explicit null and invalid type is invalid-request with zero `generate` calls. A cyclic or heavily shared `arguments` or `parameters` value also answers invalid-request promptly.
    - LLM-C03: `tools` on a `!tools` connection, `Requirements.tools` with no match, and a historical call on a `!tools` connection are unsupported with zero consent and zero generation.
    - LLM-C09: zero-based contiguous sequence across blocks; one terminal; none after it.
    - LLM-C10: length and refusal stay partial; `toolUse` with no call is provider-error; `format: "json"` on `stop` checks concatenated text.
    - LLM-C12: multiple calls with one result omitted is invalid-request, no generation.
    - LLM-C13: `g4` forced name where the provider returns plain text or another name is provider-error.
    - LLM-C14: a provider without a call id gets one synthesized, identical in deltas and terminal, and the matching `toolResult` round-trips through the validator and builder.
    - LLM-C15: `stop` with calls becomes `toolUse` in all three dialects and in the service; a parallel turn truncated or refused after one completed call keeps its finish and has no `toolCall` parts.
    - LLM-C16: malformed arguments, non-object arguments and unknown names are provider-error, and the error message contains no provider body (assert a planted secret is absent).
    - LLM-C17: thinking is omitted from provider input and a message left empty is dropped; `requiresOpaqueReasoning: true` with `toolCall` history is unsupported; a `gemini-3-pro` model defaults to it, explicit `false` overrides, `gemini-2.5-flash` does not.
    - LLM-C18: interleaved OpenAI tool-call fragments yield start with id and name, an ordered lifecycle, fragments parsing to final arguments, and the service calls `generate` exactly once (nothing executes from a provisional block).
    - LLM-C19: an unlisted mode is unsupported with no consent, no substitution and no generation.
    - LLM-C20: duplicate names, invalid names, missing tools for an explicit choice, unknown forced name, non-object schema, malformed schema and zero `maxTokens` are invalid-request.
    - LLM-C21: misplaced, duplicate, orphaned and name-mismatched results, and a conversation ending on unanswered calls, are invalid-request. Completed history without `tools` is accepted on a tools connection (OpenAI, Gemini), Anthropic answers unsupported, and a new call in that response is provider-error.
    - LLM-C22: image tool results are unsupported on OpenAI and Gemini and allowed on Anthropic; `isError` maps to `is_error: true` on Anthropic and to the prefix on OpenAI and Gemini.
    - LLM-C23 (service half): with tools and results in the request, declined consent answers user-cancelled, `authorize` saw the tool definitions and results, and `generate` ran zero times.
    - Lifecycle: second start, delta or end before start, kind change, event after end, text on non-delta, missing id or name on a toolCall start, and a block still open at `stop` or `toolUse` each fail with provider-error and send no further deltas. A stream/terminal mismatch in kind, text, id, name or arguments is provider-error; `length` and `refusal` skip the check.
  </behavior>
  <action>
Write the behaviour above as failing tests in `llm-service-tools.test.ts` and `llm-provider-tools.test.ts`, then implement. Commit at each green checkpoint below. Keep every file under the 700 non-blank LOC ceiling, functions under 150 LOC, nesting under 5, params under 6, and avoid double-casts through unknown (aislop flags them).

CHECKPOINT 1, behaviour-preserving split (CONTEXT Provider dialects). Move each dialect's builder, parser and accumulator into `llm-provider-openai.ts`, `llm-provider-anthropic.ts` and `llm-provider-gemini.ts`, with shared helpers (`providerError`, `unsupported`, `record`, `usageFrom`, `completed`, `finished`, header and base-URL helpers, and the endpoint and request types) in `llm-provider-shared.ts`. `llm-providers.ts` stays the public façade for `buildLlmProviderRequest`, `parseLlmProviderResponse` and the exported types; `llm-provider-stream.ts` keeps `createLlmStreamAccumulator` and `readLlmSseData`. Dependency direction is dialect to shared and blocks, façades to dialects, with no cycles. Commit `refactor(services): split NAP-LLM provider dialects`.

CHECKPOINT 2, request gates (CONTEXT Service, first two bullets). In `llm-validate.ts`, role-discriminated message records with the placement rules, tool and toolChoice records, `maxTokens`, `temperature`, and a conversation walk enforcing unique call ids, adjacency, exactly-one answers, name match and no unanswered tail. The dependency-free structural JSON Schema check is the CONTEXT's keyword list; note 2020-12 `items` is a single schema.

Gap the CONTEXT leaves open: `parameters` and `arguments` are the first napplet-supplied free-form values, and postMessage's structured clone can deliver cycles, heavily shared subgraphs and non-plain objects. `admitGeneration`'s `JSON.stringify` would then throw or hang. So add an `isJsonValue` check with a depth bound (cycles fail it) and a total node budget (shared subgraphs fail it), accepting only plain objects, arrays, strings, booleans, null and finite numbers. It runs before the size check, and both values must pass it before schema inspection.

Then add the `unsupported` checks of CONTEXT Service to `unsupportedInput`, ordered tools, then mode, then historical parts, then images, then JSON. An empty `tools` list counts as omitted. Commit.

CHECKPOINT 3, terminal and stream rules (CONTEXT Service, remaining bullets), in new `llm-generation-checks.ts`.
- `ActiveGeneration` holds the request rather than only `format`.
- Terminal order, on the raw result: for `length` and `refusal`, strip `toolCall` parts first so incomplete arguments are discarded rather than rejected; run the exact Generation shape check; for `stop` and `toolUse`, normalise finish and reject `toolUse` with no call; validate names against current `tools` (any call when none were sent fails), id uniqueness within the result and against request history, and mode rules; apply the `format: "json"` check on `stop`; match streamed blocks.
- The delta tracker validates each event and records kind, state and concatenated text per `blockIndex`. Any violation calls the generation's fail path with provider-error, never a silent drop.
- A block still open at a `stop` or `toolUse` terminal is a violation: the spec only lets error, cancellation, length or refusal end a block without `end`.
- Matching compares JSON values independent of key order.
Commit.

CHECKPOINT 4, dialects (CONTEXT Provider dialects, every bullet).
- A shared pre-flight in `buildLlmProviderRequest` runs before any dialect body: opaque-reasoning check, thinking omission, dropping emptied messages, and the dialect temperature range. `maxTokens` is the smaller of request and endpoint, with Anthropic's required default retained. Tool mapping, `tool_choice` forms, results and response parsing follow the CONTEXT per dialect. Usage extras go through `usageFrom`.
- Gaps the CONTEXT leaves open, decided here:
  - Gemini `functionResponse.response` is `{ output: text }`, with results regrouped into one user content in the assistant's call order, and `functionCall` and `functionResponse` carry no `id`, because a synthesized id has no provider meaning and order is the documented match (the spec permits regrouping).
  - Absent Gemini `args` and an empty OpenAI `arguments` string mean `{}`.
  - A no-native-flag `isError` result becomes one string on OpenAI and Gemini: the exact sentence, a newline, then the supplied text (text parts joined by newline). Several OpenAI-compatible servers accept only string tool content, and mapping parts to a provider's equivalent is permitted. Assert this exact string in LLM-C22.
  - Gemini `format: "json"` with non-empty `tools` is `unsupported`, a known API restriction that would otherwise surface as HTTP 400.
- Extend `llm-provider-blocks.ts` per CONTEXT "Streaming": tool blocks hold argument fragments until id and name are known. If the chunk that delivers the name has no id, synthesize once immediately, and ignore any id arriving afterwards so the value stays stable. A call with no fragments emits a single `{}` delta before `end`. Provider block indices map to Kehto indices, so a redacted Anthropic block consumes no index. Gemini whole-object calls emit start, one `JSON.stringify(args)` delta, end. Empty fragments are not emitted. On a completed turn, a call lacking a name or completion, or whose fragments do not parse to an object, makes `finish()` throw provider-error.

Commit `feat(services): implement NAP-LLM tool calls, thinking and usage extras`. The runtime never executes a tool call: add no code that acts on a `toolCall` beyond validating and relaying it.
  </action>
  <verify>
    <automated>npx vitest run packages/services &amp;&amp; pnpm --filter @kehto/services type-check &amp;&amp; pnpm build &amp;&amp; for n in 12 13 14 15 16 17 18 19 20 21 22 23; do grep -rq "LLM-C$n" packages/services/src || { echo "missing LLM-C$n"; exit 1; }; done</automated>
  </verify>
  <done>A service host fixture and all three dialects run a complete tool turn. Every case in the behaviour block has a test named by its ID. Paja still builds and its existing tests pass. Public export names are unchanged apart from additions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Paja tool support, end-to-end tool round trip, docs, changesets and final gates</name>
  <files>packages/paja/src/host-page.ts, packages/paja/src/host-page.test.ts, packages/paja/src/browser-llm-panel.ts, packages/paja/src/browser-llm-connections.ts, packages/paja/src/browser-llm-connections.test.ts, packages/paja/src/browser-confirmation-request.ts, packages/paja/src/browser-host-signer.ts, packages/paja/src/parity.test.ts, tests/e2e/paja-llm.spec.ts, tests/unit/nip5d-conformance-guard.test.ts, docs/llm.md, docs/compatibility.md, docs/policies/NIP-5D-CONFORMANCE.md, docs/packages/{paja,runtime,services,shell}.md, docs/how-tos/paja-getting-started.md, docs/how-tos/paja-local-authoring.md, RUNTIME-SPEC.md, packages/{acl,firewall,paja,runtime,services,shell}/README.md, .changeset/nap-llm-tools-content.md, .changeset/nap-llm-peer-window.md</files>
  <behavior>
    - Connections test: an old row with no tool fields loads as tools off with `[]` under the same storage key; canonical mode order and de-duplication; `auto, none` always present when on.
    - LLM-C03 (Paja): `authorize` on a dialect-unsupported request rejects `unsupported` with `confirm`, `requestUnlock` and the provider all uncalled.
    - LLM-C23 (Paja): the consent request carries tool names, tool count and tool result count, and `characters` includes tool result text, arguments and schemas; its JSON contains no tool result text or arguments; denial means the provider is uncalled.
    - E2E: the round trip in the action below, including the absence of tool data in the message log.
  </behavior>
  <action>
Paja editor (CONTEXT Paja). In `host-page.ts`, after the JSON checkbox, add `.llm-check` labels: `#paja-llm-tools` "Tool calling" and sub-options `#paja-llm-tool-required` "Required tool choice" and `#paja-llm-tool-named` "Named tool choice", with the sub-options disabled by default. Assert the ids in `host-page.test.ts`. In `browser-llm-panel.ts`, add them to `FormElements` and `readForm`, sync with a change listener (off clears and disables the sub-options; remove it in the existing disposers), build `tools` and `toolChoiceModes` in `submit`, append ` · tools` to the connection title, and add "tool calling" to the chooser's wanted list.

Consent. Add the interface-block fields to `browser-confirmation-request.ts`. In `browser-host-signer.ts`, the `llm` copy gains a tools line (count and names) and tool result count in the disclosed line. The audit log gets counts only (`tools: request.tools.length`, `toolResults`), never names, arguments or results, matching the existing comment's rule.

`createPajaLlmHost.authorize`, in this order: first `buildLlmProviderRequest` with a credential-free endpoint built by a shared `endpointFor(record, credential?)` that `generate` also uses, with `stream: true` so an `unsupported` throws here; then `ensureCredential`; then `confirm`. `countCharacters` counts text parts, tool result text, `JSON.stringify` of each tool call's arguments and of each tool definition; thinking is excluded because it never leaves the page. The warning names tool definitions and results as disclosed data.

E2E, `tests/e2e/paja-llm.spec.ts`. The stub's `/v1/chat/completions` now reads the POST body and records it. With `tools` and a last message not from the `tool` role, it streams a tool call: first chunk with `id: call_1` and name, then fragments `{"city":` and `"Berlin"}`, then `finish_reason: tool_calls`, then usage. With a last `tool` message, it streams text. Otherwise it keeps today's chunks. Extend `addConnection` with an options argument for the three checkboxes.

New test, using the spec's `g2`/`g3` vectors. Save a connection with all three checked. `select({tools:true})` returns `tools: true` and `toolChoiceModes: ['auto','none','required','tool']`. Stream `g2`: consent details contain `get_weather` and a tool count, and the dialog does not contain the prompt text. Assert the deltas equal the lifecycle `start` (with `toolCallId` and `name`), two `delta`s, `end`, and the result equals `{content:[{type:'toolCall',toolCallId:'call_1',name:'get_weather',arguments:{city:'Berlin'}}],finish:'toolUse',usage}`. Send `g3`: consent shows one tool result. The result is the stubbed text with `finish: 'stop'`. The recorded provider body has `{role:'tool',tool_call_id:'call_1',content:'18°C and clear'}`.

Assert exactly two provider POSTs (nothing executed a tool or continued alone), and that `#message-log` contains neither `Berlin` nor `18°C`. Also assert a denied generation with tool definitions records zero additional POSTs (LLM-C23).

Comments and baseline prose (CONTEXT Dependencies, Docs). Run `git grep -n '0\.32'` over docs, READMEs and source comments and classify each hit: statements about the fixture matrix or a historical release stay; statements about Kehto's development line or "installed" host types get corrected.
- Known hits: `docs/policies/NIP-5D-CONFORMANCE.md` near lines 39, 225, 249, 266 and 326; `RUNTIME-SPEC.md` rows 81-82 and lines 99, 158 (show host line and fixture line separately); `docs/compatibility.md` lines 99, 291; `docs/packages/services.md:125`; `docs/packages/paja.md:536`; `packages/paja/README.md:216`; `docs/how-tos/paja-local-authoring.md:308`; `tests/unit/nip5d-conformance-guard.test.ts:366`; `packages/shell/src/napplet-namespace.ts:1482`; `packages/paja/src/parity.test.ts:53`.
- `@napplet/nap@0.37.0` now exports `IntentCandidate` and related types, and core 0.38.0 declares `intent.onDelivery`. Do not absorb that migration. Correct false wording and record the follow-up in the SUMMARY.
- Do not break strings asserted by `tests/unit/nip5d-conformance-guard.test.ts` or `sdk-migration-guard.test.ts`, including the pinned NAP-INTENT authorities.

Docs (CONTEXT Docs).
- `docs/llm.md`: the intro cites the checked head, says types now come from `@napplet/nap/llm/types`, and gives the per-package peer windows. Update each layer bullet, and the Streaming section (fourth argument is a block event; `content` is authoritative). Add a "Tools, thinking and block deltas" section: lifecycle, Kehto never executes calls, `LlmConnection.tools` and `toolChoiceModes`, terminal rules, the dialect mapping table, the `isError` prefix mapping, tool-result image limits, Anthropic's historical-tools rule, thinking omission, usage extras, and `requiresOpaqueReasoning` with Gemini's model-name default and why (function-call continuation needs thought signatures this contract cannot represent, so a tool turn on such a model cannot continue). Say Kehto never enables Anthropic extended thinking. Update the host checklist, including preflighting `buildLlmProviderRequest` in `authorize`.
- The shared NAP-LLM paragraph in `docs/packages/{services,shell,runtime}.md` and `packages/{services,shell,runtime,paja}/README.md`: bump the checked head and add one sentence on tools and block deltas, generated with a node script so the copies stay identical.
- Peer paragraphs in `packages/{acl,firewall,runtime,services,shell}/README.md`: state that package's real peer window, that host packages develop on core 0.38.0 / nap 0.37.0, and that fixture napplets stay on the exact 0.32.0 line with shim 0.30.0, sdk 0.28.0, vite-plugin 0.16.2.
- Paja docs (`docs/packages/paja.md` Language models, `packages/paja/README.md`, `docs/how-tos/paja-getting-started.md`) cover the checkboxes and the consent disclosure.
- `docs/policies/NIP-5D-CONFORMANCE.md` LLM line: the checked head and result.
- `docs/compatibility.md`: add a short entry, modelled on the existing `ADDITIVE_TYPES` row, for the optional Paja connection fields. A row without them behaves exactly as a tools-off connection, the user has nothing to migrate and nothing retires, so no warning fires; cite the connections test by name. This records the persisted-format commitment AGENTS requires. The removed draft shapes get no entry, per CONTEXT.

Changesets: `.changeset/nap-llm-tools-content.md` with `minor` for `@kehto/services`, `@kehto/shell`, `@kehto/paja`, describing the breaking host API and the new contract; `.changeset/nap-llm-peer-window.md` with `patch` for `@kehto/acl`, `@kehto/cli`, `@kehto/firewall`, `@kehto/runtime`.

Recheck the draft: `gh api repos/napplet/naps/pulls/134 --jq .head.sha`. If it moved from the checked head, compare the delta, and record it in the SUMMARY rather than chasing it here.

Run the final gates in `<verification>`, fix what they find, and commit in atomic steps (`feat(paja): …`, `test(e2e): …`, `docs: …`, `chore: add changesets`). Write `261104-fjx-SUMMARY.md`.
  </action>
  <verify>
    <automated>pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm docs:check &amp;&amp; npx playwright test tests/e2e/paja-llm.spec.ts tests/e2e/paja-single-window.spec.ts --project chromium &amp;&amp; ! git grep -nE '3e10939|nap@0\.35|<0\.37\.0|Development stays on|baseline 0\.32' -- ':!*CHANGELOG.md' ':!.planning/**' ':!pnpm-lock.yaml'</automated>
  </verify>
  <done>A Paja user can opt a connection into tool calling, and a napplet completes a full tool turn in Chromium with consent disclosure and no execution by the host. Docs state the checked head and the correct baseline with no stale strings. Changesets exist for every package whose shipped output changed. All gates pass or any failure is named in the SUMMARY with its cause.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| napplet to runtime | Sandboxed, untrusted. `request` is structured-clone input and now includes free-form `parameters` and `arguments`. |
| provider to runtime | Untrusted responses and streams, including tool calls, ids, names and arguments. |
| runtime to provider | Disclosure of prompts, images, tool definitions and tool results; requires per-generation consent. |
| runtime to napplet | Tool calls and thinking are untrusted model output; the host relays them and never acts on them. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fjx-01 | E | services, shell, Paja acting on `toolCall` | high | mitigate | No executor exists. The service validates and relays only; LLM-C18 and the e2e round trip assert the provider is contacted once per napplet request, and docs state the rule. |
| T-fjx-02 | I | `createPajaLlmHost.authorize`, `runGeneration` | high | mitigate | Consent runs before `generate` and discloses tool names, tool count and result count. LLM-C23 at service and Paja level asserts zero submissions on decline. |
| T-fjx-03 | I | provider adapters and `failure()` | high | mitigate | Fixed safe messages only. LLM-C16 plants a secret in malformed provider output and asserts it is absent from the error. |
| T-fjx-04 | I | Paja message log and consent copy | medium | mitigate | The log records counts only. The dialog shows tool names and counts, never arguments or result text. The e2e asserts the log has no tool data; the connections test asserts no argument or result text in the request record. |
| T-fjx-05 | D | `isLlmGenerationRequest`, `admitGeneration` | high | mitigate | Cycles, heavily shared graphs or deep values via structured clone could overflow the stack or make `JSON.stringify` explode. `isJsonValue` enforces a depth bound and node budget before the size check, schema recursion is bounded, and LLM-C02 covers both shapes. |
| T-fjx-06 | T | provider-returned tool names, ids, arguments | high | mitigate | Names are checked against current `tools`, ids for uniqueness including history, mode rules and object arguments, all at terminal validation, answering provider-error (LLM-C13, C15, C16). Without `tools`, any call fails. |
| T-fjx-07 | T | stream to terminal consistency | medium | mitigate | The tracker fails lifecycle violations, and the terminal must match ended blocks at the same index, so a provider cannot stream one call and settle another. |
| T-fjx-08 | S | `makeLlm` delta receiver | medium | mitigate | The existing parent-source check stays. Sequence gating and per-event field validation reject forged, out-of-order and malformed deltas, covered by negatives in `napplet-namespace.test.ts`. |
| T-fjx-09 | I | Paja preflight | medium | mitigate | `authorize` builds the provider request with no credential and never sends it, so an `unsupported` cannot expose a key or trigger a vault prompt. |
| T-fjx-SC | T | npm and JSR version moves | low | accept | No new packages: `@napplet/core` and `@napplet/nap` are existing first-party dependencies, and the versions were confirmed in the CONTEXT spike. `pnpm install` only reconciles the lock, verified with `--frozen-lockfile`. No legitimacy checkpoint is needed because nothing new is introduced. |
</threat_model>

<verification>
Final gates, run in order from the worktree:

1. `pnpm build`
2. `pnpm type-check`
3. `pnpm test:unit`, including `tests/unit/nip5d-conformance-guard.test.ts` and `packages/paja/src/parity.test.ts`
4. `pnpm docs:check` (typedoc treats warnings as errors; re-export any type it flags)
5. `npx playwright test tests/e2e/paja-llm.spec.ts --project chromium`
6. `pnpm test:e2e`, because this change touches Paja and shell wiring (allow up to ten minutes). `paja-single-window.spec.ts` "keeps canonical INC protected" must stay green with shim 0.30.0. If the full run cannot complete locally, say so plainly in the SUMMARY.
7. `npx -y aislop@0.12.0 ci` and parse the JSON diagnostics: baseline score 94-96, no new findings in changed files.
8. `git diff --check origin/main...HEAD`
9. Stale-string grep from Task 3's verify, plus `pnpm install --frozen-lockfile`.

Compare any `pnpm test:unit` failure with `origin/main` before calling it baseline. Name it in the SUMMARY either way.
</verification>

<success_criteria>
- Every NAP-LLM conformance case changed or added at the checked head (C02, C03, C09, C10, C12..C23) has a test naming it, in services or Paja, and the case list in the Task 2 verify passes.
- A tool turn completes through the real Paja host in Chromium, and the host contacts the provider only when the napplet asks.
- Host packages are on core 0.38.0 / nap 0.37.0, peers follow the CONTEXT per-package windows, and fixture and shim pins are unchanged and guarded.
- `llm-types.ts` no longer mirrors upstream, and every previously exported type is still exported from `@kehto/services`.
- No file exceeds 700 non-blank LOC because of this change.
- The SUMMARY records: the spec ref checked and the result (conformant at `5e93bdfce0e84c0de728234cb7b3feed498f8635`, or the delta if the draft moved); known gaps, namely the out-of-scope shim 0.36 migration with the `paja-single-window.spec.ts` "keeps canonical INC protected" failure it causes, and Gemini 3+ tool continuation answering `unsupported`; the follow-up to adopt nap 0.37's intent types; the observation that `@kehto/cli` keeps its 0.32 peer floor per CONTEXT while depending on `@kehto/paja`, whose floor is 0.38, so a consumer below that floor sees a transitive peer warning; verification output; anything not run.
</success_criteria>

<output>
Create `.planning/quick/261104-fjx-chase-nap-llm-draft-across-kehto/261104-fjx-SUMMARY.md` when done. Do not edit `.planning/STATE.md`, push or open a PR.
</output>
</content>
