import { describe, expect, it, vi } from 'vitest';
import { handleCvmRegistry } from './cvm-registry.js';
import { computeCvmToolSchemaHash } from './cvm-schema-hash.js';
import { createCvmService, type CvmTransport } from './cvm-service.js';
import type { CvmRegistryFamily } from './cvm-registry-types.js';
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';

/** Captured before any test stubs the global, so stubs can delegate real entropy. */
const nativeCrypto = globalThis.crypto;

// CEP-15 documentation's get_weather example. Digest independently checked with @contextvm/sdk.
const WEATHER = { name: 'get_weather', inputSchema: { properties: { location: { type: 'string' } }, required: ['location'] },
  outputSchema: { properties: { temperature: { type: 'number' } }, required: ['temperature'] } };
const HASH = 'c042f92e9ab085590656cea78e2628d44ffed49ea8da90aa32e208155fedd84e';
const SERVER = { pubkey: '60517f64548279854ee9a122531e4d1a413e3dc956e2d0a450217420623ca688', relays: ['wss://relay.example'] };
const FAMILIES: CvmRegistryFamily[] = [{ family: 'weather', server: SERVER, tools: [{ name: WEATHER.name, schemaHash: HASH }] }];
const tools = () => ({ jsonrpc: '2.0' as const, id: 1, result: { tools: [WEATHER] } });

