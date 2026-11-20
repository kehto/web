/**
 * OpenAI Responses dialect: request, response and stream mapping, tools included.
 *
 * The adapter is stateless. Every request carries the full conversation in
 * `input` with `store: false`, and it never sends `previous_response_id`, so no
 * turn depends on state the provider keeps. Wire shapes follow the API
 * reference and the official SDK types (`openai@7.62.0`, `resources/responses`).
 */

import { createLlmBlockBuilder, toolCallParts } from './llm-provider-blocks.js';
import {
  TOOL_FAILED, callsOf, completed, credentialHeaders, finished, hasImage, isCompletedFinish, outputLimit, parametersOf, plainParts, providerError, record, splitSystem, toolResultText, toolsOf, trimBase, unsupported, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmBlockEvent, LlmFinish, LlmGeneration, LlmGenerationRequest, LlmMessage, LlmOutputPart, LlmPart, LlmTool, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';
const FAILED = 'The provider reported a failed response.';
const DEFAULT_NAMESPACE = { name: 'napplet', description: 'Functions supplied by the calling application.' };

type Json = Record<string, unknown>;

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function inputContent(parts: readonly LlmPart[]): unknown[] {
  return plainParts(parts).map((part) => part.type === 'text'
    ? { type: 'input_text', text: part.text }
    : { type: 'input_image', image_url: `data:${part.mimeType};base64,${part.data}`, detail: 'auto' });
}

/**
 * A text-only result is one string. A result with an image is a content list,
 * and with no native error flag a failed one leads with the specified sentence
 * as its own text part (LLM-C22).
 */
function resultOutput(message: LlmMessage): unknown {
  if (!hasImage(message.content)) return toolResultText(message);
  const content = inputContent(message.content);
  return message.isError === true ? [{ type: 'input_text', text: TOOL_FAILED }, ...content] : content;
}

/** Assistant history in part order: adjacent text becomes one message, each call its own item. */
function assistantItems(message: LlmMessage, namespace: string | undefined): unknown[] {
  const items: unknown[] = [];
  let text = '';
  const flush = (): void => {
    if (text !== '') items.push({ type: 'message', role: 'assistant', content: text });
    text = '';
  };
  for (const part of message.content) {
    if (part.type === 'text') { text += part.text; continue; }
    if (part.type !== 'toolCall') throw unsupported('This provider does not accept images in assistant messages.');
    flush();
    items.push({
      type: 'function_call', call_id: part.toolCallId, name: part.name, arguments: JSON.stringify(part.arguments),
      ...(namespace === undefined ? {} : { namespace }),
    });
  }
  flush();
  return items;
}

function inputItems(turns: readonly LlmMessage[], namespace: string | undefined): unknown[] {
  return turns.flatMap((turn) => {
    if (turn.role === 'assistant') return assistantItems(turn, namespace);
    if (turn.role === 'toolResult') return [{ type: 'function_call_output', call_id: turn.toolCallId, output: resultOutput(turn) }];
    return [{ type: 'message', role: 'user', content: inputContent(turn.content) }];
  });
}

/** `strict: false` sends the schema as written instead of opting into the provider's stricter schema subset. */
function functionTool(tool: LlmTool): Json {
  return { type: 'function', name: tool.name, ...(tool.description === undefined ? {} : { description: tool.description }), parameters: parametersOf(tool), strict: false };
}

/**
 * Limits of subscription-backed access tokens that a request field cannot be
 * mapped around. They are reported instead of silently dropping the field.
 */
function checkSignInLimits(request: LlmGenerationRequest, limit: number | undefined, hasTools: boolean): void {
  if (limit !== undefined) throw unsupported('This route does not accept an output token limit.');
  if (request.temperature !== undefined) throw unsupported('This route does not accept a sampling temperature.');
  // The documented named choice carries no namespace, so a namespaced tool cannot be forced.
  if (typeof request.toolChoice === 'object') throw unsupported('This route cannot force a named tool.');
  // A historical call names its namespace, which only exists while tools are declared.
  if (!hasTools && request.messages.some((message) => callsOf(message).length > 0)) {
    throw unsupported('This route needs tool definitions to continue a conversation that contains tool calls.');
  }
}

/** Map a NAP-LLM request to a Responses request. */
export function buildOpenAiResponses(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const options = endpoint.responses ?? {};
  const signIn = options.profile === 'chatgpt-sign-in';
  const tools = toolsOf(request);
  const limit = outputLimit(endpoint, request);
  if (signIn) checkSignInLimits(request, limit, tools.length > 0);
  const group = signIn ? options.toolNamespace ?? DEFAULT_NAMESPACE : undefined;
  const { system, turns } = splitSystem(request.messages);
  const input = inputItems(turns, group?.name);
  if (input.length === 0) throw unsupported('This provider requires at least one user or assistant message.');
  const body: Json = { model: endpoint.model, input, stream: stream || signIn, store: false };
  if (system) body.instructions = system;
  if (request.format === 'json') body.text = { format: { type: 'json_object' } };
  if (limit !== undefined) body.max_output_tokens = limit;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (options.reasoningSummary !== undefined) body.reasoning = { summary: options.reasoningSummary };
  if (tools.length > 0) {
    const functions = tools.map(functionTool);
    body.tools = group ? [{ type: 'namespace', name: group.name, description: group.description, tools: functions }] : functions;
    const choice = request.toolChoice;
    if (choice !== undefined) body.tool_choice = typeof choice === 'string' ? choice : { type: 'function', name: choice.name };
  }
  return {
    url: `${trimBase(endpoint.baseUrl)}/responses`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

function responsesUsage(value: unknown): LlmUsage | undefined {
  const usage = record(value);
  const input = record(usage?.input_tokens_details);
  return usageFrom(usage?.input_tokens, usage?.output_tokens, {
    cacheReadTokens: input?.cached_tokens,
    cacheWriteTokens: input?.cache_write_tokens,
    reasoningTokens: record(usage?.output_tokens_details)?.reasoning_tokens,
  });
}

/** @internal Map a Response's `status` and incomplete reason; `null` means no recognised marker. */
export function openAiResponsesFinish(response: Json): LlmFinish | null {
  if (response.status === 'completed') return 'stop';
  if (response.status !== 'incomplete') return null;
  const reason = record(response.incomplete_details)?.reason;
  if (reason === 'max_output_tokens') return 'length';
  return reason === 'content_filter' ? 'refusal' : null;
}

/**
 * Output items in order. Each non-empty reasoning summary or reasoning text is
 * one thinking part, each non-empty `output_text` one text part and each
 * `function_call` one call, which is the grouping the stream uses for blocks.
 */
function outputParts(output: readonly unknown[], partial: boolean): { content: LlmOutputPart[]; refused: boolean } {
  const content: LlmOutputPart[] = [];
  let refused = false;
  for (const item of output) {
    const entry = record(item);
    if (entry?.type === 'function_call') {
      content.push(...toolCallParts(partial, [{ id: entry.call_id, name: entry.name, args: entry.arguments }]));
    } else if (entry?.type === 'reasoning') {
      for (const part of [...listOf(entry.summary), ...listOf(entry.content)]) {
        const text = textField(record(part)?.text);
        if (text !== '') content.push({ type: 'thinking', text });
      }
    } else if (entry?.type === 'message') {
      for (const part of listOf(entry.content)) {
        const piece = record(part);
        if (piece?.type === 'refusal') refused = true;
        else if (piece?.type === 'output_text' && textField(piece.text) !== '') content.push({ type: 'text', text: textField(piece.text) });
      }
    }
  }
  return { content, refused };
}

/** Map a Response object to a NAP-LLM Generation. */
export function parseOpenAiResponses(json: unknown): LlmGeneration {
  const root = record(json);
  if (!root || !Array.isArray(root.output)) throw providerError('The provider response had no output items.');
  if (root.status === 'failed') throw providerError(FAILED);
  const tokens = responsesUsage(root.usage);
  const finish = openAiResponsesFinish(root);
  const { content, refused } = outputParts(root.output, finish === 'length' || finish === 'refusal');
  return refused ? finished([], 'refusal', tokens) : completed(content, finish, tokens);
}

/**
 * Fold Responses stream events into block events and a Generation.
 *
 * The terminal event's `output` array is authoritative. When a server leaves it
 * empty, the result is assembled from the streamed items instead.
 */
export function openAiResponsesAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  const streamed = new Set<string>();
  let refused = false;
  let terminal: Json | null = null;

  function fragment(kind: 'text' | 'thinking', key: string, text: string): LlmBlockEvent[] {
    if (text !== '') streamed.add(key);
    return blocks.append(kind, key, text);
  }

  /** End a block, first sending its whole text when no fragment preceded it. */
  function settle(kind: 'text' | 'thinking', key: string, text: unknown): LlmBlockEvent[] {
    return [...(streamed.has(key) ? [] : fragment(kind, key, textField(text))), ...blocks.end(key)];
  }

  function itemDone(index: string, item: Json | null): LlmBlockEvent[] {
    if (item?.type === 'function_call') {
      const key = `call:${index}`;
      const whole = streamed.has(key) ? undefined : item.arguments;
      streamed.add(key);
      return [...blocks.toolDelta(key, { id: item.call_id, name: item.name, fragment: whole }), ...blocks.end(key)];
    }
    if (item?.type === 'reasoning') {
      return [
        ...listOf(item.summary).flatMap((part, position) => settle('thinking', `summary:${index}:${position}`, record(part)?.text)),
        ...listOf(item.content).flatMap((part, position) => settle('thinking', `reasoning:${index}:${position}`, record(part)?.text)),
      ];
    }
    if (item?.type !== 'message') return [];
    return listOf(item.content).flatMap((part, position) => {
      const piece = record(part);
      if (piece?.type === 'refusal') refused = true;
      return piece?.type === 'output_text' ? settle('text', `text:${index}:${position}`, piece.text) : [];
    });
  }

  /** The event type is the completion marker when a server omits the nested status. */
  function settleResponse(status: string, response: Json): LlmBlockEvent[] {
    terminal = { ...response, status: typeof response.status === 'string' ? response.status : status };
    return blocks.closeAll();
  }

  function push(event: unknown): LlmBlockEvent[] {
    const root = record(event);
    const index = String(root?.output_index);
    switch (root?.type) {
      case 'error': throw providerError(STREAM_ERROR);
      case 'response.failed': throw providerError(FAILED);
      case 'response.output_item.added': {
        const item = record(root.item);
        return item?.type === 'function_call' ? blocks.toolDelta(`call:${index}`, { id: item.call_id, name: item.name }) : [];
      }
      case 'response.function_call_arguments.delta':
        if (textField(root.delta) !== '') streamed.add(`call:${index}`);
        return blocks.toolDelta(`call:${index}`, { fragment: root.delta });
      case 'response.output_text.delta': return fragment('text', `text:${index}:${String(root.content_index)}`, textField(root.delta));
      case 'response.output_text.done': return settle('text', `text:${index}:${String(root.content_index)}`, root.text);
      case 'response.reasoning_summary_text.delta': return fragment('thinking', `summary:${index}:${String(root.summary_index)}`, textField(root.delta));
      case 'response.reasoning_summary_text.done': return settle('thinking', `summary:${index}:${String(root.summary_index)}`, root.text);
      case 'response.reasoning_text.delta': return fragment('thinking', `reasoning:${index}:${String(root.content_index)}`, textField(root.delta));
      case 'response.reasoning_text.done': return settle('thinking', `reasoning:${index}:${String(root.content_index)}`, root.text);
      case 'response.refusal.delta': refused = true; return [];
      case 'response.output_item.done': return itemDone(index, record(root.item));
      case 'response.completed':
      case 'response.incomplete':
        return settleResponse(root.type === 'response.completed' ? 'completed' : 'incomplete', record(root.response) ?? {});
      default: return [];
    }
  }

  function finish(): LlmGeneration {
    if (terminal === null) return completed([], null, undefined);
    if (refused) return finished([], 'refusal', responsesUsage(terminal.usage));
    if (listOf(terminal.output).length > 0) return parseOpenAiResponses(terminal);
    const marker = openAiResponsesFinish(terminal);
    return completed(blocks.content(isCompletedFinish(marker)), marker, responsesUsage(terminal.usage));
  }

  return { push, finish };
}
