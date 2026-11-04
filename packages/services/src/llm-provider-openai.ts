/** OpenAI Chat Completions dialect: request, response and stream mapping, tools included. */

import { createLlmBlockBuilder, toolCallParts, type RawToolCall } from './llm-provider-blocks.js';
import {
  callsOf, completed, credentialHeaders, finished, hasImage, isCompletedFinish, nonCallParts, outputLimit, parametersOf, plainParts, providerError, record, textContent, toolResultText, toolsOf, trimBase, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmMessage, LlmOutputPart, LlmPart, LlmToolChoice, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function openAiContent(parts: readonly LlmPart[]): unknown {
  const plain = plainParts(parts);
  if (!hasImage(plain)) return plain.map((part) => part.type === 'text' ? part.text : '').join('');
  return plain.map((part) => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } });
}

function openAiMessage(message: LlmMessage): Record<string, unknown> {
  if (message.role === 'toolResult') return { role: 'tool', tool_call_id: message.toolCallId, content: toolResultText(message) };
  if (message.role !== 'assistant') return { role: message.role, content: openAiContent(message.content) };
  const calls = callsOf(message);
  const parts = nonCallParts(message);
  const entry: Record<string, unknown> = { role: 'assistant', content: parts.length === 0 && calls.length > 0 ? null : openAiContent(parts) };
  if (calls.length > 0) {
    entry.tool_calls = calls.map((call) => ({ id: call.toolCallId, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } }));
  }
  return entry;
}

function openAiToolChoice(choice: LlmToolChoice): unknown {
  return typeof choice === 'string' ? choice : { type: 'function', function: { name: choice.name } };
}

/** Map a NAP-LLM request to a Chat Completions request. */
export function buildOpenAiChat(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages: request.messages.map(openAiMessage),
    stream,
  };
  if (stream) body.stream_options = { include_usage: true };
  if (request.format === 'json') body.response_format = { type: 'json_object' };
  const limit = outputLimit(endpoint, request);
  if (limit !== undefined) body.max_tokens = limit;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const tools = toolsOf(request);
  if (tools.length > 0) {
    body.tools = tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, ...(tool.description === undefined ? {} : { description: tool.description }), parameters: parametersOf(tool) },
    }));
    if (request.toolChoice !== undefined) body.tool_choice = openAiToolChoice(request.toolChoice);
  }
  return {
    url: `${trimBase(endpoint.baseUrl)}/chat/completions`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

function openAiUsage(value: unknown): LlmUsage | undefined {
  const usage = record(value);
  return usageFrom(usage?.prompt_tokens, usage?.completion_tokens, {
    cacheReadTokens: record(usage?.prompt_tokens_details)?.cached_tokens,
    reasoningTokens: record(usage?.completion_tokens_details)?.reasoning_tokens,
  });
}

/** Reasoning text some OpenAI-compatible servers return next to the answer. */
function reasoningOf(source: Record<string, unknown> | null): string {
  return textField(source?.reasoning_content) || textField(source?.reasoning);
}

function rawCallsOf(message: Record<string, unknown>): RawToolCall[] {
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  return calls.map((call) => {
    const entry = record(call);
    const fn = record(entry?.function);
    return { id: entry?.id, name: fn?.name, args: fn?.arguments };
  });
}

/** Map a Chat Completions response to a NAP-LLM Generation. */
export function parseOpenAiChat(json: unknown): LlmGeneration {
  const root = record(json);
  const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
  const message = record(choice?.message);
  if (!choice || !message) throw providerError('The provider response had no completion choice.');
  const tokens = openAiUsage(root?.usage);
  if (typeof message.refusal === 'string' && message.refusal.length > 0) return finished([], 'refusal', tokens);
  const finish = openAiFinish(choice.finish_reason);
  const content: LlmOutputPart[] = [];
  const thinking = reasoningOf(message);
  if (thinking !== '') content.push({ type: 'thinking', text: thinking });
  content.push(...textContent(typeof message.content === 'string' ? message.content : ''));
  content.push(...toolCallParts(finish === 'length' || finish === 'refusal', rawCallsOf(message)));
  return completed(content, finish, tokens);
}

/** @internal Map an OpenAI `finish_reason`; `null` means no recognised marker. */
export function openAiFinish(reason: unknown): LlmFinish | null {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  if (reason === 'tool_calls' || reason === 'function_call') return 'toolUse';
  return reason === 'content_filter' ? 'refusal' : null;
}

/** Fold Chat Completions stream chunks into block events and a Generation. */
export function openAiAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let refused = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      usage = openAiUsage(root?.usage) ?? usage;
      const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
      if (!choice) return [];
      const delta = record(choice.delta);
      if (textField(delta?.refusal).length > 0) refused = true;
      // Content precedes the finish marker: one chunk may carry both.
      const events = [
        ...blocks.append('thinking', 'thinking', reasoningOf(delta)),
        ...blocks.append('text', 'text', textField(delta?.content)),
      ];
      const calls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];
      calls.forEach((call, position) => {
        const entry = record(call);
        const fn = record(entry?.function);
        events.push(...blocks.toolDelta(String(entry?.index ?? position), { id: entry?.id, name: fn?.name, fragment: fn?.arguments }));
      });
      finish = openAiFinish(choice.finish_reason) ?? finish;
      if (finish !== null) events.push(...blocks.closeAll());
      return events;
    },
    finish: () => refused ? completed([], 'refusal', usage) : completed(blocks.content(isCompletedFinish(finish)), finish, usage),
  };
}