describe('CVM registry schema verification', () => {
  it('matches the CEP-15 SDK vector and ignores documentation fields', async () => {
    expect(await computeCvmToolSchemaHash(WEATHER)).toBe(HASH);
    expect(await computeCvmToolSchemaHash({ ...WEATHER, inputSchema: { ...WEATHER.inputSchema, description: 'weather', 'x-note': true } })).toBe(HASH);
    expect(await computeCvmToolSchemaHash({ ...WEATHER, name: 'different' })).not.toBe(HASH);
    await expect(computeCvmToolSchemaHash({ name: 'remote', inputSchema: { $ref: 'https://schema.example/tool' } })).rejects.toThrow('schema mismatch');
  });

  it('selects by hash across family labels and pins provider/tool before invoking', async () => {
    const request = vi.fn(async (_server, method) => method === 'tools/list' ? tools() : { jsonrpc: '2.0' as const, id: 2, result: { content: [], structuredContent: { temperature: 20 } } });
    const entry = await handleCvmRegistry({ type: 'cvm.registry.describe', selector: { family: 'another-host-name', schemaHash: HASH } }, FAMILIES, request);
    expect(entry).toMatchObject({ entry: { schemaHashes: [HASH], selected: SERVER, tools: [{ name: 'get_weather', schemaHash: HASH }] } });
    const called = await handleCvmRegistry({ type: 'cvm.registry.call', selector: { schemaHash: HASH }, tool: 'get_weather', args: { location: 'Budapest' } }, FAMILIES, request);
    expect(called).toMatchObject({ result: { structuredContent: { temperature: 20 } } });
    expect(request).toHaveBeenLastCalledWith(SERVER, 'tools/call', { name: 'get_weather', arguments: { location: 'Budapest' } }, {});
    request.mockClear();
    await expect(handleCvmRegistry({ type: 'cvm.registry.call', selector: { schemaHash: HASH }, tool: 'other' }, FAMILIES, request)).rejects.toThrow('schema mismatch');
    expect(request.mock.calls.every(call => call[1] === 'tools/list')).toBe(true);
    request.mockClear();
    expect(await handleCvmRegistry({ type: 'cvm.registry.has', selector: { family: 'weather' }, options: { server: { pubkey: '0'.repeat(64) } } }, FAMILIES, request)).toEqual({ has: false });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects advertised hash forgery, missing family tools, malformed selectors and remote errors', async () => {
    const forged = vi.fn(async () => ({ jsonrpc: '2.0' as const, result: { tools: [{ ...WEATHER, _meta: { 'io.contextvm/common-schema': { schemaHash: '0'.repeat(64) } } }] } }));
    await expect(handleCvmRegistry({ type: 'cvm.registry.describe', selector: { family: 'weather' } }, FAMILIES, forged)).rejects.toThrow('schema mismatch');
    expect(await handleCvmRegistry({ type: 'cvm.registry.has', selector: { family: 'weather' } }, FAMILIES, forged)).toEqual({ has: false });
    await expect(handleCvmRegistry({ type: 'cvm.registry.has', selector: {} }, FAMILIES, forged)).rejects.toThrow('invalid request');
    expect(await handleCvmRegistry({ type: 'cvm.registry.has', selector: { family: 'weather' } }, [], forged)).toEqual({ has: false });
    await expect(handleCvmRegistry({ type: 'cvm.registry.list' }, [], forged)).rejects.toThrow('unsupported method');
  });

  it('sends a secure JSON-RPC id without crypto.randomUUID but still fails closed without crypto.subtle (kehto/web#351)', async () => {
    const provider = {
      getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
        if (this !== provider) throw new TypeError('Illegal invocation');
        return nativeCrypto.getRandomValues(bytes);
      }),
    };
    vi.stubGlobal('crypto', provider);
    try {
      const request = vi.fn(async () => tools());
      const transport: CvmTransport = { discover: async () => [], request, close: async () => {}, onEvent: () => ({ close() {} }) };
      const service = createCvmService({ transport, registry: FAMILIES });
      const send = vi.fn();
      service.handleMessage('a', { type: 'cvm.registry.describe', id: '1', selector: { family: 'weather' } } as unknown as NappletMessage, send);
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      expect(request).toHaveBeenCalledOnce();
      expect((request.mock.calls[0] as unknown as [unknown, { id: string }])[1].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      // Non-localhost HTTP has no crypto.subtle, so CEP-15 schema hashing cannot verify the family.
      expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'cvm.registry.describe.result', id: '1', error: expect.any(String) }));
      expect(send.mock.calls[0]![0]).not.toHaveProperty('entry');
      service.dispose();
    } finally { vi.unstubAllGlobals(); }
  });

  it('bounds requests and cancels work when the owning window disappears', async () => {
    const aborted = vi.fn();
    const transport: CvmTransport = {
      discover: async () => [], close: async () => {}, onEvent: () => ({ close() {} }),
      request: vi.fn(async (_server, _message, _options, execution) => new Promise<never>((_resolve, reject) => {
        execution!.signal.addEventListener('abort', () => { aborted(); reject(new Error('cancelled')); }, { once: true });
      })),
    };
    const service = createCvmService({ transport, registry: FAMILIES });
    const send = vi.fn();
    service.handleMessage('a', { type: 'cvm.registry.describe', id: '1', selector: { family: 'weather' }, options: { timeoutMs: 10 } } as unknown as NappletMessage, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'cvm.registry.describe.result', id: '1', error: 'relay timeout' }));
    expect(aborted).toHaveBeenCalledTimes(1);
    send.mockClear();
    service.handleMessage('a', { type: 'cvm.registry.has', id: '2', selector: { family: 'weather' } } as unknown as NappletMessage, send);
    await Promise.resolve();
    service.onWindowDestroyed?.('a');
    await vi.waitFor(() => expect(aborted).toHaveBeenCalledTimes(2));
    expect(send).not.toHaveBeenCalled();
    service.dispose();
  });

  it('cancels pending registry approval before close acknowledgement and isolates another endpoint', async () => {
    const signals = new Map<string, ApprovalSignal>();
    const transport: CvmTransport = { discover: async () => [], request: vi.fn(async () => tools()), close: vi.fn(async () => {}), onEvent: () => ({ close() {} }) };
    const service = createCvmService({ transport, registry: FAMILIES });
    service.onRegistered?.({ authorizeOperation: (windowId: string, _op: string, _requirements: unknown, _run: unknown, signal: ApprovalSignal) => {
      signals.set(windowId, signal);
      return new Promise(resolve => signal.addEventListener('abort', () => resolve({ status: 'cancelled' }), { once: true }));
    } } as unknown as ServiceRuntimeContext);
    const a = vi.fn(), b = vi.fn();
    for (const [windowId, send] of [['a', a], ['b', b]] as const) {
      service.handleMessage(windowId, { type: 'cvm.registry.describe', id: windowId, selector: { family: 'weather' } } as unknown as NappletMessage, send);
    }
    service.handleMessage('a', { type: 'cvm.close', id: 'close', server: SERVER } as NappletMessage, a);
    await vi.waitFor(() => expect(a).toHaveBeenCalledTimes(2));
    expect(a.mock.calls.map(call => call[0])).toEqual([
      { type: 'cvm.registry.describe.result', id: 'a', error: 'session closed' },
      { type: 'cvm.close.result', id: 'close' },
    ]);
    expect(signals.get('a')!.aborted).toBe(true);
    expect(signals.get('b')!.aborted).toBe(false);
    expect(b).not.toHaveBeenCalled();
    expect(transport.request).not.toHaveBeenCalled();
    expect(transport.close).not.toHaveBeenCalled();
    service.handleMessage('a', { type: 'cvm.close', id: 'again', server: SERVER } as NappletMessage, a);
    await vi.waitFor(() => expect(a).toHaveBeenLastCalledWith({ type: 'cvm.close.result', id: 'again' }));
    service.dispose();
  });
});
