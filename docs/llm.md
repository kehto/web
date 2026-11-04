# Language models

This non-normative integration guide defers to the living [NAP-LLM proposal](https://github.com/napplet/naps/pull/134) (checked at `5e93bdfce0e84c0de728234cb7b3feed498f8635`) and [NIP-5D](https://github.com/nostr-protocol/nips/pull/2303). Kehto's host packages develop and build on `@napplet/core@0.38.0` and `@napplet/nap@0.37.0`, so `@kehto/services` re-exports the record and envelope types from `@napplet/nap/llm/types` instead of mirroring the draft. Peer windows are per package: `@kehto/services` and `@kehto/paja` require core `>=0.38.0 <0.39.0` and nap `>=0.37.0 <0.38.0` because their declarations import those types; `@kehto/acl`, `@kehto/cli`, `@kehto/runtime` and `@kehto/shell` admit core `>=0.32.0 <0.39.0` and nap `>=0.32.0 <0.38.0`, and `@kehto/firewall` admits core `>=0.32.0 <0.39.0`. Fixture napplets stay on the exact 0.32.0 line with shim 0.30.0, sdk 0.28.0 and vite-plugin 0.16.2.

This revision is a clean break from the earlier draft: results carry `content` parts rather than `text`, streamed output is a block lifecycle rather than text fragments, and `LlmConnection`, `LlmGenerateHooks.onDelta` and the `createHttpLlmProvider` callback changed accordingly. No compatibility path is kept for the removed shapes.

## What each layer owns

- **`@kehto/acl`** maps every `llm.*` request to one `llm:generate` grant and gates results and `llm.delta` pushes by the same recipient capability. A grant never replaces per-generation consent.
- **`@kehto/runtime`** dispatches the `llm` domain to a registered `llm` service. Without one, each sanctioned request receives exactly one `llm.<op>.result` carrying `{ code: 'unsupported', message }`; ACL denials use the same shape instead of a bare `.error` string.
- **`@kehto/services`** exports `createLlmService({ host })`. The service owns schema checks (`invalid-request`), endpoint-scoped opaque handles, revalidation (`selection-expired`), capability checks (`unsupported`), consent before any prompt leaves the runtime (`user-cancelled`), duplicate active ids, concurrency and size policy (`quota-exceeded`), a per-window bound on live handles (`maxHandlesPerWindow`, default 32, least recently used evicted to `selection-expired`), cancellation and deadline races, the tool, history and delta rules described under [Tools, thinking and block deltas](#tools-thinking-and-block-deltas), zero-based ordered deltas, one terminal result per request, and safe `provider-error` messages that never echo provider bodies. Hosts implement `LlmConnectionHost` (`select`, `describe`, `authorize`, `generate`, optional `subscribe`); `select` and `authorize` receive an optional `{ signal }` that aborts when the request dies before the user answers. Pure wire mappers (`buildLlmProviderRequest`, `parseLlmProviderResponse`) cover the OpenAI Chat Completions dialect, the Anthropic Messages API and Google Gemini `generateContent`; `createHttpLlmProvider()` performs one buffered POST, `createHttpLlmProvider({ stream: true })` streams provider output into `onDelta` as block events, and `LLM_PROVIDER_PRESETS` lists common hosted and local endpoints.
- **`@kehto/shell`** advertises `llm` as a service-only domain and injects `window.napplet.llm` with `select`, `describe`, `generate` (returns a promise carrying `requestId`, accepts `{ signal, onDelta }`; `onDelta` receives the full structured delta, and only the next sequence with valid fields) and `cancel`. Result errors reject with an `Error` whose `code` is the NAP-LLM failure code. `getShellDomainState(hooks, domain)` reports `supported`, `unconfigured` or `disabled` for host UIs; `ShellAdapter.llm` carries `isAvailable()` and optional `isConfigured()`.
- **`@kehto/paja`** stores connection metadata in `localStorage`, keeps API keys in an AES-GCM vault keyed by PBKDF2-SHA-256 (600 000 iterations) from a user password or in a session-only tier, shows the chooser for `llm.select`, asks for disclosure consent before every generation, closes either prompt when its request is cancelled, times out or is revoked, streams provider output as `llm.delta`, lets the user mark a connection as tool-capable (with optional required and named tool choice), discloses tool definitions and tool results in the consent dialog, and paints the Interfaces toggle yellow with a warning glyph while no connection exists.

## The unconfigured state

Runtime support alone no longer decides whether a domain is useful: a host may have the service wired while the user has configured no model connection. Kehto keeps NIP-5D advertisement binary (domain presence) and adds a host-facing third state:

| State | Advertised | Meaning |
|-------|------------|---------|
| `supported` | yes | Ready to serve requests. |
| `unconfigured` | yes | The host needs user setup. The first `llm.select` prompts the user to configure; until a connection exists the napplet receives `unsupported` and should offer a retry. |
| `disabled` | no | The host disabled the domain or its backend is not live. |

Paja renders `unconfigured` as a yellow `⚠ llm` toggle in Interfaces. Clicking it disables the interface instead; adding a connection in **Language models** turns it green without a reload.

## Credentials

Keys are optional to remember. A remembered key is encrypted before it touches storage; only the salt, IV, KDF parameters and ciphertext are persisted. Plaintext exists in memory while the vault is unlocked and is placed solely on the provider request to the connection's own base URL (HTTPS, or HTTP only for loopback hosts). Keys never enter the message log, consent dialogs, result envelopes or napplets. Locking the vault, clearing it or changing connections expires every live handle.

## Common provider APIs

| Preset | Dialect | Credential header |
|--------|---------|-------------------|
| OpenAI, OpenRouter, Groq, Mistral, DeepSeek, xAI, Together AI, Fireworks AI, Perplexity | OpenAI Chat Completions | `Authorization: Bearer` |
| Azure OpenAI | OpenAI Chat Completions | `api-key` |
| Anthropic | Messages API | `x-api-key` (plus `anthropic-version` and the direct-browser-access header) |
| Google Gemini | `generateContent` | `x-goog-api-key` |
| Ollama, LM Studio, llama.cpp server, vLLM | OpenAI Chat Completions on loopback | none by default |
| Routstr (`routstrd` on `:8008`) | OpenAI Chat Completions on loopback, `/v1/models` for listing | none by default |

Switching provider presets clears the unsaved API key before contacting the new
provider. Auto-filled connection names follow the preset; custom names stay intact.
After saving a Routstr connection, the model catalogue stays available to add another.

Model listing is a plain `GET <baseUrl><modelsPath>` from the host page, so it
is subject to browser CORS like any other page request. A loopback daemon that
answers generation but omits `access-control-allow-origin` on its listing route
fails the dropdown, and Paja says so instead of showing an empty select. Failed Routstr model discovery also shows an [Install routstrd](https://routstr.com/routstrd) link below the error; retrying or switching providers clears it.

## Streaming

Deltas are optional in NAP-LLM. `createHttpLlmProvider({ stream: true })` requests each dialect's server-sent-event form (OpenAI and Anthropic `stream: true`, with OpenAI `stream_options.include_usage`; Gemini `streamGenerateContent?alt=sse`) and calls its fourth argument with each block lifecycle event (`{ event, block, blockIndex, text?, toolCallId?, name? }`). The service assigns the contiguous `sequence` and the `requestId`, validates the lifecycle and routes the delta, so a host supplies neither. Wire it to the service hooks:

```ts
const provider = createHttpLlmProvider({ stream: true });
const host: LlmConnectionHost = {
  // …select, describe, authorize…
  generate: (_ctx, connection, request, hooks) => provider(endpointFor(connection), request, hooks.signal, hooks.onDelta),
};
```

The resolved generation (complete `content`, `finish`, `usage`) matches the buffered path, and it stays authoritative over the provisional deltas: a caller replaces its provisional content with the result's `content` rather than appending. A stream error event or a stream that ends without a completion marker is `provider-error`; partial deltas already sent remain incomplete. A server that answers a stream request with a JSON body is accepted with no deltas. `readLlmSseData` and `createLlmStreamAccumulator` are exported for hosts with their own transport.

## Prompt lifetime and handle limits

The service passes `select` and `authorize` an optional trailing `{ signal }`. It aborts only when the service settles the request without the host's answer: `llm.cancel`, the deadline, handle invalidation or eviction, `revokeWindow`, window destruction or service unregistration. Close the chooser or consent dialog when it aborts; any later answer is ignored. A selection still open when handles are invalidated answers `selection-expired` at once, and one open during revocation answers `cancelled`.

NAP-LLM has no message that releases a handle, so the service bounds live handles per window (`maxHandlesPerWindow`, default 32) rather than refusing new selections. A successful `describe` or generation refreshes a handle. Selecting beyond the bound evicts the least recently used handle, which then answers `selection-expired`, so the napplet selects again. A generation whose consent prompt is open on an evicted or invalidated handle fails `selection-expired` immediately and its prompt is withdrawn.

## Tools, thinking and block deltas

NAP-LLM carries tool **calls and results** so a napplet can run an agentic turn; it never lets the runtime run one. Kehto validates and relays a `toolCall` part and does nothing else with it: no code path in services, shell or Paja executes a call, and the e2e suite asserts the provider is contacted once per napplet request. The napplet owns execution and any separately authorized capability it needs.

**Capabilities.** `LlmConnection` gains `tools: boolean` and `toolChoiceModes` (a subset of `auto`, `none`, `required`, `tool`, always including `auto` and `none` when `tools` is true). The service reports `toolChoiceModes: []` whenever `tools` is false and treats a change to either field as a changed connection. `Requirements.tools: true` only matches a tool-capable connection.

**Request rules.** The service answers `invalid-request` for malformed records before anything else: non-positive or non-integer `maxTokens`, non-finite `temperature`, tool names outside `^[A-Za-z0-9_-]{1,64}$`, duplicate names, a `toolChoice` without non-empty `tools`, a forced name that is not listed, `parameters` without root `type: "object"` or that is structurally malformed JSON Schema (a dependency-free check of the 2020-12 keywords; unknown keywords pass), misplaced `thinking`, `toolCall`, `toolCallId`, `toolName` or `isError`, and any history where a call lacks exactly one name-matching `toolResult` immediately after its assistant turn (call ids must be unique across the conversation, and a conversation may not end on unanswered calls). `parameters` and `arguments` are the first napplet-supplied free-form values, so they pass a depth bound and a visit budget first: cycles, heavily shared graphs and non-plain objects are `invalid-request` rather than a hang.

**Unsupported before consent.** In order: `tools` on a connection without tool support; a tool-choice mode the connection does not list (no substitution); historical `toolCall` or `toolResult` on a connection without tool support; an image anywhere, tool results included, on a connection without image support; `format: "json"` without JSON support. Completed history may be sent without current `tools` on a tools connection; any call in that response is `provider-error`.

**Terminal rules.** `finish: "toolUse"` is the only result that carries executable calls, and a completed `stop` that contains a call is normalised to `toolUse`. `toolUse` without a call is `provider-error`. `length` and `refusal` keep their finish and lose any `toolCall` part, because incomplete arguments are discarded rather than rejected. A completed turn answers `provider-error`, with no raw body, for an unknown tool name (any call when no tools were sent), a duplicate call id within the result or against history, a violated tool-choice mode (`none` with a call, `required` or a named choice without one, a named choice with another name), non-object arguments, or a `format: "json"` `stop` whose concatenated text parts do not parse to an object.

**Block deltas.** A block has one `start`, zero or more `delta` events and one `end`; blocks may interleave and keep a stable kind and index. A `toolCall` `start` carries `toolCallId` and `name`, so an id and name are known before the argument fragments. Any lifecycle violation (a second `start`, a `delta` or `end` before `start`, a kind change, an event after `end`, `text` outside a `delta`, a missing id or name) fails the generation with `provider-error` and sends no further deltas. At a `stop` or `toolUse` terminal every streamed block must have ended and must match the result at the same index: equal kind and text, equal id and name, and fragments that parse to the same `arguments` object whatever the key order. `length` and `refusal` skip that check. Execution never starts from a delta.

**Provider ids.** A provider that omits a call id gets one synthesized once (`call_` plus a UUID), identical in the deltas and the terminal result; the napplet reuses it in its history and in the matching `toolResult`.

**Dialect mapping.**

| | OpenAI Chat Completions | Anthropic Messages | Gemini `generateContent` |
|-|-|-|-|
| Tool definitions | `tools[].function.parameters` | `tools[].input_schema` | `functionDeclarations[].parametersJsonSchema` |
| Choice | `auto` / `none` / `required` / `{type:"function",function:{name}}` | `auto` / `none` / `any` / `{type:"tool",name}` | `functionCallingConfig` `AUTO` / `NONE` / `ANY` (+ `allowedFunctionNames`) |
| Assistant call | `tool_calls` with `JSON.stringify(arguments)` | `tool_use` block | `functionCall` part |
| Result | `{role:"tool",tool_call_id,content}` | `tool_result` block merged into a user turn | one user content of `functionResponse` parts in the assistant's call order, `{output}` payload, no ids |
| `isError` | prefix text | native `is_error` | prefix text |
| Image in a tool result | `unsupported` | allowed | `unsupported` |
| History without current `tools` | sent | `unsupported` (the API needs definitions) | sent |
| Reasoning | `reasoning_content` / `reasoning` | `thinking` blocks (redacted blocks are omitted and consume no index) | parts with `thought: true` |
| Usage extras | `cached_tokens`, `reasoning_tokens` | `cache_read_input_tokens`, `cache_creation_input_tokens` | `cachedContentTokenCount`, `thoughtsTokenCount` |
| `temperature` range | 0 to 2 | 0 to 1 | 0 to 2 |

Without a native error flag, `isError: true` is the exact sentence `Tool execution failed.`, a newline, then the supplied text (text parts joined by newlines). `maxTokens` sends the smaller of the request and the endpoint ceiling, and Anthropic keeps its required default when both are absent. Gemini cannot combine `format: "json"` with tools, which is reported as `unsupported` instead of surfacing as an HTTP 400. A tool without `parameters` is sent as `{"type":"object","properties":{},"additionalProperties":false}`.

**Thinking.** `thinking` is display-only. It is omitted from provider input when assistant history is replayed, and a message that leaves empty is dropped. Kehto never enables Anthropic extended thinking, so no signed reasoning blocks arise there. Some providers need opaque reasoning state to continue a function-calling turn. `LlmProviderEndpoint.requiresOpaqueReasoning` marks such an endpoint, and a conversation containing `toolCall` parts is then `unsupported` before any request is built rather than silently restarting the reasoning loop. Gemini defaults the flag on for model names matching `gemini-3` and later (with or without a `models/` prefix) because their function-call continuation needs thought signatures this contract cannot represent, so a tool turn on such a model cannot be continued; an explicit value overrides the default.

**Paja.** The connection editor has a **Tool calling** checkbox with **Required tool choice** and **Named tool choice** sub-options (disabled until tools is on). Stored `toolChoiceModes` is canonical (`auto`, `none`, `required`, `tool`, de-duplicated). Rows saved before tool support load as tool support off under the same storage key. Consent lists tool definition names and counts tool results; the message log records counts only. `authorize` builds the provider request with no credential before any vault unlock or consent prompt, so a dialect restriction answers `unsupported` without a pointless dialog.

## Provider notes

Anthropic has no native JSON mode; Kehto appends a JSON-object instruction to the system prompt and still validates the completed text as a JSON object. Anthropic and Gemini reject images in system messages, and Anthropic requires the first turn to be the user's; both are reported as `unsupported` before any request is built (Paja checks this before it asks for consent).

## Host checklist

1. Implement `LlmConnectionHost`; throw `new LlmServiceError('unsupported', …)` when no compatible connection exists and return `null` when the user declines.
2. Register `createLlmService({ host })` as `services.llm` and expose `llm: { isAvailable, isConfigured }` on the shell adapter.
3. Ask for consent in `authorize` with the napplet identity, route, model, disclosed counts, tool definition names, the tool result count and a charge warning, after preflighting `buildLlmProviderRequest` with no credential so provider-specific `unsupported` answers come before any prompt, and close the dialog when `options.signal` aborts (likewise for the `select` chooser). Treat model output as untrusted text; never execute provider tool calls through this domain.
4. Keep credentials behind the host: hand them to `createHttpLlmProvider` endpoints only.
