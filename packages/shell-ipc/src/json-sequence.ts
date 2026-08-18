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

/**
 * Create the bounded, fail-closed decoder used by the experimental IPC carrier.
 * The carrier policy is not normative NAP or NIP protocol authority.
 */
export function createJsonSequenceDecoder(options: JsonSequenceDecoderOptions): JsonSequenceDecoder {
  let buffered = Buffer.alloc(0);
  let closed = false;

  const fail = (message: string): never => {
    closed = true;
    buffered = Buffer.alloc(0);
    throw new Error(message);
  };

  const process = (): void => {
    while (buffered.length > 0) {
      if (buffered[0] !== RS) {
        fail('IPC input must begin each JSON text-sequence record with RS.');
      }

      const lineEnd = buffered.indexOf(LF, 1);
      if (lineEnd === -1) {
        if (buffered.length - 1 > options.maxFrameBytes) {
          fail('IPC JSON text-sequence frame exceeds the configured byte limit.');
        }
        return;
      }

      const payload = buffered.subarray(1, lineEnd);
      buffered = buffered.subarray(lineEnd + 1);
      if (payload.length > options.maxFrameBytes) {
        fail('IPC JSON text-sequence frame exceeds the configured byte limit.');
      }

      let envelope: JsonSequenceEnvelope;
      try {
        envelope = decodeEnvelope(payload);
      } catch (error) {
        if (error instanceof SyntaxError) fail('IPC JSON text-sequence frame is not valid JSON.');
        if (error instanceof TypeError) fail(error.message);
        throw error;
      }
      options.onEnvelope(envelope);
    }
  };

  return {
    push(chunk) {
      if (closed) throw new Error('IPC JSON text-sequence decoder is closed.');
      if (chunk.length === 0) return;
      const ownedChunk = Buffer.from(chunk);
      buffered = Buffer.concat([buffered, ownedChunk]);
      if (buffered.length > options.maxBufferedInputBytes) {
        fail('IPC input exceeds the configured buffer limit.');
      }
      process();
    },
    end() {
      if (closed) return;
      if (buffered.length > 0) {
        fail('IPC peer ended with an incomplete JSON text-sequence frame.');
      }
      closed = true;
    },
  };
}

function decodeEnvelope(payload: Buffer): JsonSequenceEnvelope {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(payload);
  } catch {
    throw new TypeError('IPC JSON text-sequence frame is not valid UTF-8.');
  }
  return assertCanonicalEnvelope(JSON.parse(decoded));
}

function assertCanonicalEnvelope(value: unknown): JsonSequenceEnvelope {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError('IPC JSON text-sequence frame is not a canonical envelope.');
  }
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.type !== 'string') {
    throw new TypeError('IPC JSON text-sequence frame is not a canonical envelope.');
  }
  return envelope as JsonSequenceEnvelope;
}
