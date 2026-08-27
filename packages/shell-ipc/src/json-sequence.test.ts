import { describe, expect, it } from 'vitest';
import { createJsonSequenceDecoder, encodeJsonSequence, type JsonSequenceEnvelope } from './json-sequence.js';
import { IpcTransportError } from './types.js';

const LIMITS = {
  maxFrameBytes: 1_048_576,
  maxBufferedInputBytes: 2_097_152,
};

const CANONICAL_ENVELOPE = {
  type: 'relay.query',
  content: 'café 🛰️\nsecond line',
  nested: {
    tags: ['日本語', 'emoji-🛰️'],
    enabled: true,
  },
} as const;

function createRecordingDecoder(records: JsonSequenceEnvelope[]) {
  return createJsonSequenceDecoder({
    ...LIMITS,
    onEnvelope(envelope) {
      records.push(envelope);
    },
  });
}

describe('RFC 7464 JSON text-sequence codec', () => {
  it('encodes compact UTF-8 JSON without normalizing or adding carrier fields', () => {
    const frame = encodeJsonSequence(CANONICAL_ENVELOPE);
    const json = JSON.stringify(CANONICAL_ENVELOPE);

    expect(frame[0]).toBe(0x1e);
    expect(frame.at(-1)).toBe(0x0a);
    expect(frame.subarray(1, -1)).toEqual(Buffer.from(json, 'utf8'));
    expect(Buffer.byteLength(json, 'utf8')).toBeGreaterThan(json.length);
  });

  it('accepts empty chunks and a zero-record end without callback delivery', () => {
    const records: JsonSequenceEnvelope[] = [];
    const decoder = createRecordingDecoder(records);

    decoder.push(new Uint8Array());
    decoder.end();

    expect(records).toEqual([]);
  });

  it('decodes every possible byte split of one multibyte canonical frame exactly once', () => {
    const frame = encodeJsonSequence(CANONICAL_ENVELOPE);

    for (let split = 1; split < frame.length; split += 1) {
      const records: JsonSequenceEnvelope[] = [];
      const decoder = createRecordingDecoder(records);
      decoder.push(new Uint8Array(frame.subarray(0, split)));
      decoder.push(new Uint8Array(frame.subarray(split)));
      decoder.end();

      expect(records).toEqual([CANONICAL_ENVELOPE]);
    }
  });

  it('owns each partial Uint8Array before a caller can mutate it', () => {
    const frame = encodeJsonSequence(CANONICAL_ENVELOPE);
    const records: JsonSequenceEnvelope[] = [];
    const decoder = createRecordingDecoder(records);
    const firstChunk = new Uint8Array(frame.subarray(0, frame.length - 1));

    decoder.push(firstChunk);
    firstChunk.fill(0);
    decoder.push(new Uint8Array(frame.subarray(frame.length - 1)));
    decoder.end();

    expect(records).toEqual([CANONICAL_ENVELOPE]);
  });

  it('delivers coalesced frames synchronously in wire order', () => {
    const records: JsonSequenceEnvelope[] = [];
    const envelopes = [
      { type: 'shell.ready' },
      { type: 'shell.init', content: 'é' },
      { type: 'relay.result', values: ['🛰️'] },
    ];
    let phase = 'before';
    const synchronousDecoder = createJsonSequenceDecoder({
      ...LIMITS,
      onEnvelope(envelope) {
        expect(phase).toBe('during push');
        records.push(envelope);
      },
    });

    phase = 'during push';
    synchronousDecoder.push(new Uint8Array(Buffer.concat(envelopes.map(encodeJsonSequence))));
    phase = 'after push';
    synchronousDecoder.end();

    expect(records).toEqual(envelopes);
  });

  it('keeps interleaved partial records isolated between decoder instances', () => {
    const first = { type: 'alpha.result', content: 'Å' };
    const second = { type: 'beta.result', content: '🛰️' };
    const firstFrame = encodeJsonSequence(first);
    const secondFrame = encodeJsonSequence(second);
    const firstRecords: JsonSequenceEnvelope[] = [];
    const secondRecords: JsonSequenceEnvelope[] = [];
    const firstDecoder = createRecordingDecoder(firstRecords);
    const secondDecoder = createRecordingDecoder(secondRecords);

    firstDecoder.push(new Uint8Array(firstFrame.subarray(0, 3)));
    secondDecoder.push(new Uint8Array(secondFrame.subarray(0, 4)));
    secondDecoder.push(new Uint8Array(secondFrame.subarray(4)));
    firstDecoder.push(new Uint8Array(firstFrame.subarray(3)));
    firstDecoder.end();
    secondDecoder.end();

    expect(firstRecords).toEqual([first]);
    expect(secondRecords).toEqual([second]);
  });

  it('propagates callback exceptions instead of recovering past host code', () => {
    const error = new Error('host callback failed');
    const decoder = createJsonSequenceDecoder({
      ...LIMITS,
      onEnvelope() {
        throw error;
      },
    });

    expect(() => decoder.push(new Uint8Array(encodeJsonSequence(CANONICAL_ENVELOPE)))).toThrow(error);
  });

  it.each([
    ['bytes before RS', Buffer.from('{"type":"shell.ready"}\n'), 'INVALID_FRAMING'],
    ['empty JSON text', Buffer.from([0x1e, 0x0a]), 'MALFORMED_JSON'],
    ['malformed JSON', Buffer.from([0x1e, 0x7b, 0x0a]), 'MALFORMED_JSON'],
    ['scalar JSON', encodeJsonSequence('value'), 'INVALID_ENVELOPE'],
    ['array JSON', encodeJsonSequence([]), 'INVALID_ENVELOPE'],
    ['null JSON', encodeJsonSequence(null), 'INVALID_ENVELOPE'],
    ['missing type', encodeJsonSequence({}), 'INVALID_ENVELOPE'],
    ['non-string type', encodeJsonSequence({ type: 1 }), 'INVALID_ENVELOPE'],
    ['invalid UTF-8', Buffer.from([0x1e, 0xc3, 0x28, 0x0a]), 'INVALID_UTF8'],
  ])('fails closed for %s without callback delivery', (_name, bytes, code) => {
    const records: JsonSequenceEnvelope[] = [];
    const decoder = createRecordingDecoder(records);

    expect(() => decoder.push(bytes)).toThrow(expect.objectContaining({ code }));
    expect(records).toEqual([]);
    expect(() => decoder.push(encodeJsonSequence({ type: 'shell.ready' }))).toThrow(expect.objectContaining({ code: 'DECODER_CLOSED' }));
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid decoder limits: %s',
    (limit) => {
      expect(() => createJsonSequenceDecoder({ maxFrameBytes: limit, maxBufferedInputBytes: 1, onEnvelope() {} })).toThrow(expect.objectContaining({ code: 'INVALID_LIMIT' }));
      expect(() => createJsonSequenceDecoder({ maxFrameBytes: 1, maxBufferedInputBytes: limit, onEnvelope() {} })).toThrow(expect.objectContaining({ code: 'INVALID_LIMIT' }));
    },
  );

  it('applies exact byte limits and makes end truncation terminal', () => {
    const frame = encodeJsonSequence({ type: 'x' });
    const records: JsonSequenceEnvelope[] = [];
    const exact = createJsonSequenceDecoder({ maxFrameBytes: frame.length - 2, maxBufferedInputBytes: frame.length, onEnvelope: (record) => records.push(record) });
    exact.push(frame);
    exact.end();
    expect(records).toEqual([{ type: 'x' }]);

    const over = createJsonSequenceDecoder({ maxFrameBytes: frame.length - 3, maxBufferedInputBytes: frame.length - 1, onEnvelope() {} });
    expect(() => over.push(frame)).toThrow(expect.objectContaining({ code: 'INPUT_BUFFER_OVERFLOW' }));
    const truncated = createRecordingDecoder([]);
    truncated.push(frame.subarray(0, -1));
    expect(() => truncated.end()).toThrow(expect.objectContaining({ code: 'TRUNCATED_FRAME' }));
  });
});
