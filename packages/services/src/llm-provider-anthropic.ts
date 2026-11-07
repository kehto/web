/** Anthropic Messages dialect: request, response and stream mapping, tools included. */

import { createLlmBlockBuilder, toolCallParts, type RawToolCall } from './llm-provider-blocks.js';
import {
  ANTHROPIC_VERSION, DEFAULT_MAX_OUTPUT_TOKENS, JSON_INSTRUCTION, completed, credentialHeaders, isCompletedFinish, outputLimit, parametersOf, plainParts, providerError, record, splitSystem, textContent, toolsOf, trimBase, unsupported, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import { hasLlmToolHistory } from './llm-validate.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmMessage, LlmOutputPart, LlmPart, LlmToolChoice, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** @internal Map an Anthropic `stop_reason`; `null` means no recognised marker. */
export function anthropicFinish(reason: unknown): LlmFinish | null {
  if (reason === 'end_turn' || reason === 'stop_sequence') return 'stop';
  if (reason === 'max_tokens') return 'length';
  if (reason === 'tool_use') return 'toolUse';
  return reason === 'refusal' ? 'refusal' : null;
}

function anthropicBlocks(parts: readonly LlmPart[]): unknown[] {
  return parts.map((part) => {
    switch (part.type) {
      case 'text': return { type: 'text', text: part.text };
      case 'toolCall': return { type: 'tool_use', id: part.toolCallId, name: part.name, input: part.arguments };
      case 'image': return { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } };
      default: throw unsupported('This provider mapping does not accept this content part.');
    }
  });
}

function anthropicTurn(message: LlmMessage): { role: 'user' | 'assistant'; content: unknown[] } {
  if (message.role === 'assistant') return { role: 'assistant', content: anthropicBlocks(message.content) };
  if (message.role !== 'toolResult') return { role: 'user', content: anthropicBlocks(message.content) };
  // The API has a native error flag and accepts text and image result content.
  const result = {
    type: 'tool_result',
    tool_use_id: message.toolCallId,
    content: anthropicBlocks(plainParts(message.content)),
    ...(message.isError === true ? { is_error: true } : {}),
  };
  return { role: 'user', content: [result] };
}

function anthropicToolChoice(choice: LlmToolChoice): unknown {
  if (choice === 'required') return { type: 'any' };
  return typeof choice === 'string' ? { type: choice } : { type: 'tool', name: choice.name };
}

/** Map a NAP-LLM request to an Anthropic Messages request. */
export function buildAnthropicMessages(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const tools = toolsOf(request);
  if (tools.length === 0 && hasLlmToolHistory(request.messages)) {
    throw unsupported('This provider needs tool definitions to continue a conversation that contains tool calls.');
  }
  const { system, turns } = splitSystem(request.messages);
  if (turns.length === 0 || turns[0]!.role === 'assistant' || turns[0]!.role === 'toolResult') {
    throw unsupported('This provider requires the first non-system message to come from the user.');
  }
  // Consecutive same-role turns merge; tool results precede later user text because they come first.
  const merged: Array<{ role: 'user' | 'assistant'; content: unknown[] }> = [];
  for (const turn of turns) {
    const next = anthropicTurn(turn);
    const previous = merged.at(-1);
    if (previous && previous.role === next.role) previous.content.push(...next.content);
    else merged.push(next);
  }
  const systemText = request.format === 'json' ? [system, JSON_INSTRUCTION].filter(Boolean).join('\n') : system;
  const body: Record<string, unknown> = {
    model: endpoint.model,
    max_tokens: outputLimit(endpoint, request) ?? DEFAULT_MAX_OUTPUT_TOKENS,
    messages: merged,
    stream,
  };
  if (systemText) body.system = systemText;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (tools.length > 0) {
    body.tools = tools.map((tool) => ({
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      input_schema: parametersOf(tool),
    }));
    if (request.toolChoice !== undefined) body.tool_choice = anthropicToolChoice(request.toolChoice);
  }
  return {
    url: `${trimBase(endpoint.baseUrl)}/messages`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      ...endpoint.headers,
      ...credentialHeaders(endpoint),
    },
    body: JSON.stringify(body),
  };
}

function anthropicUsage(usage: Record<string, unknown> | null): LlmUsage | undefined {
  return usageFrom(usage?.input_tokens, usage?.output_tokens, {
    cacheReadTokens: usage?.cache_read_input_tokens,
    cacheWriteTokens: usage?.cache_creation_input_tokens,
  });
}

/** Map an Anthropic Messages response to a NAP-LLM Generation. Redacted reasoning blocks are omitted. */
export function parseAnthropicMessages(json: unknown): LlmGeneration {
  const root = record(json);
  if (!root || !Array.isArray(root.content)) throw providerError('The provider response had no content blocks.');
  const finish = anthropicFinish(root.stop_reason);
  const partial = finish === 'length' || finish === 'refusal';
  const content: LlmOutputPart[] = [];
  for (const block of root.content) {
    const entry = record(block);
    const previous = content.at(-1);
    if (entry?.type === 'text' && typeof entry.text === 'string') {
      if (previous?.type === 'text') previous.text += entry.text;
      else content.push(...textContent(entry.text));
    } else if (entry?.type === 'thinking' && typeof entry.thinking === 'string' && entry.thinking !== '') {
      content.push({ type: 'thinking', text: entry.thinking });
    } else if (entry?.type === 'tool_use') {
      const raw: RawToolCall = { id: entry.id, name: entry.name, args: entry.input };
      content.push(...toolCallParts(partial, [raw]));
    }
  }
  return completed(content, finish, anthropicUsage(record(root.usage)));
}

/** Fold Anthropic Messages stream events into block events and a Generation. */
export function anthropicAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let finish: LlmFinish | null = null;
  let start: Record<string, unknown> | null = null;
  let delta: Record<string, unknown> | null = null;
  return {
    push(event) {
      const root = record(event);
      const key = String(root?.index);
      switch (root?.type) {
        case 'error': throw providerError(STREAM_ERROR);
        case 'message_start': start = record(record(root.message)?.usage); return [];
        case 'message_delta':
          finish = anthropicFinish(record(root.delta)?.stop_reason) ?? finish;
          delta = { ...delta, ...record(root.usage) };
          return [];
        case 'content_block_start': {
          const block = record(root.content_block);
          if (block?.type !== 'tool_use') return [];
          return blocks.toolDelta(key, { id: block.id, name: block.name });
        }
        case 'content_block_delta': {
          const part = record(root.delta);
          if (part?.type === 'text_delta') return blocks.append('text', key, textField(part.text));
          if (part?.type === 'thinking_delta') return blocks.append('thinking', key, textField(part.thinking));
          return part?.type === 'input_json_delta' ? blocks.toolDelta(key, { fragment: part.partial_json }) : [];
        }
        case 'content_block_stop': return blocks.end(key);
        case 'message_stop': return blocks.closeAll();
        default: return [];
      }
    },
    finish: () => completed(blocks.content(isCompletedFinish(finish)), finish, anthropicUsage({ ...start, ...delta })),
  };
}
