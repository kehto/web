import type { Socket } from 'node:net';

export interface OutboundQueue {
  enqueue(frame: Buffer): void;
  close(): void;
}

/** Create the single FIFO write owner for one accepted socket. */
export function createOutboundQueue(socket: Socket): OutboundQueue {
  const pending: Buffer[] = [];
  let closed = false;
  let waitingForDrain = false;

  const flush = (): void => {
    if (closed || waitingForDrain) return;
    while (pending.length > 0) {
      const frame = pending.shift();
      if (!frame) return;
      if (!socket.write(frame)) {
        waitingForDrain = true;
        socket.once('drain', () => {
          waitingForDrain = false;
          flush();
        });
        return;
      }
    }
  };

  return {
    enqueue(frame) {
      if (closed) return;
      pending.push(frame);
      flush();
    },
    close() {
      closed = true;
      pending.length = 0;
      socket.removeAllListeners('drain');
    },
  };
}
