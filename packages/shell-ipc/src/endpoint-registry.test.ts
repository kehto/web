import { lstat, mkdtemp, readdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEndpointRegistry } from './endpoint-registry.js';
import { createIpcTransport } from './ipc-shell.js';

const registration = {
  windowId: 'window-1',
  dTag: 'example',
  aggregateHash: 'abc123',
  environment: {},
} as const;

function deferred(): { readonly promise: Promise<void>; resolve(): void; reject(error: Error): void } {
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((error: Error) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
    reject: (error) => rejectPromise?.(error),
  };
}

describe('createEndpointRegistry', () => {
  it('reserves before asynchronous creation so a parallel duplicate has no second winner', async () => {
    const registry = createEndpointRegistry();
    const createGate = deferred();
    let createCount = 0;
    const firstAttempt = (async () => {
      const reservation = registry.reserveRegistration(registration);
      createCount += 1;
      await createGate.promise;
      return reservation;
    })();

    await Promise.resolve();
    let duplicateError: unknown;
    try {
      registry.reserveRegistration(registration);
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toMatchObject({ code: 'ENDPOINT_EXISTS' });
    expect(createCount).toBe(1);
    createGate.resolve();
    await expect(firstAttempt).resolves.toMatchObject({ generation: 1, state: 'creating' });
  });

  it('rolls back only a matching creating generation and gives retry a higher generation', () => {
    const registry = createEndpointRegistry();
    const failed = registry.reserveRegistration(registration);

    expect(registry.rollbackRegistration(failed.windowId, failed.generation)).toBe(failed);
    expect(registry.get(failed.windowId)).toBeUndefined();

    const retry = registry.reserveRegistration(registration);
    expect(retry.generation).toBeGreaterThan(failed.generation);
    expect(registry.rollbackRegistration(failed.windowId, failed.generation)).toBeUndefined();
    expect(registry.get(retry.windowId)).toBe(retry);
  });

  it('keeps a replacement live when delayed old close and cleanup callbacks arrive', () => {
    const registry = createEndpointRegistry();
    const first = registry.reserveRegistration(registration);

    expect(registry.beginClosing(first.windowId, first.generation)).toBe(first);
    expect(registry.removeIfCurrentGeneration(first.windowId, first.generation)).toMatchObject({ generation: first.generation });

    const replacement = registry.reserveRegistration(registration);
    expect(registry.beginClosing(first.windowId, first.generation)).toBeUndefined();
    expect(registry.removeIfCurrentGeneration(first.windowId, first.generation)).toBeUndefined();
    expect(registry.get(replacement.windowId)).toBe(replacement);
  });

  it('treats repeated matching close transitions as idempotent', () => {
    const registry = createEndpointRegistry();
    const record = registry.reserveRegistration(registration);

    expect(registry.beginClosing(record.windowId, record.generation)).toBe(record);
    expect(registry.beginClosing(record.windowId, record.generation)).toBeUndefined();
    expect(registry.removeIfCurrentGeneration(record.windowId, record.generation)).toMatchObject({ generation: record.generation });
    expect(registry.removeIfCurrentGeneration(record.windowId, record.generation)).toBeUndefined();
  });

  it('creates one real directory/listener for parallel duplicate registration', async () => {
    const base = await mkdtemp(join('/tmp', 'kehto-ipc-registry-'));
    const transport = await createIpcTransport({ baseDirectory: base });
    let endpoint: Awaited<ReturnType<typeof transport.registerEndpoint>> | undefined;

    try {
      const first = transport.registerEndpoint(registration, { onEnvelope() {} });
      await expect(transport.registerEndpoint(registration, { onEnvelope() {} })).rejects.toMatchObject({ code: 'ENDPOINT_EXISTS' });
      endpoint = await first;
      expect(await readdir(base)).toHaveLength(1);
      expect((await lstat(endpoint.path)).isSocket()).toBe(true);
    } finally {
      await endpoint?.close();
      await transport.close();
      await rmdir(base);
    }
  });

  it('keeps a replacement endpoint live after repeated old close and transport cleanup calls', async () => {
    const base = await mkdtemp(join('/tmp', 'kehto-ipc-registry-'));
    const transport = await createIpcTransport({ baseDirectory: base });
    const first = await transport.registerEndpoint(registration, { onEnvelope() {} });
    let replacement: Awaited<ReturnType<typeof transport.registerEndpoint>> | undefined;

    try {
      await first.close();
      await transport.unregisterEndpoint(registration.windowId);
      await transport.unregisterEndpoint(registration.windowId);
      replacement = await transport.registerEndpoint(registration, { onEnvelope() {} });
      await first.close();
      expect((await lstat(replacement.path)).isSocket()).toBe(true);
    } finally {
      await replacement?.close();
      await transport.close();
      await rmdir(base);
    }
  });
});
