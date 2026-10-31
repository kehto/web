/**
 * Pure NAP-LLM ↔ provider wire mappers.
 *
 * Three request/response dialects cover the hosted and local inference APIs
 * napplet developers reach for most: the OpenAI Chat Completions shape (OpenAI,
 * OpenRouter, Groq, Mistral, DeepSeek, xAI, Together, Fireworks, Perplexity,
 * Azure OpenAI, and local Ollama, LM Studio, llama.cpp and vLLM servers), the
 * Anthropic Messages API and Google Gemini `generateContent`. Mapping roles and
 * parts into a provider's equivalent is permitted by NAP-LLM; provider-specific
 * input restrictions are reported as `unsupported` before any request is built.
 * Credentials are placed only on the outgoing request to the configured base URL.
 */

import { LlmServiceError, type LlmFinish, type LlmGeneration, type LlmGenerationRequest, type LlmMessage, type LlmPart, type LlmUsage } from './llm-types.js';

/** Supported provider request/response dialects. */
export type LlmProviderProtocol = 'openai-chat' | 'anthropic-messages' | 'gemini';

/** Header carrying the credential; each protocol has a conventional default. */
export type LlmCredentialHeader = 'authorization-bearer' | 'api-key' | 'x-api-key' | 'x-goog-api-key';

/** One configured provider endpoint. The credential is optional for local servers. */
export interface LlmProviderEndpoint {
  readonly protocol: LlmProviderProtocol;
  /** API root such as `https://api.openai.com/v1`, without a trailing slash. */
  readonly baseUrl: string;
  /** Exact provider model identifier. */
  readonly model: string;
  /** API key or token. Sent only on the request to `baseUrl`. */
  readonly credential?: string;
  /** Override the protocol's default credential header (Azure OpenAI uses `api-key`). */
  readonly credentialHeader?: LlmCredentialHeader;
  /** Extra static headers, such as OpenRouter attribution. Never used for credentials. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Output token ceiling. Anthropic requires one; the default is 4096. */
  readonly maxOutputTokens?: number;
}

/** A provider HTTP request ready for `fetch`. */
export interface LlmHttpRequest {
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const ANTHROPIC_VERSION = '2023-06-01';
const JSON_INSTRUCTION = 'Respond with a single JSON object and no other text.';

function unsupported(message: string): LlmServiceError {
  return new LlmServiceError('unsupported', message);
}

function providerError(message: string): LlmServiceError {
  return new LlmServiceError('provider-error', message);
}

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function defaultCredentialHeader(protocol: LlmProviderProtocol): LlmCredentialHeader {
  if (protocol === 'anthropic-messages') return 'x-api-key';
  if (protocol === 'gemini') return 'x-goog-api-key';
  return 'authorization-bearer';
}

function credentialHeaders(endpoint: LlmProviderEndpoint): Record<string, string> {
  if (!endpoint.credential) return {};
  const header = endpoint.credentialHeader ?? defaultCredentialHeader(endpoint.protocol);
  if (header === 'authorization-bearer') return { authorization: `Bearer ${endpoint.credential}` };
  return { [header]: endpoint.credential };
}

function textOf(parts: readonly LlmPart[]): string {
  return parts.map((part) => part.type === 'text' ? part.text : '').join('');
}

function hasImage(parts: readonly LlmPart[]): boolean {
  return parts.some((part) => part.type === 'image');
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function usageFrom(input: unknown, output: unknown): LlmUsage | undefined {
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isInteger(input) || !Number.isInteger(output) || input < 0 || output < 0) return undefined;
  return { inputTokens: input, outputTokens: output };
}

function finished(text: string, finish: LlmFinish, usage: LlmUsage | undefined): LlmGeneration {
  return usage ? { text, finish, usage } : { text, finish };
}

function openAiContent(parts: readonly LlmPart[]): unknown {
  if (!hasImage(parts)) return textOf(parts);
  return parts.map((part) => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } });
}

function buildOpenAiChat(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): LlmHttpRequest {
  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages: request.messages.map((message) => ({ role: message.role, content: openAiContent(message.content) })),
    stream: false,
  };
  if (request.format === 'json') body.response_format = { type: 'json_object' };
  if (endpoint.maxOutputTokens !== undefined) body.max_tokens = endpoint.maxOutputTokens;
  return {
    url: `${trimBase(endpoint.baseUrl)}/chat/completions`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

function parseOpenAiChat(json: unknown): LlmGeneration {
  const root = record(json);
  const choice = record(Array.isArray(root?.choices) ? root?.choices[0] : undefined);
  const message = record(choice?.message);
  if (!choice || !message) throw providerError('The provider response had no completion choice.');
  const usage = record(root?.usage);
  const tokens = usageFrom(usage?.prompt_tokens, usage?.completion_tokens);
  if (typeof message.refusal === 'string' && message.refusal.length > 0) return finished('', 'refusal', tokens);
  const text = typeof message.content === 'string' ? message.content : '';
  switch (choice.finish_reason) {
    case 'stop': return finished(text, 'stop', tokens);
    case 'length': return finished(text, 'length', tokens);
    case 'content_filter': return finished(text, 'refusal', tokens);
    default: throw providerError('The provider response had no recognised completion marker.');
  }
}

function anthropicBlocks(parts: readonly LlmPart[]): unknown[] {
  return parts.map((part) => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } });
}

