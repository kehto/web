import { IpcTransportError } from './types.js';

/** Byte markers used by the experimental RFC 7464 carrier. */
export const RS = 0x1e;
/** Byte markers used by the experimental RFC 7464 carrier. */
export const LF = 0x0a;
/** A decoded canonical envelope accepted by the carrier. */
export type JsonSequenceEnvelope = Record<string, unknown> & { type: string };
export interface JsonSequenceDecoderOptions {
  readonly maxFrameBytes: number;
  readonly maxBufferedInputBytes: number;
  readonly onEnvelope: (envelope: JsonSequenceEnvelope) => void;
}
export interface JsonSequenceDecoder {
  push(chunk: Uint8Array): void;
  end(): void;
}

/** Encode one RFC 7464 JSON text-sequence record. */
export function encodeJsonSequence(envelope: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(envelope), 'utf8');
  return Buffer.concat([Buffer.from([RS]), payload, Buffer.from([LF])]);
}

/** Create the bounded, irreversible fail-closed decoder for the experimental IPC carrier. */
export function createJsonSequenceDecoder(options: JsonSequenceDecoderOptions): JsonSequenceDecoder {
  validateLimit('maxFrameBytes', options.maxFrameBytes);
  validateLimit('maxBufferedInputBytes', options.maxBufferedInputBytes);
  let buffered = Buffer.alloc(0);
  let closed = false;
  const fail = (code: ConstructorParameters<typeof IpcTransportError>[0], message: string): never => {
    closed = true;
    buffered = Buffer.alloc(0);
    throw new IpcTransportError(code, message);
  };
  const requireOpen = (): void => {
    if (closed) throw new IpcTransportError('DECODER_CLOSED', 'IPC JSON text-sequence decoder is closed.');
  };
  const process = (): void => {
    while (buffered.length > 0) {
      if (buffered[0] !== RS) fail('INVALID_FRAMING', 'IPC input must begin each JSON text-sequence record with RS.');
      const lineEnd = buffered.indexOf(LF, 1);
      if (lineEnd === -1) {
        if (buffered.length - 1 > options.maxFrameBytes) fail('FRAME_TOO_LARGE', 'IPC JSON text-sequence frame exceeds the configured byte limit.');
        return;
      }
      const payload = buffered.subarray(1, lineEnd);
      buffered = buffered.subarray(lineEnd + 1);
      if (payload.length > options.maxFrameBytes) fail('FRAME_TOO_LARGE', 'IPC JSON text-sequence frame exceeds the configured byte limit.');
      try {
        options.onEnvelope(decodeEnvelope(payload));
      } catch (error) {
        if (error instanceof IpcTransportError) fail(error.code, error.message);
        throw error;
      }
    }
  };
  return {
    push(chunk) {
      requireOpen();
      if (chunk.length === 0) return;
      const owned = Buffer.from(chunk);
      if (buffered.length + owned.length > options.maxBufferedInputBytes) fail('INPUT_BUFFER_OVERFLOW', 'IPC input exceeds the configured buffer limit.');
      buffered = Buffer.concat([buffered, owned]);
      process();
    },
    end() {
      requireOpen();
      if (buffered.length > 0) fail('TRUNCATED_FRAME', 'IPC peer ended with an incomplete JSON text-sequence frame.');
      closed = true;
    },
  };
}

function validateLimit(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new IpcTransportError('INVALID_LIMIT', `${name} must be a positive safe integer.`);
  }
}

function decodeEnvelope(payload: Buffer): JsonSequenceEnvelope {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(payload);
  } catch {
    throw new IpcTransportError('INVALID_UTF8', 'IPC JSON text-sequence frame is not valid UTF-8.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new IpcTransportError('MALFORMED_JSON', 'IPC JSON text-sequence frame is not valid JSON.');
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') {
    throw new IpcTransportError('INVALID_ENVELOPE', 'IPC JSON text-sequence frame is not a canonical envelope.');
  }
  return parsed as JsonSequenceEnvelope;
}
