import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IPC_LIMITS as exportedLimits, createIpcTransport as createExportedIpcTransport } from './index.js';
import { encodeJsonSequence } from './json-sequence.js';
import { DEFAULT_IPC_LIMITS, createIpcTransport } from './ipc-shell.js';
import type { IpcEndpointRegistration } from './types.js';

function connectPeer(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function waitForClose(socket: Socket): Promise<void> {
  return new Promise((resolve) => socket.once('close', () => resolve()));
}

function receiveFrame(socket: Socket): Promise<unknown> {
  return receiveFrames(socket, 1).then(([frame]) => frame);
}

function receiveFrames(socket: Socket, count: number): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    const frames: unknown[] = [];
    socket.on('data', (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (true) {
        const end = buffered.indexOf(0x0a);
        if (end === -1) return;
        try {
          frames.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffered.subarray(1, end))));
          buffered = buffered.subarray(end + 1);
          if (frames.length === count) {
            resolve(frames);
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }
      }
    });
  });
}

describe('createIpcTransport', () => {
  it('retains the tracer public exports at the package root', () => {
    expect(createExportedIpcTransport).toBe(createIpcTransport);
    expect(exportedLimits).toBe(DEFAULT_IPC_LIMITS);
  });

  it.each([
    ['maxPathBytes', 0],
    ['maxFrameBytes', 0],
    ['maxBufferedInputBytes', 0],
    ['maxOutboundQueueFrames', -1],
    ['maxOutboundQueueBytes', -1],
  ])('rejects invalid transport limit %s before endpoint registration', async (name, value) => {
    await expect(createIpcTransport({
      limits: { [name]: value } as never,
    })).rejects.toMatchObject({ code: 'INVALID_LIMIT' });
  });

  it.each([
    ['a Map', new Map([['policy', 'original']])],
    ['a Set', new Set(['policy'])],
    ['a Date', new Date()],
    ['a function', () => undefined],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a cycle', (() => { const value: { self?: unknown } = {}; value.self = value; return value; })()],
  ])('rejects %s in environment before allocating a production endpoint', async (_description, environment) => {
    const baseDirectory = await mkdtemp(`${tmpdir()}/kehto-ipc-invalid-registration-`);
    const transport = await createIpcTransport({ baseDirectory });

    try {
      await expect(transport.registerEndpoint({
        windowId: 'invalid-registration',
        dTag: 'example',
        aggregateHash: 'abc123',
        environment: { invalid: environment } as never,
      }, { onEnvelope() {} })).rejects.toMatchObject({ code: 'INVALID_REGISTRATION' });
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      await transport.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('carries an immutable host-bound envelope through a raw Unix socket in both directions', async () => {
    const received: unknown[] = [];
    let boundRegistration: IpcEndpointRegistration | undefined;
    let resolveReceived: (() => void) | undefined;
    const receivedOnce = new Promise<void>((resolve) => {
      resolveReceived = resolve;
    });
    const registration = {
      windowId: 'raw-peer',
      dTag: 'example',
      aggregateHash: 'abc123',
      environment: { host: { label: 'original' } },
    } as const;
    const transport = await createIpcTransport();
    let endpoint: Awaited<ReturnType<typeof transport.registerEndpoint>> | undefined;
    let client: Socket | undefined;

    try {
      endpoint = await transport.registerEndpoint(registration, {
        onEnvelope(envelope, bound) {
          received.push(envelope);
          boundRegistration = bound;
          resolveReceived?.();
        },
      });
      const socketDirectory = dirname(endpoint.path);
      expect(Buffer.byteLength(endpoint.path, 'utf8')).toBeLessThanOrEqual(90);
      expect((await stat(socketDirectory)).mode & 0o777).toBe(0o700);
      expect(Object.isFrozen(endpoint.registration)).toBe(true);
      expect(Object.isFrozen(endpoint.registration.environment)).toBe(true);
      expect(Object.isFrozen(endpoint.registration.environment.host)).toBe(true);

      (registration.environment.host as { label: string }).label = 'mutated-by-caller';
      client = await connectPeer(endpoint.path);
      const inbound = { type: 'shell.ready' };
      const frame = encodeJsonSequence(inbound);
      client.write(frame.subarray(0, 3));
      client.write(frame.subarray(3));
      await receivedOnce;
      expect(received).toEqual([inbound]);
      expect(boundRegistration).toEqual({
        windowId: 'raw-peer',
        dTag: 'example',
        aggregateHash: 'abc123',
        environment: { host: { label: 'original' } },
      });
      expect(Object.isFrozen(boundRegistration)).toBe(true);

      const response = { type: 'shell.init', version: 1 };
      const responsePromise = receiveFrame(client);
      endpoint.send(response);
      await expect(responsePromise).resolves.toEqual(response);

      for (const claim of ['windowId', 'dTag', 'aggregateHash', 'environment']) {
        const peer = await connectPeer(endpoint.path);
        const closed = waitForClose(peer);
        peer.write(encodeJsonSequence({ type: 'shell.ready', [claim]: 'peer-controlled' }));
        await closed;
      }
      expect(received).toHaveLength(1);
    } finally {
      client?.destroy();
      await endpoint?.close();
      await transport.close();
    }

    await expect(stat(endpoint?.path ?? '')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(dirname(endpoint?.path ?? ''))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('applies endpoint outbound limits and reports only the overflowing peer', async () => {
    const diagnostics: string[] = [];
    const transport = await createIpcTransport({
      limits: { maxOutboundQueueFrames: 0, maxOutboundQueueBytes: 0 },
      onDiagnostic(diagnostic) {
        diagnostics.push(diagnostic.code);
      },
    });
    const endpoint = await transport.registerEndpoint({
      windowId: 'outbound-limit',
      dTag: 'example',
      aggregateHash: 'abc123',
      environment: {},
    }, { onEnvelope() {} });
    const client = await connectPeer(endpoint.path);

    try {
      const closed = waitForClose(client);
      expect(() => endpoint.send({ type: 'shell.init' } as never)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
      await closed;
      expect(diagnostics).toEqual(['OUTBOUND_QUEUE_OVERFLOW']);
    } finally {
      client.destroy();
      await endpoint.close();
      await transport.close();
    }
  });

  it('rejects a coalesced valid frame after a peer identity claim', async () => {
    const received: unknown[] = [];
    const transport = await createIpcTransport();
    const endpoint = await transport.registerEndpoint({
      windowId: 'identity-claim',
      dTag: 'example',
      aggregateHash: 'abc123',
      environment: {},
    }, {
      onEnvelope(envelope) {
        received.push(envelope);
      },
    });
    const peer = await connectPeer(endpoint.path);

    try {
      const closed = waitForClose(peer);
      peer.write(Buffer.concat([
        encodeJsonSequence({ type: 'shell.ready', windowId: 'peer-controlled' }),
        encodeJsonSequence({ type: 'shell.ready' }),
      ]));
      await closed;
      expect(received).toEqual([]);
    } finally {
      peer.destroy();
      await endpoint.close();
      await transport.close();
    }
  });

  it('continues broadcasting after one peer outbound queue overflows', async () => {
    const transport = await createIpcTransport({
      limits: { maxOutboundQueueFrames: 1, maxOutboundQueueBytes: 10_000_000 },
    });
    const endpoint = await transport.registerEndpoint({
      windowId: 'peer-isolation',
      dTag: 'example',
      aggregateHash: 'abc123',
      environment: {},
    }, { onEnvelope() {} });
    const slowPeer = await connectPeer(endpoint.path);
    const first = { type: 'shell.init', padding: 'x'.repeat(5_000_000) };
    const second = { type: 'shell.init', sequence: 2 };
    let healthyPeer: Socket | undefined;

    try {
      endpoint.send(first as never);
      healthyPeer = await connectPeer(endpoint.path);
      const received = receiveFrame(healthyPeer);
      expect(() => endpoint.send(second as never)).toThrow('OUTBOUND_QUEUE_OVERFLOW');
      await expect(received).resolves.toEqual(second);
    } finally {
      slowPeer.destroy();
      healthyPeer?.destroy();
      await endpoint.close();
      await transport.close();
    }
  });
});
