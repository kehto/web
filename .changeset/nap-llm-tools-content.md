---
"@kehto/services": minor
"@kehto/shell": minor
"@kehto/paja": minor
"@kehto/cli": minor
---

Track NAP-LLM (napplet/naps PR #134 at `5e93bdfce0e84c0de728234cb7b3feed498f8635`) end to end. This is a breaking host API on the 0.x draft contract, with no compatibility path for the removed shapes.

- Tool calls and results, `thinking` parts, `maxTokens`, `temperature`, `tools`, `toolChoice`, `Model.tools`, `Model.toolChoiceModes`, `Requirements.tools` and extended `Usage` are supported. Kehto validates and relays tool calls and never executes one.
- `Generation.text` is replaced by `Generation.content` parts and text-only deltas by `start`/`delta`/`end` block events. The shell prelude forwards the full structured delta, and only for the next sequence with valid fields.
- `@kehto/services`: `LlmConnection` gains required `tools` and `toolChoiceModes`; `LlmGenerateHooks.onDelta` and the `createHttpLlmProvider` callback take a block event while the service assigns `sequence` and `requestId`; `llm-types` re-exports the packaged `@napplet/nap/llm/types`. Provider endpoints accept `requiresOpaqueReasoning` (Gemini 3+ defaults it on), and the dialects map tools, reasoning and usage extras.
- `@kehto/paja`: connections can opt into tool calling (rows saved earlier load as tools off under the same storage key), consent discloses tool definitions and tool results, and a dialect restriction answers `unsupported` before any prompt.
- Host packages now build on `@napplet/core` 0.38.0 and `@napplet/nap` 0.37.0; `@kehto/services`, `@kehto/paja` and `@kehto/cli` (through its Paja dependency) require them.
