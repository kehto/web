/**
 * NAP-LLM wire and record types for the Kehto reference service.
 *
 * Authority: napplet/naps PR #134 (`nap-llm`) at
 * 3e10939cf788878bbdcc022c101f0ac6193f316c. `@napplet/nap@0.35.0` ships the
 * `llm` subpath and Kehto's peer ranges admit it, but the 0.32.0 development
 * baseline does not, so these definitions mirror the upstream `feat/nap-llm`
 * draft (`6e5c9fa9`); they are structurally identical to the
 * `@napplet/nap@0.35.1` export. Replace them with `@napplet/nap/llm/types` when
 * the development baseline moves to 0.35.
 *
 * @module
 */

import type { NappletMessage } from '@napplet/core';

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

/** Stable NAP-LLM failure category. Open so forward-compatible codes stay failures. */
export type LlmErrorCode = (typeof LLM_ERROR_CODES)[number] | (string & {});

/** Conversation role of one message. */
export type LlmRole = 'system' | 'user' | 'assistant';

/** Requested output format. `json` requires a JSON object, not an array or scalar. */
export type LlmFormat = 'text' | 'json';

/** Declared encoding of an inline image part. */
export type LlmImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

/** Why a generation ended. Only `stop` is normal completion. */
export type LlmFinish = 'stop' | 'length' | 'refusal';

/** Machine-readable failure carried by a result envelope. */
export interface LlmFailure {
  /** Stable failure category. */
  code: LlmErrorCode;
  /** Safe human-readable diagnostic; never a raw provider body or credential-store error. */
  message: string;
}

/** Constraints a connection must meet before the user is offered it. */
export interface LlmRequirements {
  /** Exact provider model identifier; omission allows user choice. */
  model?: string;
  /** `true` requires image input support. */
  images?: boolean;
  /** `true` requires JSON-object output support. */
  json?: boolean;
}

/** A user-selected connection, described without credentials. */
export interface LlmModel {
  /** Opaque reference scoped to this endpoint and user account; not a URL or credential. */
  handle: string;
  /** User-facing connection label. */
  name: string;
  /** Selected model identifier. */
  model: string;
  /** Human-readable disclosure route, including intermediaries and destination. */
  route: string;
  /** Whether the connection supports image input. */
  images: boolean;
  /** Whether the connection supports JSON-object output. */
  json: boolean;
}

/** A text content part. */
export interface LlmTextPart {
  type: 'text';
  text: string;
}

/** An inline image content part. */
export interface LlmImagePart {
  type: 'image';
  mimeType: LlmImageMimeType;
  /** Standard padded base64 bytes without whitespace, data-URI prefix, or remote URL. */
  data: string;
}

/** One ordered content part. */
export type LlmPart = LlmTextPart | LlmImagePart;

/** One conversation message. */
export interface LlmMessage {
  role: LlmRole;
  /** Ordered, nonempty content parts. */
  content: LlmPart[];
}

/** One stateless generation: the supplied messages are the entire conversation. */
export interface LlmGenerationRequest {
  /** A live Model handle. */
  handle: string;
  /** Ordered, nonempty conversation. */
  messages: LlmMessage[];
  /** Defaults to `text`. */
  format?: LlmFormat;
}

/** Provider-reported token counts. Not a price or settlement receipt. */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Terminal generation result. The complete `text` replaces any provisional deltas. */
export interface LlmGeneration {
  /** Complete accumulated output, including any streamed portion. */
  text: string;
  finish: LlmFinish;
  usage?: LlmUsage;
}

/** Provisional streamed output for one generation. */
export interface LlmDelta {
  /** The originating generation's request id. */
  requestId: string;
  /** Contiguous sequence starting at zero for this generation. */
  sequence: number;
  /** Text to append to the provisional display. */
  text: string;
}

/** A result envelope carries the request id and exactly one of its success field or `error`. */
export type LlmReply<Key extends string, Value> = NappletMessage & { id: string }
  & ({ [K in Key]: Value } & { error?: never } | { error: LlmFailure } & { [K in Key]?: never });

/** Request for llm.select. `requirements` is omitted, never `null`. */
export interface LlmSelectMessage extends NappletMessage {
  type: 'llm.select';
  id: string;
  requirements?: LlmRequirements;
}
/** Response to llm.select. */
export type LlmSelectResultMessage = { type: 'llm.select.result' } & LlmReply<'model', LlmModel>;

/** Request for llm.describe. */
export interface LlmDescribeMessage extends NappletMessage {
  type: 'llm.describe';
  id: string;
  handle: string;
}
/** Response to llm.describe. */
export type LlmDescribeResultMessage = { type: 'llm.describe.result' } & LlmReply<'model', LlmModel>;

/** Request for llm.generate. */
export interface LlmGenerateMessage extends NappletMessage {
  type: 'llm.generate';
  id: string;
  request: LlmGenerationRequest;
}
/** Terminal response to llm.generate. */
export type LlmGenerateResultMessage = { type: 'llm.generate.result' } & LlmReply<'result', LlmGeneration>;

/** Unsolicited provisional output routed to the requesting endpoint; carries `requestId`, not `id`. */
export interface LlmDeltaMessage extends NappletMessage, LlmDelta {
  type: 'llm.delta';
}

/** Request for llm.cancel. */
export interface LlmCancelMessage extends NappletMessage {
  type: 'llm.cancel';
  id: string;
  requestId: string;
}
/** Response to llm.cancel. */
export type LlmCancelResultMessage = { type: 'llm.cancel.result' } & LlmReply<'cancelled', boolean>;

/** Napplet-to-runtime llm envelopes. */
export type LlmOutboundMessage = LlmSelectMessage | LlmDescribeMessage | LlmGenerateMessage | LlmCancelMessage;

/** Runtime-to-napplet llm envelopes. */
export type LlmInboundMessage =
  | LlmSelectResultMessage
  | LlmDescribeResultMessage
  | LlmDeltaMessage
  | LlmGenerateResultMessage
  | LlmCancelResultMessage;

/** All llm wire envelopes. */
export type LlmNapMessage = LlmOutboundMessage | LlmInboundMessage;

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
