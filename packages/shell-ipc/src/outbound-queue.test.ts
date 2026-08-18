import { describe, expect, it } from 'vitest';
import { encodeJsonSequence } from './json-sequence.js';
import { createOutboundQueue } from './outbound-queue.js';

type WriteCallback = (error?: Error | null) => void;

class ControlledWriter {
  readonly writes: Buffer[] = [];
  readonly destroyed: Error[] = [];
  private readonly callbacks: WriteCallback[] = [];
  private readonly drainListeners = new Set<() => void>();

  constructor(private readonly writeResults: boolean[] = []) {}

  write(frame: Uint8Array, callback: WriteCallback): boolean {
    this.writes.push(Buffer.from(frame));
    this.callbacks.push(callback);
    return this.writeResults.shift() ?? true;
  }

  once(event: 'drain', listener: () => void): void {
    if (event === 'drain') this.drainListeners.add(listener);
  }

  off(event: 'drain', listener: () => void): void {
    if (event === 'drain') this.drainListeners.delete(listener);
  }

  destroy(error?: Error): void {
    if (error) this.destroyed.push(error);
  }

  complete(index: number, error?: Error): void {
    this.callbacks[index]?.(error);
  }

  get drainListenerCount(): number {
    return this.drainListeners.size;
  }
}

function createFrame(content: string): Buffer {
  return encodeJsonSequence({ type: 'relay.result', content });
}

describe('createOutboundQueue admission', () => {
  it('leaves an empty queue inert when closed', () => {
    const writer = new ControlledWriter();
    const terminal: Error[] = [];
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: 1,
      onTerminal(error) {
        terminal.push(error);
      },
    });

    queue.close();

    expect(writer.writes).toEqual([]);
    expect(writer.destroyed).toEqual([]);
    expect(terminal).toEqual([]);
  });

  it('admits one frame exactly at both configured limits', () => {
    const writer = new ControlledWriter();
    const frame = createFrame('ascii');
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: frame.length,
    });

    queue.enqueue(frame);

    expect(writer.writes).toEqual([frame]);
    expect(writer.destroyed).toEqual([]);
  });

  it('terminates before another write when count or byte admission exceeds a limit', () => {
    const countWriter = new ControlledWriter();
    const byteWriter = new ControlledWriter();
    const frame = createFrame('ascii');
    const countQueue = createOutboundQueue(countWriter, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: frame.length * 2,
    });
    const byteQueue = createOutboundQueue(byteWriter, {
      maxOutboundQueueFrames: 2,
      maxOutboundQueueBytes: frame.length - 1,
    });

    countQueue.enqueue(frame);
    expect(() => countQueue.enqueue(frame)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
    expect(() => byteQueue.enqueue(frame)).toThrow('OUTBOUND_QUEUE_OVERFLOW');

    expect(countWriter.writes).toEqual([frame]);
    expect(byteWriter.writes).toEqual([]);
    expect(countWriter.destroyed).toHaveLength(1);
    expect(byteWriter.destroyed).toHaveLength(1);
  });

  it('accounts for UTF-8 frame bytes rather than source JavaScript string length', () => {
    const writer = new ControlledWriter();
    const ascii = createFrame('plain');
    const multibyteContent = 'café 🛰️';
    const multibyte = createFrame(multibyteContent);
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: ascii.length,
    });

    expect(multibyte.length).toBeGreaterThan(multibyteContent.length);
    expect(multibyte.length).toBeGreaterThan(ascii.length);
    expect(() => queue.enqueue(multibyte)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
    expect(writer.writes).toEqual([]);
  });

  it('retains callback-pending bytes and supports zero as a no-buffer policy', () => {
    const writer = new ControlledWriter();
    const frame = createFrame('queued');
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: frame.length,
    });
    const zeroQueue = createOutboundQueue(new ControlledWriter(), {
      maxOutboundQueueFrames: 0,
      maxOutboundQueueBytes: 0,
    });

    queue.enqueue(frame);
    expect(() => queue.enqueue(frame)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
    writer.complete(0);
    expect(() => zeroQueue.enqueue(frame)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
  });

  it.each([NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid queue limit %s',
    (limit) => {
      const writer = new ControlledWriter();

      expect(() => createOutboundQueue(writer, {
        maxOutboundQueueFrames: limit,
        maxOutboundQueueBytes: 1,
      })).toThrow('INVALID_LIMIT');
      expect(() => createOutboundQueue(writer, {
        maxOutboundQueueFrames: 1,
        maxOutboundQueueBytes: limit,
      })).toThrow('INVALID_LIMIT');
    },
  );

  it('rejects post-terminal enqueue without another write', () => {
    const writer = new ControlledWriter();
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 1,
      maxOutboundQueueBytes: 100,
    });

    queue.close();

    expect(() => queue.enqueue(createFrame('later'))).toThrow('OUTBOUND_QUEUE_CLOSED');
    expect(writer.writes).toEqual([]);
  });
});
