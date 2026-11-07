import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockPubkey } from '../core/rng.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_RELAYS } from '../fixtures/nostr.js';
import { CVM_MOCK_ENTRY, CVM_SPEC_REF, MOCK_CVM_SERVERS, classifyMcpMessage, createMockCvmService } from './cvm.js';

type Msg = NappletMessage & Record<string, unknown>;

const ECHO = mockPubkey('cvm:echo-vm');
const DISTRO = mockPubkey('cvm:distro-vm');
const DEBIAN = LINUX_DISTROS[0] as (typeof LINUX_DISTROS)[number];

function setup(options: Parameters<typeof createMockCvmService>[0] = {}) {
  const service = createMockCvmService(options);
  const sent: Msg[] = [];
  const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
  const call = (message: Record<string, unknown>, windowId = 'w1') => service.handleMessage(windowId, message as unknown as NappletMessage, send);
  const request = (id: string, pubkey: string, message: Record<string, unknown>, extra: Record<string, unknown> = {}, windowId = 'w1') =>
    call({ type: 'cvm.request', id, server: { pubkey }, message: { jsonrpc: '2.0', ...message }, ...extra }, windowId);
  const last = (): Msg => sent.at(-1) as Msg;
  return { service, sent, call, request, last };
}

describe('createMockCvmService', () => {
  it('exposes descriptor, routes, entry and spec ref', () => {
    const { service } = setup();
    expect(service.descriptor.name).toBe('cvm');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.mock.routes).toEqual([
      'cvm.discover', 'cvm.request', 'cvm.close', 'cvm.registry.list', 'cvm.registry.has', 'cvm.registry.describe', 'cvm.registry.call',
    ]);
    expect(service.messageCapabilities).toBeUndefined();
    expect(CVM_MOCK_ENTRY).toMatchObject({ domain: 'cvm', kind: 'service', spec: CVM_SPEC_REF });
    expect(CVM_SPEC_REF).toEqual({ nap: 'NAP-CVM', status: 'draft', source: 'pr', pr: 31, sha: '28cf1bdb5c64', path: 'naps/NAP-CVM.md' });
  });

  it('cvm.discover returns the two seeded servers and honors search, kinds and limit', () => {
    const { call, last } = setup();
    call({ type: 'cvm.discover', id: 'd1' });
    expect(last()).toEqual({
      type: 'cvm.discover.result',
      id: 'd1',
      servers: [
        { pubkey: ECHO, relays: [MOCK_RELAYS.primary], name: 'EchoVM', description: 'Echoes tool arguments back as text', capabilities: ['tools'], paymentRequired: false },
        { pubkey: DISTRO, relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.discovery], name: 'DistroVM', description: 'Linux distribution catalog exposed through MCP over Nostr', capabilities: ['tools', 'resources'], paymentRequired: false },
      ],
    });
    call({ type: 'cvm.discover', id: 'd2', query: { search: 'catalog' } });
    expect((last().servers as Array<{ name: string }>).map((s) => s.name)).toEqual(['DistroVM']);
    call({ type: 'cvm.discover', id: 'd3', query: { kinds: [] } });
    expect(last().servers).toEqual([]);
    call({ type: 'cvm.discover', id: 'd4', query: { kinds: [11318] } });
    expect((last().servers as Array<{ name: string }>).map((s) => s.name)).toEqual(['DistroVM']);
    call({ type: 'cvm.discover', id: 'd5', query: { kinds: [1] } });
    expect(last()).toEqual({ type: 'cvm.discover.result', id: 'd5', error: 'unsupported kind' });
    call({ type: 'cvm.discover', id: 'd6', query: { limit: 1 } });
    expect(last().servers).toHaveLength(1);
    call({ type: 'cvm.discover', id: 'd7', query: { limit: 0 } });
    expect(last()).toEqual({ type: 'cvm.discover.result', id: 'd7', error: 'invalid request' });
  });

  it('cvm.request serves tools/list, tools/call and progress events, preserving the MCP id', () => {
    const { service, request, sent, last } = setup();
    request('r1', ECHO, { id: 1, method: 'tools/list' });
    expect(last()).toEqual({
      type: 'cvm.request.result',
      id: 'r1',
      message: { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'echo', description: 'Return the supplied text unchanged', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] } },
    });
    expect(service.mock.state().sessions.has(`w1:${ECHO}`)).toBe(true);

    request('r2', ECHO, { id: 'two', method: 'tools/call', params: { name: 'echo', arguments: { text: 'hello' } } });
    expect(last().message).toEqual({ jsonrpc: '2.0', id: 'two', result: { content: [{ type: 'text', text: 'hello' }], isError: false } });

    request('r3', DISTRO, { id: 3, method: 'tools/call', params: { name: 'distro.lookup', arguments: { query: 'debian' }, _meta: { progressToken: 'tool-3' } } });
    expect(sent.at(-2)).toEqual({
      type: 'cvm.event',
      server: { pubkey: DISTRO },
      message: { jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: 'tool-3', progress: 100, total: 100 } },
    });
    const lookup = (last().message as { result: { content: Array<{ text: string }> } }).result;
    expect(JSON.parse(lookup.content[0]?.text ?? '')).toEqual([
      { id: 'debian-12-netinst', distro: 'Debian', version: '12.7.0', fileName: 'debian-12.7.0-amd64-netinst.iso', sizeBytes: 631 * 1024 * 1024, sha256: DEBIAN.sha256 },
    ]);

    request('r4', DISTRO, { id: 4, method: 'tools/call', params: { name: 'distro.checksum', arguments: { id: 'arch-2024-11' } } });
    expect((last().message as { result: { content: Array<{ text: string }> } }).result.content[0]?.text).toBe(LINUX_DISTROS[3]?.sha256);
    request('r5', DISTRO, { id: 5, method: 'tools/call', params: { name: 'distro.checksum', arguments: { id: 'windows' } } });
    expect((last().message as { result: { isError: boolean } }).result.isError).toBe(true);
    request('r6', DISTRO, { id: 6, method: 'tools/call', params: { name: 'nope' } });
    expect(last().message).toEqual({ jsonrpc: '2.0', id: 6, error: { code: -32602, message: 'Unknown tool: nope' } });
  });

  it('cvm.request serves initialize, ping, resources and MCP method errors', () => {
    const { service, request, last } = setup();
    request('i1', DISTRO, { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, { options: { initialize: true, timeoutMs: 120_000 } });
    expect(last().message).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { protocolVersion: '2025-11-25', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'DistroVM', version: '1.0.0' } },
    });
    expect(service.mock.state().sessions.get(`w1:${DISTRO}`)?.initialized).toBe(true);
    request('i2', DISTRO, { id: 2, method: 'ping' });
    expect(last().message).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
    request('i3', DISTRO, { id: 3, method: 'resources/list' });
    const resources = (last().message as { result: { resources: Array<Record<string, unknown>> } }).result.resources;
    expect(resources).toHaveLength(LINUX_DISTROS.length);
    expect(resources[4]).toMatchObject({ uri: 'mock://distros/alpine-3-20-standard', name: 'alpine-3-20-standard', title: 'Alpine 3.20.3', mimeType: 'application/json' });
    request('i4', DISTRO, { id: 4, method: 'resources/read', params: { uri: 'mock://distros/alpine-3-20-standard' } });
    const contents = (last().message as { result: { contents: Array<{ uri: string; mimeType: string; text: string }> } }).result.contents;
    expect(contents).toHaveLength(1);
    expect(JSON.parse(contents[0]?.text ?? '')).toMatchObject({ id: 'alpine-3-20-standard', sha256: LINUX_DISTROS[4]?.sha256 });
    request('i5', DISTRO, { id: 5, method: 'resources/read', params: { uri: 'mock://nope' } });
    expect(last().message).toEqual({ jsonrpc: '2.0', id: 5, error: { code: -32002, message: 'Resource not found: mock://nope' } });
    request('i6', ECHO, { id: 6, method: 'resources/list' });
    expect(last().message).toEqual({ jsonrpc: '2.0', id: 6, error: { code: -32601, message: 'Method not found' } });
  });

  it('rejects malformed messages, references, options and duplicate ids with the NAP error text', () => {
    const { call, request, last } = setup({ maxTimeoutMs: 60_000, deniedServers: [mockPubkey('cvm:denied')] });
    call({ type: 'cvm.request', id: 'e1', server: { pubkey: ECHO } });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'e1', error: 'invalid message' });
    request('e2', ECHO, { id: null, method: 'ping' });
    expect(last().error).toBe('invalid message');
    request('e3', ECHO, { id: 1, result: {}, error: {} });
    expect(last().error).toBe('invalid message');
    call({ type: 'cvm.request', id: 'e4', server: { pubkey: ECHO }, message: [{ jsonrpc: '2.0', id: 1, method: 'ping' }] });
    expect(last().error).toBe('invalid message');
    call({ type: 'cvm.request', id: 'e5', server: { pubkey: 'short' }, message: { jsonrpc: '2.0', id: 1, method: 'ping' } });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'e5', error: 'invalid request' });
    request('e6', ECHO, { id: 1, method: 'ping' }, { options: { timeoutMs: 0 } });
    expect(last().error).toBe('invalid timeout');
    request('e7', ECHO, { id: 1, method: 'ping' }, { options: { timeoutMs: 300_001 } });
    expect(last().error).toBe('invalid timeout');
    request('e8', ECHO, { id: 1, method: 'ping' }, { options: { timeoutMs: 60_001 } });
    expect(last().error).toBe('timeout out of policy');
    request('e9', ECHO, { id: 1, method: 'ping' }, { options: { payment: 'maybe' } });
    expect(last().error).toBe('invalid request');
    request('e10', mockPubkey('cvm:unknown'), { id: 1, method: 'ping' });
    expect(last().error).toBe('server not found');
    request('e11', mockPubkey('cvm:denied'), { id: 1, method: 'ping' });
    expect(last().error).toBe('policy denied');
    request('e12', ECHO, { id: 7, method: 'ping' });
    expect(last().message).toBeDefined();
    request('e13', ECHO, { id: 7, method: 'ping' });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'e13', error: 'invalid message' });
    expect(classifyMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBe('notification');
    expect(classifyMcpMessage({ jsonrpc: '2.0', id: 'srv-1', result: {} })).toBe('response');
    expect(classifyMcpMessage({ jsonrpc: '2.0', id: 'srv-1', method: 'ping', result: {} })).toBeNull();
  });

  it('publishes notifications and answers to server requests with id-only acknowledgments', () => {
    const { service, request, sent, last } = setup();
    expect(service.emitNotification('w1', ECHO, 'notifications/tools/list_changed')).toBe(false);
    expect(service.emitServerRequest('w1', ECHO, 'ping')).toBeUndefined();
    request('n1', ECHO, { method: 'notifications/cancelled', params: { requestId: 2 } });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'n1' });

    expect(service.emitNotification('w1', ECHO, 'notifications/tools/list_changed')).toBe(true);
    expect(last()).toEqual({ type: 'cvm.event', server: { pubkey: ECHO }, message: { jsonrpc: '2.0', method: 'notifications/tools/list_changed' } });
    const id = service.emitServerRequest('w1', ECHO, 'ping');
    expect(id).toBe('srv-1');
    expect(last()).toEqual({ type: 'cvm.event', server: { pubkey: ECHO }, message: { jsonrpc: '2.0', id: 'srv-1', method: 'ping' } });
    request('a1', ECHO, { id: 'srv-1', result: {} });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'a1' });
    request('a2', ECHO, { id: 'srv-1', result: {} });
    expect(last()).toEqual({ type: 'cvm.request.result', id: 'a2', error: 'invalid message' });
    expect(service.emitNotification('w2', ECHO, 'ping')).toBe(false);
    expect(sent.filter((msg) => msg.type === 'cvm.event')).toHaveLength(2);
  });

  it('cvm.close releases only the caller session and is idempotent', () => {
    const { service, call, request, last } = setup();
    request('r1', ECHO, { id: 1, method: 'ping' });
    request('r2', ECHO, { id: 1, method: 'ping' }, {}, 'w2');
    call({ type: 'cvm.close', id: 'c1', server: { pubkey: ECHO } });
    expect(last()).toEqual({ type: 'cvm.close.result', id: 'c1' });
    expect(service.mock.state().sessions.has(`w1:${ECHO}`)).toBe(false);
    expect(service.mock.state().sessions.has(`w2:${ECHO}`)).toBe(true);
    call({ type: 'cvm.close', id: 'c2', server: { pubkey: ECHO } });
    expect(last()).toEqual({ type: 'cvm.close.result', id: 'c2' });
    call({ type: 'cvm.close', id: 'c3', server: { pubkey: 'x' } });
    expect(last()).toEqual({ type: 'cvm.close.result', id: 'c3', error: 'invalid request' });
    request('r3', ECHO, { id: 1, method: 'ping' });
    expect(last().message).toBeDefined();
  });

  it('registry routes resolve by family label or portable tool hash', () => {
    const { call, last } = setup();
    const distro = MOCK_CVM_SERVERS[1] as (typeof MOCK_CVM_SERVERS)[number];
    const lookup = distro.tools[0] as (typeof distro.tools)[number];
    call({ type: 'cvm.registry.list', id: 'l1' });
    const entries = last().entries as Array<Record<string, unknown>>;
    expect(entries.map((entry) => entry.family)).toEqual(['echo', 'distro']);
    expect(entries[1]).toMatchObject({
      description: 'Look up Linux distribution images and their checksums',
      schemaHashes: distro.tools.map((tool) => tool.schemaHash),
      selected: { pubkey: DISTRO, relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.discovery] },
    });
    call({ type: 'cvm.registry.list', id: 'l2', query: { schemaHash: lookup.schemaHash } });
    expect((last().entries as Array<{ tools: Array<{ name: string }> }>)[0]?.tools.map((tool) => tool.name)).toEqual(['distro.lookup']);
    call({ type: 'cvm.registry.list', id: 'l3', query: { search: 'echo', limit: 1 } });
    expect((last().entries as Array<{ family: string }>).map((entry) => entry.family)).toEqual(['echo']);
    call({ type: 'cvm.registry.list', id: 'l4', query: { schemaHash: 'nothex' } });
    expect(last()).toEqual({ type: 'cvm.registry.list.result', id: 'l4', error: 'invalid request' });

    call({ type: 'cvm.registry.has', id: 'h1', selector: { family: 'echo' } });
    expect(last()).toEqual({ type: 'cvm.registry.has.result', id: 'h1', has: true });
    call({ type: 'cvm.registry.has', id: 'h2', selector: { family: 'relatr' } });
    expect(last()).toEqual({ type: 'cvm.registry.has.result', id: 'h2', has: false });
    call({ type: 'cvm.registry.has', id: 'h3', selector: { schemaHash: lookup.schemaHash }, options: { server: { pubkey: ECHO } } });
    expect(last().has).toBe(false);
    call({ type: 'cvm.registry.has', id: 'h4', selector: {} });
    expect(last()).toEqual({ type: 'cvm.registry.has.result', id: 'h4', error: 'invalid request' });

    call({ type: 'cvm.registry.describe', id: 's1', selector: { schemaHash: lookup.schemaHash, family: 'other-label' } });
    expect(last()).toEqual({
      type: 'cvm.registry.describe.result',
      id: 's1',
      entry: {
        family: 'distro',
        description: 'Search the image catalog by distro, version or file name',
        schemaHashes: [lookup.schemaHash],
        selected: { pubkey: DISTRO, relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.discovery] },
        providers: [{ pubkey: DISTRO, relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.discovery] }],
        tools: [lookup],
      },
    });
    call({ type: 'cvm.registry.describe', id: 's2', selector: { family: 'nope' } });
    expect(last().error).toBe('family not found');
    call({ type: 'cvm.registry.describe', id: 's3', selector: { schemaHash: '0'.repeat(64) } });
    expect(last().error).toBe('schema mismatch');
    call({ type: 'cvm.registry.describe', id: 's4', selector: { family: 'distro' }, options: { server: { pubkey: ECHO } } });
    expect(last().error).toBe('provider unavailable');

    call({ type: 'cvm.registry.call', id: 'c1', selector: { schemaHash: lookup.schemaHash }, tool: 'distro.lookup', args: { query: 'arch' } });
    const result = last().result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]?.text ?? '')).toMatchObject([{ id: 'arch-2024-11' }]);
    call({ type: 'cvm.registry.call', id: 'c2', selector: { schemaHash: lookup.schemaHash }, tool: 'distro.checksum' });
    expect(last()).toEqual({ type: 'cvm.registry.call.result', id: 'c2', error: 'schema mismatch' });
    call({ type: 'cvm.registry.call', id: 'c3', selector: { family: 'echo' }, tool: 'echo', args: { text: 'x' }, options: { cache: 'bogus' } });
    expect(last().error).toBe('invalid request');
    call({ type: 'cvm.registry.call', id: 'c4', selector: { family: 'echo' }, tool: 'echo', args: { text: 'x' }, options: { cache: 'no-store' } });
    expect(last().result).toEqual({ content: [{ type: 'text', text: 'x' }], isError: false });
  });

  it('reset, window destruction and capability revocation drop sessions', () => {
    const { service, request } = setup();
    request('r1', ECHO, { id: 1, method: 'ping' });
    request('r2', DISTRO, { id: 1, method: 'ping' }, {}, 'w2');
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().sessions.keys()]).toEqual([`w2:${DISTRO}`]);
    service.onCapabilityRevoked?.('w2', 'cvm:call');
    expect(service.mock.state().sessions.size).toBe(0);
    request('r3', ECHO, { id: 1, method: 'ping' });
    service.mock.reset();
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
    expect(service.emitServerRequest('w1', ECHO, 'ping')).toBeUndefined();
  });
});
