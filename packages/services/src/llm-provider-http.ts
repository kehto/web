/**
 * Provider presets and a `fetch`-based NAP-LLM provider.
 *
 * The preset list is the host-neutral starting point for a connection editor:
 * each row names the dialect, API root and credential header a developer needs
 * to reach the services napplet authors most commonly target. Hosts may add or
 * hide rows; the list is data, not policy.
 */

import { LlmServiceError, type LlmGeneration, type LlmGenerationRequest } from './llm-types.js';
import { buildLlmProviderRequest, parseLlmProviderResponse, type LlmCredentialHeader, type LlmProviderEndpoint, type LlmProviderProtocol } from './llm-providers.js';

/** One well-known provider configuration a host can offer in its connection editor. */
export interface LlmProviderPreset {
  /** Stable preset identifier. */
  readonly id: string;
  /** User-facing provider name. */
  readonly label: string;
  readonly protocol: LlmProviderProtocol;
  /** Default API root; local presets point at the server's usual loopback port. */
  readonly baseUrl: string;
  /** Credential header when the protocol default does not apply. */
  readonly credentialHeader?: LlmCredentialHeader;
  /** Whether a credential is normally required. Local servers usually need none. */
  readonly requiresCredential: boolean;
  /** Whether the default endpoint runs on the user's machine. The route still names it. */
  readonly local: boolean;
  /** Where to obtain a key or read model names. */
  readonly docsUrl: string;
  /** Example model identifiers to seed the editor; the user may type any model. */
  readonly exampleModels: readonly string[];
}

