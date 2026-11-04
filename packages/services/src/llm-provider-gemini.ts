/** Google Gemini `generateContent` dialect: request, response and stream mapping. */

import { createLlmBlockBuilder } from './llm-provider-blocks.js';
import {
  completed, credentialHeaders, finished, plainParts, providerError, record, splitSystem, textContent, trimBase, unsupported, usageFrom,
  type LlmHttpRequest, type LlmProviderEndpoint, type LlmStreamAccumulator,
} from './llm-provider-shared.js';
import type { LlmFinish, LlmGeneration, LlmGenerationRequest, LlmPart, LlmUsage } from './llm-types.js';

const STREAM_ERROR = 'The provider reported an error while streaming.';

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function geminiParts(parts: readonly LlmPart[]): unknown[] {
  return plainParts(parts).map((part) => part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data } });
}

export function buildGemini(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, stream: boolean): LlmHttpRequest {
  const { system, turns } = splitSystem(request.messages);
  if (turns.length === 0) throw unsupported('This provider requires at least one user or assistant message.');
  const generationConfig: Record<string, unknown> = {};
  if (request.format === 'json') generationConfig.responseMimeType = 'application/json';
  if (endpoint.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = endpoint.maxOutputTokens;
  const body: Record<string, unknown> = {
    contents: turns.map((turn) => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: geminiParts(turn.content) })),
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
  return {
    url: `${trimBase(endpoint.baseUrl)}/models/${encodeURIComponent(endpoint.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

const GEMINI_REFUSALS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

export function parseGemini(json: unknown): LlmGeneration {
  const root = record(json);
  const usage = record(root?.usageMetadata);
  const tokens = usageFrom(usage?.promptTokenCount, usage?.candidatesTokenCount);
  const feedback = record(root?.promptFeedback);
  if (typeof feedback?.blockReason === 'string') return finished([], 'refusal', tokens);
  const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
  if (!candidate) throw providerError('The provider response had no candidate.');
  const parts = Array.isArray(record(candidate.content)?.parts) ? record(candidate.content)!.parts as unknown[] : [];
  const text = parts.map((part) => { const entry = record(part); return typeof entry?.text === 'string' ? entry.text : ''; }).join('');
  return completed(textContent(text), geminiFinish(candidate.finishReason), tokens);
}

/** @internal Map a Gemini `finishReason`; `null` means no recognised marker. */
export function geminiFinish(reason: unknown): LlmFinish | null {
  if (reason === 'STOP') return 'stop';
  if (reason === 'MAX_TOKENS') return 'length';
  return typeof reason === 'string' && GEMINI_REFUSALS.has(reason) ? 'refusal' : null;
}

export function geminiAccumulator(): LlmStreamAccumulator {
  const blocks = createLlmBlockBuilder();
  let blocked = false;
  let finish: LlmFinish | null = null;
  let usage: LlmUsage | undefined;
  return {
    push(event) {
      const root = record(event);
      if (root?.error !== undefined) throw providerError(STREAM_ERROR);
      const metadata = record(root?.usageMetadata);
      if (metadata) usage = usageFrom(metadata.promptTokenCount, metadata.candidatesTokenCount) ?? usage;
      if (typeof record(root?.promptFeedback)?.blockReason === 'string') blocked = true;
      const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
      if (!candidate) return [];
      const parts = record(candidate.content)?.parts;
      const appended = Array.isArray(parts) ? parts.map((part) => textField(record(part)?.text)).join('') : '';
      const events = blocks.append('text', 'text', appended);
      finish = geminiFinish(candidate.finishReason) ?? finish;
      if (finish !== null) events.push(...blocks.closeAll());
      return events;
    },
    finish: () => blocked ? completed([], 'refusal', usage) : completed(blocks.content(), finish, usage),
  };
}

