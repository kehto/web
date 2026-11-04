/** OpenAI Chat Completions dialect: request, response and stream mapping. */

import { createLlmBlockBuilder } from './llm-provider-blocks.js';
import {
  completed, credentialHeaders, finished, hasImage, plainParts, providerError, record, textContent, textOf, trimBase, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmPart, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function openAiContent(parts: readonly LlmPart[]): unknown {
  if (!hasImage(parts)) return textOf(parts);
  return plainParts(parts).map((part) => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } });
}

export function buildOpenAiChat(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages: request.messages.map((message) => ({ role: message.role, content: openAiContent(message.content) })),
    stream,
  };
  if (stream) body.stream_options = { include_usage: true };
  if (request.format === 'json') body.response_format = { type: 'json_object' };
  if (endpoint.maxOutputTokens !== undefined) body.max_tokens = endpoint.maxOutputTokens;
  return {
    url: `${trimBase(endpoint.baseUrl)}/chat/completions`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

export function parseOpenAiChat(json: unknown): LlmGeneration {
  const root = record(json);
  const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
  const message = record(choice?.message);
  if (!choice || !message) throw providerError('The provider response had no completion choice.');
  const usage = record(root?.usage);
  const tokens = usageFrom(usage?.prompt_tokens, usage?.completion_tokens);
  if (typeof message.refusal === 'string' && message.refusal.length > 0) return finished([], 'refusal', tokens);
  const text = typeof message.content === 'string' ? message.content : '';
  return completed(textContent(text), openAiFinish(choice.finish_reason), tokens);
}

/** @internal Map an OpenAI `finish_reason`; `null` means no recognised marker. */
export function openAiFinish(reason: unknown): LlmFinish | null {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  return reason === 'content_filter' ? 'refusal' : null;
}

export function openAiAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let refused = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      const reported = record(root?.usage);
      if (reported) usage = usageFrom(reported.prompt_tokens, reported.completion_tokens) ?? usage;
      const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
      if (!choice) return [];
      const delta = record(choice.delta);
      if (textField(delta?.refusal).length > 0) refused = true;
      // Content precedes the finish marker: one chunk may carry both.
      const events = blocks.append('text', 'text', textField(delta?.content));
      finish = openAiFinish(choice.finish_reason) ?? finish;
      if (finish !== null) events.push(...blocks.closeAll());
      return events;
    },
    finish: () => refused ? completed([], 'refusal', usage) : completed(blocks.content(), finish, usage),
  };
}

