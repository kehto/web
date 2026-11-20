import { createLlmService, type LlmConnection, type LlmGenerateHooks, type LlmGeneration, type LlmGenerationRequest } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

/** The one model connection the simulated host offers. */
const CONNECTION: LlmConnection = Object.freeze({
  id: 'conformance-connection',
  name: 'Conformance model',
  model: 'conformance-1',
  route: 'Conformance host → in-memory provider',
  images: false,
  json: true,
  tools: true,
  toolChoiceModes: Object.freeze(['auto', 'none', 'required', 'tool'] as const),
}) as LlmConnection;

const TEXT_REPLY = ['Hello from ', 'the conformance model.'];
const JSON_REPLY = ['{"greeting":', '"Hello"}'];

function lastUserText(request: LlmGenerationRequest): string {
  const user = [...request.messages].reverse().find((message) => message.role === 'user');
  return (user?.content ?? []).map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function streamText(hooks: LlmGenerateHooks, fragments: readonly string[]): LlmGeneration {
  hooks.onDelta({ event: 'start', block: 'text', blockIndex: 0 });
  for (const text of fragments) hooks.onDelta({ event: 'delta', block: 'text', blockIndex: 0, text });
  hooks.onDelta({ event: 'end', block: 'text', blockIndex: 0 });
  return { content: [{ type: 'text', text: fragments.join('') }], finish: 'stop', usage: { inputTokens: 12, outputTokens: 7 } };
}

/**
 * A completed tool call that the provider labels with its normal `stop`
 * finish. NAP-LLM requires the runtime to report it as `toolUse`.
 */
function streamToolCall(hooks: LlmGenerateHooks, name: string): LlmGeneration {
  const args = { city: 'Berlin' };
  hooks.onDelta({ event: 'start', block: 'toolCall', blockIndex: 0, toolCallId: 'call_1', name });
  hooks.onDelta({ event: 'delta', block: 'toolCall', blockIndex: 0, text: JSON.stringify(args) });
  hooks.onDelta({ event: 'end', block: 'toolCall', blockIndex: 0 });
  return { content: [{ type: 'toolCall', toolCallId: 'call_1', name, arguments: args }], finish: 'stop', usage: { inputTokens: 31, outputTokens: 12 } };
}

/**
 * NAP-LLM backend: the reference LLM service over an in-memory provider.
 *
 * Selection and disclosure consent are granted without a prompt. Handles are
 * `h1`, `h2`, ... in selection order. The provider streams every output: a
 * tool call (labelled `stop`) when the last user message contains `TOOL` and
 * tools are offered, a JSON object for `format: "json"`, plain text otherwise.
 * `llm.generations` reads back the requests the provider received.
 */
export const LLM_BACKEND: DomainBackendModule = {
  domain: 'llm',
  create() {
    let handles = 0;
    const generations: { windowId: string; messages: number; tools: number }[] = [];
    const service = createLlmService({
      createHandle: () => `h${handles += 1}`,
      host: {
        select: () => CONNECTION,
        describe: (_context, connectionId) => (connectionId === CONNECTION.id ? CONNECTION : null),
        authorize: () => true,
        async generate(context, _connection, request, hooks) {
          generations.push({ windowId: context.windowId, messages: request.messages.length, tools: request.tools?.length ?? 0 });
          const tool = request.tools?.[0];
          if (tool && lastUserText(request).includes('TOOL')) return streamToolCall(hooks, tool.name);
          return streamText(hooks, request.format === 'json' ? JSON_REPLY : TEXT_REPLY);
        },
      },
    });
    return {
      services: { llm: service },
      adapter: { llm: { isAvailable: () => true, isConfigured: () => true } },
      controls: {
        'llm.generations': () => generations.map((item) => ({ ...item })),
      },
    };
  },
};