function splitSystem(messages: readonly LlmMessage[]): { system: string; turns: LlmMessage[] } {
  const systemParts: string[] = [];
  const turns: LlmMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'system') { turns.push(message); continue; }
    if (hasImage(message.content)) throw unsupported('This provider does not accept images in system messages.');
    systemParts.push(textOf(message.content));
  }
  return { system: systemParts.join('\n'), turns };
}

function buildAnthropicMessages(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): LlmHttpRequest {
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
    stream: false,
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

function parseAnthropicMessages(json: unknown): LlmGeneration {
  const root = record(json);
  if (!root || !Array.isArray(root.content)) throw providerError('The provider response had no content blocks.');
  const text = root.content.map((block) => { const entry = record(block); return entry?.type === 'text' && typeof entry.text === 'string' ? entry.text : ''; }).join('');
  const usage = record(root.usage);
  const tokens = usageFrom(usage?.input_tokens, usage?.output_tokens);
  switch (root.stop_reason) {
    case 'end_turn':
    case 'stop_sequence': return finished(text, 'stop', tokens);
    case 'max_tokens': return finished(text, 'length', tokens);
    case 'refusal': return finished(text, 'refusal', tokens);
    default: throw providerError('The provider response had no recognised completion marker.');
  }
}

function geminiParts(parts: readonly LlmPart[]): unknown[] {
  return parts.map((part) => part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data } });
}

function buildGemini(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): LlmHttpRequest {
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
    url: `${trimBase(endpoint.baseUrl)}/models/${encodeURIComponent(endpoint.model)}:generateContent`,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...endpoint.headers, ...credentialHeaders(endpoint) },
    body: JSON.stringify(body),
  };
}

const GEMINI_REFUSALS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

function parseGemini(json: unknown): LlmGeneration {
  const root = record(json);
  const usage = record(root?.usageMetadata);
  const tokens = usageFrom(usage?.promptTokenCount, usage?.candidatesTokenCount);
  const feedback = record(root?.promptFeedback);
  if (typeof feedback?.blockReason === 'string') return finished('', 'refusal', tokens);
  const candidate = record(Array.isArray(root?.candidates) ? root?.candidates[0] : undefined);
  if (!candidate) throw providerError('The provider response had no candidate.');
  const parts = Array.isArray(record(candidate.content)?.parts) ? record(candidate.content)!.parts as unknown[] : [];
  const text = parts.map((part) => { const entry = record(part); return typeof entry?.text === 'string' ? entry.text : ''; }).join('');
  const reason = candidate.finishReason;
  if (reason === 'STOP') return finished(text, 'stop', tokens);
  if (reason === 'MAX_TOKENS') return finished(text, 'length', tokens);
  if (typeof reason === 'string' && GEMINI_REFUSALS.has(reason)) return finished(text, 'refusal', tokens);
  throw providerError('The provider response had no recognised completion marker.');
}

/**
 * Build the provider HTTP request for one NAP-LLM generation.
 *
 * @param endpoint - Configured protocol, base URL, model and credential.
 * @param request - Validated NAP-LLM generation request.
 * @returns URL, headers and JSON body for a single POST.
 * @throws LlmServiceError `unsupported` for provider-specific input restrictions.
 * @example
 * const http = buildLlmProviderRequest({ protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', credential: key }, request);
 */
export function buildLlmProviderRequest(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): LlmHttpRequest {
  switch (endpoint.protocol) {
    case 'openai-chat': return buildOpenAiChat(endpoint, request);
    case 'anthropic-messages': return buildAnthropicMessages(endpoint, request);
    case 'gemini': return buildGemini(endpoint, request);
    default: throw unsupported('Unknown provider protocol.');
  }
}

/**
 * Map a provider JSON response to a NAP-LLM Generation.
 *
 * @param protocol - Dialect the response came from.
 * @param json - Parsed response body.
 * @returns Text, finish reason and usage when reported.
 * @throws LlmServiceError `provider-error` for missing completion markers; the message never echoes the body.
 * @example
 * const generation = parseLlmProviderResponse('openai-chat', await response.json());
 */
export function parseLlmProviderResponse(protocol: LlmProviderProtocol, json: unknown): LlmGeneration {
  switch (protocol) {
    case 'openai-chat': return parseOpenAiChat(json);
    case 'anthropic-messages': return parseAnthropicMessages(json);
    case 'gemini': return parseGemini(json);
    default: throw providerError('Unknown provider protocol.');
  }
}
