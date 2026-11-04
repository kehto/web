/** Google Gemini `generateContent` dialect: request, response and stream mapping, tools included. */

import { createLlmBlockBuilder, toolCallParts, type RawToolCall } from './llm-provider-blocks.js';
import {
  callsOf, completed, credentialHeaders, finished, isCompletedFinish, outputLimit, parametersOf, plainParts, providerError, record, splitSystem, textContent, toolResultText, toolsOf, trimBase, unsupported, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmMessage, LlmOutputPart, LlmPart, LlmToolChoice, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';
const GEMINI_REFUSALS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function geminiParts(parts: readonly LlmPart[]): unknown[] {
  return parts.map((part) => {
    switch (part.type) {
      case 'text': return { text: part.text };
      case 'toolCall': return { functionCall: { name: part.name, args: part.arguments } };
      case 'image': return { inlineData: { mimeType: part.mimeType, data: part.data } };
      default: throw unsupported('This provider mapping does not accept this content part.');
    }
  });
}

/**
 * Gemini wants one user content holding every function response, in the order
 * the model called them. NAP-LLM allows results in any order and permits the
 * runtime to regroup them. A synthesized call id has no meaning to the
 * provider, so responses carry the tool name only.
 */
function geminiResults(results: readonly LlmMessage[], callOrder: readonly string[]): unknown {
  const ordered = [...results].sort((a, b) => callOrder.indexOf(a.toolCallId ?? '') - callOrder.indexOf(b.toolCallId ?? ''));
  return {
    role: 'user',
    parts: ordered.map((result) => ({ functionResponse: { name: result.toolName, response: { output: toolResultText(result) } } })),
  };
}

function geminiContents(turns: readonly LlmMessage[]): unknown[] {
  const contents: unknown[] = [];
  let callOrder: string[] = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index]!;
    if (turn.role === 'toolResult') {
      const group = [turn];
      while (turns[index + 1]?.role === 'toolResult') { index += 1; group.push(turns[index]!); }
      contents.push(geminiResults(group, callOrder));
      continue;
    }
    if (turn.role === 'assistant') callOrder = callsOf(turn).map((call) => call.toolCallId);
    contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: geminiParts(turn.role === 'assistant' ? turn.content : plainParts(turn.content)) });
  }
  return contents;
}

function geminiToolConfig(choice: LlmToolChoice): unknown {
  if (choice === 'auto') return { functionCallingConfig: { mode: 'AUTO' } };
  if (choice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
  if (choice === 'required') return { functionCallingConfig: { mode: 'ANY' } };
  return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [choice.name] } };
}

/** Map a NAP-LLM request to a Gemini `generateContent` request. */
export function buildGemini(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const { system, turns } = splitSystem(request.messages);
  if (turns.length === 0) throw unsupported('This provider requires at least one user or assistant message.');
  const tools = toolsOf(request);
  // The API rejects JSON mode together with function declarations.
  if (request.format === 'json' && tools.length > 0) throw unsupported('This provider cannot combine JSON-object output with tool calling.');
  const generationConfig: Record<string, unknown> = {};
  if (request.format === 'json') generationConfig.responseMimeType = 'application/json';
  const limit = outputLimit(endpoint, request);
  if (limit !== undefined) generationConfig.maxOutputTokens = limit;
  if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
  const body: Record<string, unknown> = { contents: geminiContents(turns) };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
  if (tools.length > 0) {
    body.tools = [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        ...(tool.description === undefined ? {} : { description: tool.description }),
        parametersJsonSchema: parametersOf(tool),
      })),
    }];
    if (request.toolChoice !== undefined) body.toolConfig = geminiToolConfig(request.toolChoice);
  }
  return {
    url: `${trimBase(endpoint.baseUrl)}/models/${encodeURIComponent(endpoint.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

function geminiUsage(value: unknown): LlmUsage | undefined {
  const usage = record(value);
  return usageFrom(usage?.promptTokenCount, usage?.candidatesTokenCount, {
    cacheReadTokens: usage?.cachedContentTokenCount,
    reasoningTokens: usage?.thoughtsTokenCount,
  });
}

function partsOf(candidate: Record<string, unknown>): Array<Record<string, unknown>> {
  const parts = record(candidate.content)?.parts;
  return Array.isArray(parts) ? parts.flatMap((part) => { const entry = record(part); return entry ? [entry] : []; }) : [];
}

/** Map a Gemini response to a NAP-LLM Generation. */
export function parseGemini(json: unknown): LlmGeneration {
  const root = record(json);
  const tokens = geminiUsage(root?.usageMetadata);
  if (typeof record(root?.promptFeedback)?.blockReason === 'string') return finished([], 'refusal', tokens);
  const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
  if (!candidate) throw providerError('The provider response had no candidate.');
  const finish = geminiFinish(candidate.finishReason);
  const partial = finish === 'length' || finish === 'refusal';
  const content: LlmOutputPart[] = [];
  for (const part of partsOf(candidate)) {
    const call = record(part.functionCall);
    if (call) {
      const raw: RawToolCall = { id: call.id, name: call.name, args: call.args };
      content.push(...toolCallParts(partial, [raw]));
      continue;
    }
    const kind = part.thought === true ? 'thinking' : 'text';
    const text = textField(part.text);
    const previous = content.at(-1);
    if (text === '') continue;
    if (previous?.type === kind) previous.text += text;
    else content.push(...(kind === 'text' ? textContent(text) : [{ type: 'thinking' as const, text }]));
  }
  return completed(content, finish, tokens);
}

/** @internal Map a Gemini `finishReason`; `null` means no recognised marker. */
export function geminiFinish(reason: unknown): LlmFinish | null {
  if (reason === 'STOP') return 'stop';
  if (reason === 'MAX_TOKENS') return 'length';
  return typeof reason === 'string' && GEMINI_REFUSALS.has(reason) ? 'refusal' : null;
}

/** Fold `streamGenerateContent` events into block events and a Generation. */
export function geminiAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let blocked = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  let calls = 0;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      usage = geminiUsage(root?.usageMetadata) ?? usage;
      if (typeof record(root?.promptFeedback)?.blockReason === 'string') blocked = true;
      const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
      if (!candidate) return [];
      const events = [];
      for (const part of partsOf(candidate)) {
        const call = record(part.functionCall);
        if (call) {
          // Gemini sends each function call whole.
          calls += 1;
          events.push(...blocks.toolWhole(`call-${calls}`, { id: call.id, name: call.name, args: call.args }));
        } else if (part.thought === true) {
          events.push(...blocks.append('thinking', 'thinking', textField(part.text)));
        } else {
          events.push(...blocks.append('text', 'text', textField(part.text)));
        }
      }
      finish = geminiFinish(candidate.finishReason) ?? finish;
      if (finish !== null) events.push(...blocks.closeAll());
      return events;
    },
    finish: () => blocked ? completed([], 'refusal', usage) : completed(blocks.content(isCompletedFinish(finish)), finish, usage),
  };
}
