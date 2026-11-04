/**
 * Shared types and helpers for the NAP-LLM provider dialects.
 *
 * Dialect modules depend on this module and on `llm-provider-blocks.ts`; the
 * public façade (`llm-providers.ts`) and the stream dispatcher depend on the
 * dialects. There are no cycles.
 */

import { LlmServiceError, type LlmBlockEvent, type LlmFinish, type LlmGeneration, type LlmGenerationRequest, type LlmImagePart, type LlmMessage, type LlmOutputPart, type LlmPart, type LlmTextPart, type LlmTool, type LlmToolCallPart, type LlmUsage } from './llm-types.js';

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
  /** Output token ceiling. Anthropic requires one; the default is 4096. A request's `maxTokens` can only lower it. */
  readonly maxOutputTokens?: number;
  /**
   * Whether continuing a conversation that contains `toolCall` parts needs opaque
   * or signed reasoning state NAP-LLM cannot represent (LLM-C17). When true,
   * history with `toolCall` parts is `unsupported` before any request is built.
   * Gemini defaults it from the model name (3 and later); an explicit value wins.
   */
  readonly requiresOpaqueReasoning?: boolean;
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

const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Optional provider-reported counts beyond input and output. Omitted when not reported. */
export interface UsageExtras {
  readonly cacheReadTokens?: unknown;
  readonly cacheWriteTokens?: unknown;
  readonly reasoningTokens?: unknown;
}

/** @internal Shared by the buffered parsers and the stream accumulators. */
export function usageFrom(input: unknown, output: unknown, extras: UsageExtras = {}): LlmUsage | undefined {
  if (!count(input) || !count(output)) return undefined;
  const usage: LlmUsage = { inputTokens: input, outputTokens: output };
  if (count(extras.cacheReadTokens)) usage.cacheReadTokens = extras.cacheReadTokens;
  if (count(extras.cacheWriteTokens)) usage.cacheWriteTokens = extras.cacheWriteTokens;
  if (count(extras.reasoningTokens)) usage.reasoningTokens = extras.reasoningTokens;
  return usage;
}

/** @internal Assemble a Generation, omitting absent usage. */
export function finished(content: LlmOutputPart[], finish: LlmFinish, usage: LlmUsage | undefined): LlmGeneration {
  return usage ? { content, finish, usage } : { content, finish };
}

/** @internal Terminal content for a buffered reply: one text part only when non-empty. */
export function textContent(text: string): LlmOutputPart[] {
  return text === '' ? [] : [{ type: 'text', text }];
}

/**
 * @internal Finish a generation, or fail when the provider sent no completion
 * marker. Adapters normalise too: a completed `stop` with any call is `toolUse`,
 * and truncated or refused turns keep their finish with no `toolCall` parts.
 */
export function completed(content: LlmOutputPart[], finish: LlmFinish | null, usage: LlmUsage | undefined): LlmGeneration {
  if (finish === null) throw providerError('The provider response had no recognised completion marker.');
  if (finish === 'length' || finish === 'refusal') return finished(content.filter((part) => part.type !== 'toolCall'), finish, usage);
  const calls = content.some((part) => part.type === 'toolCall');
  return finished(content, finish === 'stop' && calls ? 'toolUse' : finish, usage);
}

/** True when a finish ends a completed turn (the only turns whose tool calls are kept). */
export function isCompletedFinish(finish: LlmFinish | null): boolean {
  return finish === 'stop' || finish === 'toolUse';
}

/** Schema sent for a tool that omits `parameters`, as NAP-LLM defines it. */
export const DEFAULT_TOOL_PARAMETERS: Record<string, unknown> = { type: 'object', properties: {}, additionalProperties: false };

/** The request's tools; an empty list is equivalent to omission. */
export function toolsOf(request: LlmGenerationRequest): readonly LlmTool[] {
  return request.tools ?? [];
}

/** Parameters schema for a tool, with the NAP-LLM default for an omitted one. */
export function parametersOf(tool: LlmTool): Record<string, unknown> {
  return tool.parameters ?? DEFAULT_TOOL_PARAMETERS;
}

/** The `toolCall` parts of a message in order. */
export function callsOf(message: LlmMessage): LlmToolCallPart[] {
  return message.content.filter((part): part is LlmToolCallPart => part.type === 'toolCall');
}

/** Text and image parts of a message, in order, with `toolCall` parts removed. */
export function nonCallParts(message: LlmMessage): Array<LlmTextPart | LlmImagePart> {
  return plainParts(message.content.filter((part) => part.type !== 'toolCall'));
}

/** Smaller of the request's `maxTokens` and the endpoint ceiling; `undefined` when neither is set. */
export function outputLimit(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): number | undefined {
  const limits = [request.maxTokens, endpoint.maxOutputTokens].filter((limit): limit is number => limit !== undefined);
  return limits.length === 0 ? undefined : Math.min(...limits);
}

/** Sentence NAP-LLM requires ahead of a failed tool result when the provider has no native error flag (LLM-C22). */
export const TOOL_FAILED = 'Tool execution failed.';

/**
 * Tool result content as one string for providers that take text only: the text
 * parts joined by newlines, with {@link TOOL_FAILED} and a newline in front for
 * an error result.
 *
 * @throws LlmServiceError `unsupported` when the result carries an image.
 */
export function toolResultText(message: LlmMessage): string {
  if (hasImage(message.content)) throw unsupported('This provider does not accept images in tool results.');
  const texts = plainParts(message.content).map((part) => part.type === 'text' ? part.text : '');
  return (message.isError === true ? [TOOL_FAILED, ...texts] : texts).join('\n');
}

const OPAQUE_REASONING_MODEL = /^(models\/)?gemini-([3-9]|\d{2,})/;
const TEMPERATURE_CEILING: Record<LlmProviderProtocol, number> = { 'openai-chat': 2, 'anthropic-messages': 1, gemini: 2 };

function needsOpaqueReasoning(endpoint: LlmProviderEndpoint): boolean {
  return endpoint.requiresOpaqueReasoning ?? (endpoint.protocol === 'gemini' && OPAQUE_REASONING_MODEL.test(endpoint.model));
}

/**
 * Checks and rewrites shared by every dialect, run before any dialect body.
 *
 * History containing `toolCall` parts is `unsupported` when the endpoint needs
 * opaque reasoning state (LLM-C17). A temperature outside the dialect range is
 * `unsupported`. `thinking` parts are display-only, so they are omitted from
 * provider input, and a message they leave empty is dropped.
 *
 * @throws LlmServiceError `unsupported` as described.
 */
export function prepareRequest(endpoint: LlmProviderEndpoint, request: LlmGenerationRequest): LlmGenerationRequest {
  if (needsOpaqueReasoning(endpoint) && request.messages.some((message) => callsOf(message).length > 0)) {
    throw unsupported('This model needs reasoning state that NAP-LLM cannot carry, so a conversation containing tool calls cannot continue on it.');
  }
  const ceiling = TEMPERATURE_CEILING[endpoint.protocol];
  if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > ceiling)) {
    throw unsupported(`This provider accepts a temperature between 0 and ${ceiling}.`);
  }
  const messages = request.messages
    .map((message) => ({ ...message, content: message.content.filter((part) => part.type !== 'thinking') }))
    .filter((message) => message.content.length > 0);
  if (messages.length === 0) throw unsupported('Nothing remains to send once display-only thinking is omitted.');
  return { ...request, messages };
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
