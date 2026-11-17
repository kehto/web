import { describe, expect, it, vi } from 'vitest';
import { handleCvmRegistry } from './cvm-registry.js';
import { computeCvmToolSchemaHash } from './cvm-schema-hash.js';
import { createCvmService, type CvmTransport } from './cvm-service.js';
import type { CvmRegistryFamily } from './cvm-registry-types.js';
import type { NappletMessage } from '@napplet/core';

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
});