const PRESET_ROWS: readonly LlmProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', protocol: 'openai-chat', baseUrl: 'https://api.openai.com/v1', requiresCredential: true, local: false, docsUrl: 'https://platform.openai.com/docs/api-reference/chat', exampleModels: ['gpt-4.1-mini', 'gpt-4o-mini'] },
  { id: 'anthropic', label: 'Anthropic', protocol: 'anthropic-messages', baseUrl: 'https://api.anthropic.com/v1', requiresCredential: true, local: false, docsUrl: 'https://docs.anthropic.com/en/api/messages', exampleModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'] },
  { id: 'gemini', label: 'Google Gemini', protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', requiresCredential: true, local: false, docsUrl: 'https://ai.google.dev/api/generate-content', exampleModels: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'openrouter', label: 'OpenRouter', protocol: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1', requiresCredential: true, local: false, docsUrl: 'https://openrouter.ai/docs/api-reference/overview', exampleModels: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4.5'] },
  { id: 'groq', label: 'Groq', protocol: 'openai-chat', baseUrl: 'https://api.groq.com/openai/v1', requiresCredential: true, local: false, docsUrl: 'https://console.groq.com/docs/openai', exampleModels: ['llama-3.3-70b-versatile'] },
  { id: 'mistral', label: 'Mistral', protocol: 'openai-chat', baseUrl: 'https://api.mistral.ai/v1', requiresCredential: true, local: false, docsUrl: 'https://docs.mistral.ai/api/', exampleModels: ['mistral-small-latest'] },
  { id: 'deepseek', label: 'DeepSeek', protocol: 'openai-chat', baseUrl: 'https://api.deepseek.com/v1', requiresCredential: true, local: false, docsUrl: 'https://api-docs.deepseek.com/', exampleModels: ['deepseek-chat'] },
  { id: 'xai', label: 'xAI Grok', protocol: 'openai-chat', baseUrl: 'https://api.x.ai/v1', requiresCredential: true, local: false, docsUrl: 'https://docs.x.ai/docs/api-reference', exampleModels: ['grok-4'] },
  { id: 'together', label: 'Together AI', protocol: 'openai-chat', baseUrl: 'https://api.together.xyz/v1', requiresCredential: true, local: false, docsUrl: 'https://docs.together.ai/reference/chat-completions-1', exampleModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'] },
  { id: 'fireworks', label: 'Fireworks AI', protocol: 'openai-chat', baseUrl: 'https://api.fireworks.ai/inference/v1', requiresCredential: true, local: false, docsUrl: 'https://docs.fireworks.ai/api-reference/post-chatcompletions', exampleModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct'] },
  { id: 'perplexity', label: 'Perplexity', protocol: 'openai-chat', baseUrl: 'https://api.perplexity.ai', requiresCredential: true, local: false, docsUrl: 'https://docs.perplexity.ai/api-reference/chat-completions', exampleModels: ['sonar'] },
  { id: 'azure-openai', label: 'Azure OpenAI', protocol: 'openai-chat', baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1', credentialHeader: 'api-key', requiresCredential: true, local: false, docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/reference', exampleModels: ['YOUR-DEPLOYMENT'] },
  { id: 'ollama', label: 'Ollama (local)', protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:11434/v1', requiresCredential: false, local: true, docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md', exampleModels: ['llama3.2', 'qwen2.5'] },
  { id: 'lmstudio', label: 'LM Studio (local)', protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:1234/v1', requiresCredential: false, local: true, docsUrl: 'https://lmstudio.ai/docs/app/api/endpoints/openai', exampleModels: [] },
  { id: 'llamacpp', label: 'llama.cpp server (local)', protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:8080/v1', requiresCredential: false, local: true, docsUrl: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server', exampleModels: [] },
  { id: 'vllm', label: 'vLLM (self-hosted)', protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:8000/v1', requiresCredential: false, local: true, docsUrl: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html', exampleModels: [] },
  { id: 'custom', label: 'Custom OpenAI-compatible', protocol: 'openai-chat', baseUrl: '', requiresCredential: false, local: false, docsUrl: 'https://platform.openai.com/docs/api-reference/chat', exampleModels: [] },
];

/** Presets for the hosted and local inference APIs napplet developers reach for most. */
export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = Object.freeze(
  PRESET_ROWS.map((preset) => Object.freeze({ ...preset, exampleModels: Object.freeze([...preset.exampleModels]) })),
);

/** Minimal `fetch` surface used by {@link createHttpLlmProvider}. */
export type LlmFetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Options for {@link createHttpLlmProvider}. */
export interface HttpLlmProviderOptions {
  /** Fetch implementation; defaults to the global `fetch`. */
  fetch?: LlmFetch;
}

/** Perform one buffered provider generation. */
export type HttpLlmProvider = (endpoint: LlmProviderEndpoint, request: LlmGenerationRequest, signal: AbortSignal) => Promise<LlmGeneration>;

/**
 * Create a buffered `fetch` provider for the supported dialects.
 *
 * The credential travels only in the configured header of the single POST to
 * the endpoint's base URL. Transport failures and non-2xx statuses become
 * `provider-error` with the status code at most; response bodies are never
 * echoed into NAP-LLM errors. Aborts propagate so the service can settle a
 * cancelled or timed-out generation.
 *
 * @param options - Optional fetch override for tests or custom transports.
 * @returns A provider function for `LlmConnectionHost.generate`.
 * @example
 * const generate = createHttpLlmProvider();
 * const result = await generate({ protocol: 'openai-chat', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' }, request, signal);
 */
export function createHttpLlmProvider(options: HttpLlmProviderOptions = {}): HttpLlmProvider {
  const fetchImpl: LlmFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  return async (endpoint, request, signal) => {
    const http = buildLlmProviderRequest(endpoint, request);
    let response: Awaited<ReturnType<LlmFetch>>;
    try {
      response = await fetchImpl(http.url, { method: http.method, headers: { ...http.headers }, body: http.body, signal });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new LlmServiceError('provider-error', 'The provider could not be reached.');
    }
    if (!response.ok) throw new LlmServiceError('provider-error', `The provider responded with HTTP ${response.status}.`);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new LlmServiceError('provider-error', 'The provider response was not valid JSON.');
    }
    return parseLlmProviderResponse(endpoint.protocol, json);
  };
}
