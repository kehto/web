/** Machine-readable reasons an outbound queue enters a terminal state. */
export type OutboundQueueErrorCode =
  | 'INVALID_LIMIT'
  | 'OUTBOUND_QUEUE_OVERFLOW'
  | 'OUTBOUND_WRITE_FAILED'
  | 'OUTBOUND_QUEUE_CLOSED';

/** Error raised when outbound queue admission or delivery cannot continue. */
export class OutboundQueueError extends Error {
  constructor(readonly code: OutboundQueueErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'OutboundQueueError';
  }
}

interface WritablePeer {
  write(frame: Uint8Array, callback: (error?: Error | null) => void): boolean;
  once(event: 'drain', listener: () => void): void;
  off(event: 'drain', listener: () => void): void;
  destroy(error?: Error): void;
}

interface QueueEntry {
  readonly frame: Buffer;
  settled: boolean;
}

/** Bounds and terminal notification used to construct an outbound queue. */
export interface OutboundQueueOptions {
  readonly maxOutboundQueueFrames?: number;
  readonly maxOutboundQueueBytes?: number;
  readonly onTerminal?: (error: OutboundQueueError) => void;
}

/** FIFO owner for outbound socket frames. */
export interface OutboundQueue {
  enqueue(frame: Uint8Array): void;
  close(): void;
}

const DEFAULT_MAX_OUTBOUND_QUEUE_FRAMES = 64;
const DEFAULT_MAX_OUTBOUND_QUEUE_BYTES = 1_048_576;

/** Create the single FIFO write owner for one accepted socket. */
export function createOutboundQueue(peer: WritablePeer, options: OutboundQueueOptions = {}): OutboundQueue {
  const limits = validateQueueLimits(options);
  const pending: QueueEntry[] = [];
  let outstandingFrames = 0;
  let outstandingBytes = 0;
  let closed = false;
  let flushing = false;
  let waitingForDrain = false;

  const retire = (entry: QueueEntry): void => {
    if (entry.settled) return;
    entry.settled = true;
    outstandingFrames -= 1;
    outstandingBytes -= entry.frame.length;
  };

  const detachDrain = (): void => {
    if (!waitingForDrain) return;
    waitingForDrain = false;
    peer.off('drain', handleDrain);
  };

  const terminate = (error: OutboundQueueError): void => {
    if (closed) return;
    closed = true;
    detachDrain();
    for (const entry of pending.splice(0)) retire(entry);
    peer.destroy(error);
    options.onTerminal?.(error);
  };

  const handleWriteComplete = (entry: QueueEntry, error?: Error | null): void => {
    retire(entry);
    if (error && !closed) {
      terminate(new OutboundQueueError('OUTBOUND_WRITE_FAILED', error.message));
    }
  };

  const flush = (): void => {
    if (closed || waitingForDrain || flushing) return;
    flushing = true;
    try {
      while (!closed && !waitingForDrain && pending.length > 0) {
        const entry = pending.shift();
        if (!entry) return;
        const accepted = peer.write(entry.frame, (error) => handleWriteComplete(entry, error));
        if (!accepted && !closed) {
          waitingForDrain = true;
          peer.once('drain', handleDrain);
        }
      }
    } finally {
      flushing = false;
    }
  };

  const handleDrain = (): void => {
    if (closed || !waitingForDrain) return;
    detachDrain();
    flush();
  };

  return {
    enqueue(frame) {
      if (closed) {
        throw new OutboundQueueError('OUTBOUND_QUEUE_CLOSED', 'The outbound queue is closed.');
      }
      if (!(frame instanceof Uint8Array)) {
        throw new TypeError('Outbound queue frames must be encoded bytes.');
      }
      const ownedFrame = Buffer.from(frame);
      let nextFrames: number;
      let nextBytes: number;
      try {
        nextFrames = checkedAdd(outstandingFrames, 1);
        nextBytes = checkedAdd(outstandingBytes, ownedFrame.length);
      } catch (error) {
        if (error instanceof OutboundQueueError) terminate(error);
        throw error;
      }
      if (nextFrames > limits.maxOutboundQueueFrames || nextBytes > limits.maxOutboundQueueBytes) {
        const error = new OutboundQueueError('OUTBOUND_QUEUE_OVERFLOW', 'Configured queue limits would be exceeded.');
        terminate(error);
        throw error;
      }
      const entry: QueueEntry = { frame: ownedFrame, settled: false };
      pending.push(entry);
      outstandingFrames = nextFrames;
      outstandingBytes = nextBytes;
      flush();
    },
    close() {
      if (closed) return;
      if (pending.length > 0 || outstandingFrames > 0 || waitingForDrain) {
        terminate(new OutboundQueueError('OUTBOUND_QUEUE_CLOSED', 'The outbound queue was closed.'));
        return;
      }
      closed = true;
      detachDrain();
    },
  };
}

function validateQueueLimits(options: OutboundQueueOptions): {
  readonly maxOutboundQueueFrames: number;
  readonly maxOutboundQueueBytes: number;
} {
  const maxOutboundQueueFrames = options.maxOutboundQueueFrames ?? DEFAULT_MAX_OUTBOUND_QUEUE_FRAMES;
  const maxOutboundQueueBytes = options.maxOutboundQueueBytes ?? DEFAULT_MAX_OUTBOUND_QUEUE_BYTES;
  for (const [name, limit] of Object.entries({ maxOutboundQueueFrames, maxOutboundQueueBytes })) {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new OutboundQueueError('INVALID_LIMIT', `${name} must be a non-negative safe integer.`);
    }
  }
  return { maxOutboundQueueFrames, maxOutboundQueueBytes };
}

function checkedAdd(left: number, right: number): number {
  if (left > Number.MAX_SAFE_INTEGER - right) {
    throw new OutboundQueueError('OUTBOUND_QUEUE_OVERFLOW', 'Queue accounting exceeds the safe integer range.');
  }
  return left + right;
}
