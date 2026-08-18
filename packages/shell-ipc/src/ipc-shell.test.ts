import { stat } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
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
  return new Promise((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      const end = buffered.indexOf(0x0a);
      if (end === -1) return;
      try {
        resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffered.subarray(1, end))));
      } catch (error) {
        reject(error);
      }
    });
  });
}

describe('createIpcTransport', () => {
  it('retains the tracer public exports at the package root', () => {
    expect(createExportedIpcTransport).toBe(createIpcTransport);
    expect(exportedLimits).toBe(DEFAULT_IPC_LIMITS);
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
});
