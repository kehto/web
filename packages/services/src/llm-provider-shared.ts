/**
 * Shared types and helpers for the NAP-LLM provider dialects.
 *
 * Dialect modules depend on this module and on `llm-provider-blocks.ts`; the
 * public façade (`llm-providers.ts`) and the stream dispatcher depend on the
 * dialects. There are no cycles.
 */

import { LlmServiceError, type LlmBlockEvent, type LlmFinish, type LlmGeneration, type LlmImagePart, type LlmMessage, type LlmOutputPart, type LlmPart, type LlmTextPart, type LlmUsage } from './llm-types.js';

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

/** Options for {@link buildLlmProviderRequest}. */
export interface LlmProviderRequestOptions {
  /**
   * Request the dialect's streaming form: `stream: true` server-sent events for
   * OpenAI Chat Completions (with usage reporting) and Anthropic Messages, and
   * `streamGenerateContent?alt=sse` for Gemini. Default `false` (one JSON body).
   */
  readonly stream?: boolean;
}

/** A provider HTTP request ready for `fetch`. */
export interface LlmHttpRequest {
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const ANTHROPIC_VERSION = '2023-06-01';
export const JSON_INSTRUCTION = 'Respond with a single JSON object and no other text.';

export function unsupported(message: string): LlmServiceError {
  return new LlmServiceError('unsupported', message);
}

/** @internal Typed provider failure whose message never echoes a provider body. */
export function providerError(message: string): LlmServiceError {
  return new LlmServiceError('provider-error', message);
}

export function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function defaultCredentialHeader(protocol: LlmProviderProtocol): LlmCredentialHeader {
  if (protocol === 'anthropic-messages') return 'x-api-key';
  if (protocol === 'gemini') return 'x-goog-api-key';
  return 'authorization-bearer';
}

export function credentialHeaders(endpoint: LlmProviderEndpoint): Record<string, string> {
  if (!endpoint.credential) return {};
  const header = endpoint.credentialHeader ?? defaultCredentialHeader(endpoint.protocol);
  if (header === 'authorization-bearer') return { authorization: `Bearer ${endpoint.credential}` };
  return { [header]: endpoint.credential };
}

/** Text and image parts: the only parts a text-only turn can carry. */
export function plainParts(parts: readonly LlmPart[]): Array<LlmTextPart | LlmImagePart> {
  return parts.map((part) => {
    if (part.type === 'text' || part.type === 'image') return part;
    throw unsupported('This provider mapping does not accept this content part.');
  });
}

export function textOf(parts: readonly LlmPart[]): string {
  return plainParts(parts).map((part) => part.type === 'text' ? part.text : '').join('');
}

export function hasImage(parts: readonly LlmPart[]): boolean {
  return parts.some((part) => part.type === 'image');
}

/** @internal Narrow an unknown JSON value to a plain object. */
export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** @internal Shared by the buffered parsers and the stream accumulators. */
export function usageFrom(input: unknown, output: unknown): LlmUsage | undefined {
  if (typeof input !== 'number' || typeof output !== 'number' || !Number.isInteger(input) || !Number.isInteger(output) || input < 0 || output < 0) return undefined;
  return { inputTokens: input, outputTokens: output };
}

/** @internal Assemble a Generation, omitting absent usage. */
export function finished(content: LlmOutputPart[], finish: LlmFinish, usage: LlmUsage | undefined): LlmGeneration {
  return usage ? { content, finish, usage } : { content, finish };
}

/** @internal Terminal content for a buffered reply: one text part only when non-empty. */
export function textContent(text: string): LlmOutputPart[] {
  return text === '' ? [] : [{ type: 'text', text }];
}

/** @internal Finish a generation, or fail when the provider sent no completion marker. */
export function completed(content: LlmOutputPart[], finish: LlmFinish | null, usage: LlmUsage | undefined): LlmGeneration {
  if (finish === null) throw providerError('The provider response had no recognised completion marker.');
  return finished(content, finish, usage);
}

export function splitSystem(messages: readonly LlmMessage[]): { system: string; turns: LlmMessage[] } {
  const systemParts: string[] = [];
  const turns: LlmMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'system') { turns.push(message); continue; }
    if (hasImage(message.content)) throw unsupported('This provider does not accept images in system messages.');
    systemParts.push(textOf(message.content));
  }
  return { system: systemParts.join('\n'), turns };
}


/** Folds one provider stream into block events and a final generation. */
export interface LlmStreamAccumulator {
  /**
   * Consume one parsed event payload.
   * @returns Ordered block events this payload produced; empty when it carried none.
   * @throws LlmServiceError `provider-error` when the provider reports a stream error.
   */
  push(event: unknown): LlmBlockEvent[];
  /**
   * Resolve the complete generation after the stream ended.
   * @throws LlmServiceError `provider-error` when no completion marker arrived.
   */
  finish(): LlmGeneration;
}
