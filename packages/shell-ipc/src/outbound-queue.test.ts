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

  emitDrain(reentrant = false): void {
    const listeners = [...this.drainListeners];
    this.drainListeners.clear();
    for (const listener of listeners) {
      listener();
      if (reentrant) listener();
    }
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

  it('preserves A/B/C/D order through false writes and repeated drain delivery', () => {
    const writer = new ControlledWriter([true, false, true, true]);
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 4,
      maxOutboundQueueBytes: 1_000,
    });
    const frames = ['A', 'B', 'C', 'D'].map(createFrame);

    for (const frame of frames) queue.enqueue(frame);

    expect(writer.writes).toEqual(frames.slice(0, 2));
    expect(writer.drainListenerCount).toBe(1);
    writer.complete(1);
    writer.emitDrain(true);
    writer.emitDrain(true);

    expect(writer.writes).toEqual(frames);
    expect(writer.drainListenerCount).toBe(0);
    writer.complete(0);
    writer.complete(2);
    writer.complete(3);
  });

  it('keeps writer, listener, and counter state isolated per queue', () => {
    const leftWriter = new ControlledWriter([false, true]);
    const rightWriter = new ControlledWriter([false, true]);
    const leftQueue = createOutboundQueue(leftWriter, {
      maxOutboundQueueFrames: 2,
      maxOutboundQueueBytes: 1_000,
    });
    const rightQueue = createOutboundQueue(rightWriter, {
      maxOutboundQueueFrames: 2,
      maxOutboundQueueBytes: 1_000,
    });
    const left = [createFrame('left-A'), createFrame('left-B')];
    const right = [createFrame('right-A'), createFrame('right-B')];

    leftQueue.enqueue(left[0]);
    rightQueue.enqueue(right[0]);
    leftQueue.enqueue(left[1]);
    rightQueue.enqueue(right[1]);
    leftWriter.emitDrain();

    expect(leftWriter.writes).toEqual(left);
    expect(rightWriter.writes).toEqual(right.slice(0, 1));
    expect(leftWriter.drainListenerCount).toBe(0);
    expect(rightWriter.drainListenerCount).toBe(1);
    rightWriter.emitDrain();
    expect(rightWriter.writes).toEqual(right);
  });

  it.each([
    ['close', (queue: ReturnType<typeof createOutboundQueue>, writer: ControlledWriter) => queue.close(), 'OUTBOUND_QUEUE_CLOSED'],
    ['write callback failure', (queue: ReturnType<typeof createOutboundQueue>, writer: ControlledWriter) => writer.complete(1, new Error('write failed')), 'OUTBOUND_WRITE_FAILED'],
  ])('terminates once on %s while paused and ignores stale callbacks', (_name, terminate, expectedCode) => {
    const writer = new ControlledWriter([true, false, true]);
    const terminal: string[] = [];
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 3,
      maxOutboundQueueBytes: 1_000,
      onTerminal(error) {
        terminal.push(error.code);
      },
    });
    const frames = ['A', 'B', 'C'].map(createFrame);

    for (const frame of frames) queue.enqueue(frame);
    expect(writer.writes).toEqual(frames.slice(0, 2));
    expect(writer.drainListenerCount).toBe(1);
    terminate(queue, writer);
    writer.emitDrain(true);
    writer.complete(0);
    writer.complete(1, new Error('stale failure'));

    expect(writer.writes).toEqual(frames.slice(0, 2));
    expect(writer.drainListenerCount).toBe(0);
    expect(writer.destroyed).toHaveLength(1);
    expect(terminal).toEqual([expectedCode]);
  });

  it('terminates once on overflow while paused and never lets a stale drain resume output', () => {
    const writer = new ControlledWriter([true, false, true]);
    const terminal: string[] = [];
    const queue = createOutboundQueue(writer, {
      maxOutboundQueueFrames: 3,
      maxOutboundQueueBytes: 1_000,
      onTerminal(error) {
        terminal.push(error.code);
      },
    });
    const frames = ['A', 'B', 'C', 'D'].map(createFrame);

    queue.enqueue(frames[0]);
    queue.enqueue(frames[1]);
    queue.enqueue(frames[2]);
    expect(() => queue.enqueue(frames[3])).toThrow('OUTBOUND_QUEUE_OVERFLOW');
    writer.emitDrain(true);
    writer.complete(1);

    expect(writer.writes).toEqual(frames.slice(0, 2));
    expect(writer.drainListenerCount).toBe(0);
    expect(writer.destroyed).toHaveLength(1);
    expect(terminal).toEqual(['OUTBOUND_QUEUE_OVERFLOW']);
  });
});
