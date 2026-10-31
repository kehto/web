# Language models

This non-normative integration guide defers to the living [NAP-LLM proposal](https://github.com/napplet/naps/pull/134) (checked at `3e10939cf788878bbdcc022c101f0ac6193f316c`) and [NIP-5D](https://github.com/nostr-protocol/nips/pull/2303). The published `@napplet/nap@0.32.0` line has no `llm` subpath yet; Kehto mirrors the upstream `feat/nap-llm` draft types in `@kehto/services` and will switch to `@napplet/nap/llm/types` once it ships.

## What each layer owns

- **`@kehto/acl`** maps every `llm.*` request to one `llm:generate` grant and gates results and `llm.delta` pushes by the same recipient capability. A grant never replaces per-generation consent.
- **`@kehto/runtime`** dispatches the `llm` domain to a registered `llm` service. Without one, each sanctioned request receives exactly one `llm.<op>.result` carrying `{ code: 'unsupported', message }`; ACL denials use the same shape instead of a bare `.error` string.
- **`@kehto/services`** exports `createLlmService({ host })`. The service owns schema checks (`invalid-request`), endpoint-scoped opaque handles, revalidation (`selection-expired`), capability checks (`unsupported`), consent before any prompt leaves the runtime (`user-cancelled`), duplicate active ids, concurrency and size policy (`quota-exceeded`), cancellation and deadline races, zero-based ordered deltas, one terminal result per request, and safe `provider-error` messages that never echo provider bodies. Hosts implement `LlmConnectionHost` (`select`, `describe`, `authorize`, `generate`, optional `subscribe`). Pure wire mappers (`buildLlmProviderRequest`, `parseLlmProviderResponse`) cover the OpenAI Chat Completions dialect, the Anthropic Messages API and Google Gemini `generateContent`; `createHttpLlmProvider()` performs one buffered POST and `LLM_PROVIDER_PRESETS` lists common hosted and local endpoints.
- **`@kehto/shell`** advertises `llm` as a service-only domain and injects `window.napplet.llm` with `select`, `describe`, `generate` (returns a promise carrying `requestId`, accepts `{ signal, onDelta }`) and `cancel`. Result errors reject with an `Error` whose `code` is the NAP-LLM failure code. `getShellDomainState(hooks, domain)` reports `supported`, `unconfigured` or `disabled` for host UIs; `ShellAdapter.llm` carries `isAvailable()` and optional `isConfigured()`.
- **`@kehto/paja`** stores connection metadata in `localStorage`, keeps API keys in an AES-GCM vault keyed by PBKDF2-SHA-256 (600 000 iterations) from a user password or in a session-only tier, shows the chooser for `llm.select`, asks for disclosure consent before every generation, and paints the Interfaces toggle yellow with a warning glyph while no connection exists.
- **Playground** registers a local echo host so demos exercise the wire without credentials.

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

Anthropic has no native JSON mode; Kehto appends a JSON-object instruction to the system prompt and still validates the completed text as a JSON object. Anthropic and Gemini reject images in system messages, and Anthropic requires the first turn to be the user's; both are reported as `unsupported` before any request is built.

## Host checklist

1. Implement `LlmConnectionHost`; throw `new LlmServiceError('unsupported', …)` when no compatible connection exists and return `null` when the user declines.
2. Register `createLlmService({ host })` as `services.llm` and expose `llm: { isAvailable, isConfigured }` on the shell adapter.
3. Ask for consent in `authorize` with the napplet identity, route, model, disclosed counts and a charge warning. Treat model output as untrusted text; never execute provider tool calls through this domain.
4. Keep credentials behind the host: hand them to `createHttpLlmProvider` endpoints only.
