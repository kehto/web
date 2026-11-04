/**
 * NAP-LLM wire and record types for the Kehto reference service.
 *
 * Authority: napplet/naps PR #134 (`nap-llm`) at
 * 5e93bdfce0e84c0de728234cb7b3feed498f8635, the contract packaged as
 * `@napplet/nap@0.37.0` (`@napplet/nap/llm/types`) over the `Llm*` records in
 * `@napplet/core@0.38.0`. Record and envelope types are re-exported from that
 * package, so this module no longer mirrors the draft. Only runtime values the
 * service needs without a runtime dependency on nap stay local: the domain
 * discriminator, the error codes, {@link LlmServiceError} and the {@link LlmReply}
 * helper that upstream does not export.
 *
 * @module
 */

import type { NappletMessage } from '@napplet/core';
import type { LlmDelta, LlmErrorCode, LlmFailure } from '@napplet/nap/llm/types';

export type {
  LlmApi,
  LlmCancelMessage,
  LlmCancelResultMessage,
  LlmDelta,
  LlmDeltaBlock,
  LlmDeltaEvent,
  LlmDeltaMessage,
  LlmDescribeMessage,
  LlmDescribeResultMessage,
  LlmErrorCode,
  LlmFailure,
  LlmFinish,
  LlmFormat,
  LlmGenerateMessage,
  LlmGenerateOptions,
  LlmGenerateResultMessage,
  LlmGeneration,
  LlmGenerationRequest,
  LlmImageMimeType,
  LlmImagePart,
  LlmInboundMessage,
  LlmMessage,
  LlmModel,
  LlmNamedToolChoice,
  LlmNapMessage,
  LlmOutboundMessage,
  LlmOutputPart,
  LlmPart,
  LlmPendingGeneration,
  LlmRequirements,
  LlmRole,
  LlmSelectMessage,
  LlmSelectResultMessage,
  LlmTextPart,
  LlmThinkingPart,
  LlmTool,
  LlmToolCallPart,
  LlmToolChoice,
  LlmToolChoiceMode,
  LlmUsage,
} from '@napplet/nap/llm/types';

/** NAP-LLM domain discriminator. */
export const LLM_DOMAIN = 'llm' as const;

/** Error codes named by the specification, in specification order. Unknown codes are still failures. */
export const LLM_ERROR_CODES = [
  'unsupported',
  'invalid-request',
  'selection-expired',
  'user-cancelled',
  'cancelled',
  'timeout',
  'quota-exceeded',
  'provider-error',
] as const;

/**
 * A block lifecycle event as a host adapter produces it. The service owns
 * `requestId` and the contiguous `sequence`, so hosts supply neither.
 */
export type LlmBlockEvent = Omit<LlmDelta, 'requestId' | 'sequence'>;

/** A result envelope carries the request id and exactly one of its success field or `error`. */
export type LlmReply<Key extends string, Value> = NappletMessage & { id: string }
  & ({ [K in Key]: Value } & { error?: never } | { error: LlmFailure } & { [K in Key]?: never });

/**
 * Typed NAP-LLM failure. Services and hosts throw it to pick the wire code; the
 * message must already be safe to show (no provider bodies, no credentials).
 *
 * @example
 * throw new LlmServiceError('unsupported', 'This connection does not accept image input.');
 */
export class LlmServiceError extends Error {
  /** Stable NAP-LLM failure category. */
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = 'LlmServiceError';
    this.code = code;
  }
}
