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
 *
 * Each dialect lives in its own module; this façade keeps the public exports.
 */

import { buildAnthropicMessages, parseAnthropicMessages } from './llm-provider-anthropic.js';
import { buildGemini, parseGemini } from './llm-provider-gemini.js';
import { buildOpenAiChat, parseOpenAiChat } from './llm-provider-openai.js';
import { prepareRequest, providerError, unsupported, type LlmHttpRequest, type LlmProviderEndpoint, type LlmProviderProtocol, type LlmProviderRequestOptions } from './llm-provider-shared.js';
import type { LlmGeneration, LlmGenerationRequest } from './llm-types.js';

export type { LlmCredentialHeader, LlmHttpRequest, LlmProviderEndpoint, LlmProviderProtocol, LlmProviderRequestOptions } from './llm-provider-shared.js';

/**
 * Build the provider HTTP request for one NAP-LLM generation.
 *
 * @param endpoint - Configured protocol, base URL, model and credential.
 * @param request - Validated NAP-LLM generation request.
 * @param options - `stream: true` requests the dialect's server-sent-event form.
 * @returns URL, headers and JSON body for a single POST.
 * @throws LlmServiceError `unsupported` for provider-specific input restrictions.
 * @example
 * const http = buildLlmProviderRequest({ protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', credential: key }, request);
 */
export function buildLlmProviderRequest(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, options: LlmProviderRequestOptions = {}): LlmHttpRequest {
  const stream = options.stream === true;
  const prepared = prepareRequest(endpoint, request);
  switch (endpoint.protocol) {
    case 'openai-chat': return buildOpenAiChat(endpoint, prepared, stream);
    case 'anthropic-messages': return buildAnthropicMessages(endpoint, prepared, stream);
    case 'gemini': return buildGemini(endpoint, prepared, stream);
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
