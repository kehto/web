/** Anthropic Messages dialect: request, response and stream mapping. */

import { createLlmBlockBuilder } from './llm-provider-blocks.js';
import {
  ANTHROPIC_VERSION, DEFAULT_MAX_OUTPUT_TOKENS, JSON_INSTRUCTION, completed, credentialHeaders, plainParts, providerError, record, splitSystem, textContent, trimBase, unsupported, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmPart } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** @internal Map an Anthropic `stop_reason`; `null` means no recognised marker. */
export function anthropicFinish(reason: unknown): LlmFinish | null {
  if (reason === 'end_turn' || reason === 'stop_sequence') return 'stop';
  if (reason === 'max_tokens') return 'length';
  return reason === 'refusal' ? 'refusal' : null;
}

function anthropicBlocks(parts: readonly LlmPart[]): unknown[] {
  return plainParts(parts).map((part) => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } });
}

export function buildAnthropicMessages(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const { system, turns } = splitSystem(request.messages);
  if (turns.length === 0 || turns[0]!.role !== 'user') throw unsupported('This provider requires the first non-system message to come from the user.');
  const merged: Array<{ role: 'user' | 'assistant'; content: unknown[] }> = [];
  for (const turn of turns) {
    const previous = merged.at(-1);
    const blocks = anthropicBlocks(turn.content);
    if (previous && previous.role === turn.role) previous.content.push(...blocks);
    else merged.push({ role: turn.role as 'user' | 'assistant', content: blocks });
  }
  const systemText = request.format === 'json' ? [system, JSON_INSTRUCTION].filter(Boolean).join('\n') : system;
  const body: Record<string, unknown> = {
    model: endpoint.model,
    max_tokens: endpoint.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    messages: merged,
    stream,
  };
  if (systemText) body.system = systemText;
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

export function parseAnthropicMessages(json: unknown): LlmGeneration {
  const root = record(json);
  if (!root || !Array.isArray(root.content)) throw providerError('The provider response had no content blocks.');
  const text = root.content.map((block) => { const entry = record(block); return entry?.type === 'text' && typeof entry.text === 'string' ? entry.text : ''; }).join('');
  const usage = record(root.usage);
  const tokens = usageFrom(usage?.input_tokens, usage?.output_tokens);
  return completed(textContent(text), anthropicFinish(root.stop_reason), tokens);
}

export function anthropicAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let finish: LlmFinish | null = null;
  let inputTokens: unknown;
  let outputTokens: unknown;
  return {
    push(event) {
      const root = record(event);
      switch (root?.type) {
        case 'error': throw providerError(STREAM_ERROR);
        case 'message_start': inputTokens = record(record(root.message)?.usage)?.input_tokens; return [];
        case 'message_delta': {
          finish = anthropicFinish(record(root.delta)?.stop_reason) ?? finish;
          const usage = record(root.usage);
          if (usage?.output_tokens !== undefined) outputTokens = usage.output_tokens;
          if (usage?.input_tokens !== undefined) inputTokens = usage.input_tokens;
          return [];
        }
        case 'content_block_delta': {
          const delta = record(root.delta);
          return delta?.type === 'text_delta' ? blocks.append('text', `${String(root.index)}`, textField(delta.text)) : [];
        }
        case 'content_block_stop': return blocks.end(`${String(root.index)}`);
        case 'message_stop': return blocks.closeAll();
        default: return [];
      }
    },
    finish: () => completed(blocks.content(), finish, usageFrom(inputTokens, outputTokens)),
  };
}

