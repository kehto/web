/**
 * domains/cvm.ts — Mock NAP-CVM service.
 *
 * Spec: naps/NAP-CVM.md @ napplet/naps PR #31 head 28cf1bdb5c64 (draft)
 * Routes: cvm.discover, cvm.request, cvm.close, cvm.registry.list,
 *         cvm.registry.has, cvm.registry.describe, cvm.registry.call
 * Pushes: cvm.event (progress notifications; scripted server notifications
 *         and server requests via controls)
 * Spec gaps / decisions:
 * - `@napplet/nap@0.32.0` registry envelopes carry `family: string`; the
 *   draft uses a `selector` record (`schemaHash` | `family`) and required
 *   `schemaHashes`. The mock follows the draft and declares those shapes
 *   locally (drift noted, not copied).
 * - Payment is never required by the seeded servers, so `payment required`/
 *   `payment denied` are never produced; `payment` is validated only.
 * - `cvm.close` on a server with no open session succeeds (the draft says
 *   closing an already closed session succeeds; an unknown server is
 *   treated the same way rather than `server not found`).
 * - Every accepted request completes synchronously; `relay timeout` is never
 *   produced. `timeoutMs` is validated against `maxTimeoutMs` policy.
 * - `policy denied` is produced only for pubkeys listed in `deniedServers`.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { CvmServerRef, McpMessage } from '@napplet/nap/cvm/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import {
  MOCK_CVM_ANNOUNCEMENT_KINDS,
  MOCK_CVM_SERVERS,
  classifyMcpMessage,
  isCvmServerRef,
  readMockCvmResource,
  runMockCvmTool,
  validateCvmOptions,
  type MockCvmServerFixture,
  type MockCvmTool,
} from './cvm-fixtures.js';

export type { McpForm, MockCvmServerFixture, MockCvmTool } from './cvm-fixtures.js';
export {
  MOCK_CVM_ANNOUNCEMENT_KINDS,
  MOCK_CVM_SERVERS,
  classifyMcpMessage,
  findMockCvmServer,
  isCvmServerRef,
  readMockCvmResource,
  runMockCvmTool,
  validateCvmOptions,
} from './cvm-fixtures.js';

/**
 * NAP-CVM draft the mock implements.
 *
 * @example
 * ```ts
 * CVM_SPEC_REF.pr === 31;
 * ```
 */
export const CVM_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CVM',
  status: 'draft',
  source: 'pr',
  pr: 31,
  sha: '28cf1bdb5c64',
  path: 'naps/NAP-CVM.md',
};

/**
 * One endpoint's session with one server.
 *
 * @example
 * ```ts
 * const session = service.mock.state().sessions.get('win-1:' + pubkey);
 * session?.initialized;
 * ```
 */
export interface MockCvmSession {
  /** Owning window. */
  windowId: string;
  /** Server pubkey. */
  pubkey: string;
  /** Client request ids already used in this session (`type:value`). */
  usedRequestIds: Set<string>;
  /** Server-initiated request ids awaiting a napplet response. */
  outstandingServerRequests: Set<string>;
  /** Whether `initialize` ran. */
  initialized: boolean;
}

/**
 * Registry entry wire shape (draft `CvmRegistryEntry`).
 *
 * @example
 * ```ts
 * const entry: MockCvmRegistryEntry = { family: 'echo', schemaHashes: [], tools: [], selected: { pubkey: 'ab'.repeat(32) }, providers: [] };
 * ```
 */
export interface MockCvmRegistryEntry {
  /** Shell-local family label. */
  family: string;
  /** Family description. */
  description?: string;
  /** Distinct CEP-15 hashes of `tools`. */
  schemaHashes: string[];
  /** Selected provider. */
  selected: CvmServerRef;
  /** Candidate providers. */
  providers: CvmServerRef[];
  /** Tools in the entry. */
  tools: MockCvmTool[];
}

/**
 * In-memory state of the mock CVM service.
 *
 * @example
 * ```ts
 * service.mock.state().sessions.size;
 * ```
 */
export interface MockCvmState {
  /** Seeded servers. */
  servers: MockCvmServerFixture[];
  /** `${windowId}:${pubkey}` → session. */
  sessions: Map<string, MockCvmSession>;
  /** Server-initiated requests issued so far. */
  serverRequests: number;
}

/**
 * Options for `createMockCvmService`.
 *
 * @example
 * ```ts
 * const cvm = createMockCvmService({ maxTimeoutMs: 60_000 });
 * ```
 */
export interface MockCvmOptions extends MockServiceOptions {
  /** Policy ceiling for `timeoutMs`. Default 300000. */
  maxTimeoutMs?: number;
  /** Server pubkeys whose requests fail with `policy denied`. */
  deniedServers?: readonly string[];
}

/**
 * Mock CVM service with server-push controls.
 *
 * @example
 * ```ts
 * const cvm = createMockCvmService();
 * cvm.emitNotification('win-1', pubkey, 'notifications/tools/list_changed');
 * ```
 */
export type MockCvmService = MockService<MockCvmState> & {
  /** Push an MCP notification from a server to a window with an open session. */
  emitNotification(windowId: string, pubkey: string, method: string, params?: Record<string, unknown>): boolean;
  /** Push a server-initiated MCP request; returns its id, or `undefined` without a session. */
  emitServerRequest(windowId: string, pubkey: string, method: string, params?: Record<string, unknown>): string | undefined;
};

type Context = MockRouteContext<MockCvmState>;
type Fields = Record<string, unknown>;

const HEX64 = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionKey(windowId: string, pubkey: string): string {
  return `${windowId}:${pubkey}`;
}

function openSession(state: MockCvmState, windowId: string, pubkey: string): MockCvmSession {
  const key = sessionKey(windowId, pubkey);
  let session = state.sessions.get(key);
  if (!session) {
    session = { windowId, pubkey, usedRequestIds: new Set(), outstandingServerRequests: new Set(), initialized: false };
    state.sessions.set(key, session);
  }
  return session;
}

function closeWindowSessions(state: MockCvmState, windowId: string): void {
  for (const [key, session] of state.sessions) if (session.windowId === windowId) state.sessions.delete(key);
}

function validateDiscoverQuery(value: unknown): string | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return 'invalid request';
  if (value.search !== undefined && typeof value.search !== 'string') return 'invalid request';
  if (value.kinds !== undefined && !(Array.isArray(value.kinds) && value.kinds.every((k) => Number.isInteger(k) && (k as number) >= 0))) return 'invalid request';
  if (value.relays !== undefined && !(Array.isArray(value.relays) && value.relays.every((r) => typeof r === 'string'))) return 'invalid request';
  if (value.limit !== undefined && !(Number.isInteger(value.limit) && (value.limit as number) > 0)) return 'invalid request';
  return null;
}

function announces(fixture: MockCvmServerFixture, kind: number): boolean {
  if (kind === 11316) return true;
  if (kind === 11317) return fixture.tools.length > 0;
  return kind === 11318 && fixture.resources.length > 0;
}

function discoverRoute({ message, state, reply, fail }: Context): void {
  const invalid = validateDiscoverQuery(message.query);
  if (invalid) { fail(invalid); return; }
  const query = (message.query ?? {}) as { search?: string; kinds?: number[]; limit?: number };
  let servers = state.servers;
  if (query.kinds) {
    if (query.kinds.some((kind) => !MOCK_CVM_ANNOUNCEMENT_KINDS.includes(kind))) { fail('unsupported kind'); return; }
    const kinds = query.kinds;
    servers = servers.filter((item) => kinds.some((kind) => announces(item, kind)));
  }
  if (query.search) {
    const needle = query.search.toLowerCase();
    servers = servers.filter((item) => `${item.server.name} ${item.server.description} ${(item.server.capabilities ?? []).join(' ')}`.toLowerCase().includes(needle));
  }
  if (query.limit !== undefined) servers = servers.slice(0, query.limit);
  reply({ servers: servers.map((item) => ({ ...item.server })) });
}

function mcpOk(id: McpMessage['id'], result: Record<string, unknown>): McpMessage {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id: McpMessage['id'], code: number, message: string): McpMessage {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function dispatchMcp(fixture: MockCvmServerFixture, session: MockCvmSession, mcp: McpMessage): McpMessage {
  const params = (mcp.params ?? {}) as Record<string, unknown>;
  switch (mcp.method) {
    case 'initialize':
      session.initialized = true;
      return mcpOk(mcp.id, {
        protocolVersion: '2025-11-25',
        capabilities: Object.fromEntries((fixture.server.capabilities ?? []).map((name) => [name, {}])),
        serverInfo: { name: fixture.server.name, version: '1.0.0' },
      });
    case 'ping':
      return mcpOk(mcp.id, {});
    case 'tools/list':
      return mcpOk(mcp.id, { tools: fixture.tools.map(({ schemaHash: _hash, ...tool }) => tool) });
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      const args = isRecord(params.arguments) ? params.arguments : {};
      const result = runMockCvmTool(fixture, name, args);
      return result ? mcpOk(mcp.id, result) : mcpError(mcp.id, -32602, `Unknown tool: ${name}`);
    }
    case 'resources/list':
      if (!fixture.server.capabilities?.includes('resources')) return mcpError(mcp.id, -32601, 'Method not found');
      return mcpOk(mcp.id, { resources: fixture.resources.map((item) => ({ ...item })) });
    case 'resources/read': {
      const uri = typeof params.uri === 'string' ? params.uri : '';
      const contents = readMockCvmResource(fixture, uri);
      return contents ? mcpOk(mcp.id, { contents }) : mcpError(mcp.id, -32002, `Resource not found: ${uri}`);
    }
    default:
      return mcpError(mcp.id, -32601, 'Method not found');
  }
}

function progressEvent(server: CvmServerRef, token: unknown): NappletMessage {
  return {
    type: 'cvm.event',
    server: { pubkey: server.pubkey },
    message: { jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, progress: 100, total: 100 } },
  } as NappletMessage;
}

function registryEntry(fixture: MockCvmServerFixture, tools: readonly MockCvmTool[], description: string | undefined): MockCvmRegistryEntry {
  const ref: CvmServerRef = { pubkey: fixture.server.pubkey, ...(fixture.server.relays ? { relays: [...fixture.server.relays] } : {}) };
  return {
    family: fixture.family,
    ...(description !== undefined ? { description } : {}),
    schemaHashes: [...new Set(tools.map((item) => item.schemaHash))],
    selected: ref,
    providers: [ref],
    tools: tools.map((item) => ({ ...item, inputSchema: { ...item.inputSchema } })),
  };
}

/** Resolve a draft `CvmRegistrySelector` (+ optional provider pin) to an entry, or an error string. */
function resolveSelector(state: MockCvmState, selector: unknown, pin: unknown): { entry: MockCvmRegistryEntry; fixture: MockCvmServerFixture } | string {
  if (!isRecord(selector)) return 'invalid request';
  const { schemaHash, family } = selector;
  if (schemaHash !== undefined && (typeof schemaHash !== 'string' || !HEX64.test(schemaHash))) return 'invalid request';
  if (family !== undefined && (typeof family !== 'string' || family.length === 0)) return 'invalid request';
  if (schemaHash === undefined && family === undefined) return 'invalid request';
  let found: { entry: MockCvmRegistryEntry; fixture: MockCvmServerFixture } | undefined;
  if (typeof schemaHash === 'string') {
    for (const fixture of state.servers) {
      const tool = fixture.tools.find((item) => item.schemaHash === schemaHash);
      if (tool) { found = { entry: registryEntry(fixture, [tool], tool.description), fixture }; break; }
    }
    if (!found) return 'schema mismatch';
  } else {
    const fixture = state.servers.find((item) => item.family === family);
    if (!fixture) return 'family not found';
    found = { entry: registryEntry(fixture, fixture.tools, fixture.familyDescription), fixture };
  }
  if (pin !== undefined && (!isCvmServerRef(pin) || pin.pubkey !== found.fixture.server.pubkey)) return 'provider unavailable';
  return found;
}

function registryListRoute({ message, state, reply, fail }: Context): void {
  const query = message.query ?? {};
  if (!isRecord(query)) { fail('invalid request'); return; }
  const { search, family, schemaHash, category, limit } = query;
  if ([search, family, category].some((item) => item !== undefined && typeof item !== 'string')) { fail('invalid request'); return; }
  if (schemaHash !== undefined && (typeof schemaHash !== 'string' || !HEX64.test(schemaHash))) { fail('invalid request'); return; }
  if (family !== undefined && family === '') { fail('invalid request'); return; }
  if (limit !== undefined && !(Number.isInteger(limit) && (limit as number) > 0)) { fail('invalid request'); return; }
  let entries: MockCvmRegistryEntry[];
  if (typeof schemaHash === 'string') {
    const resolved = resolveSelector(state, { schemaHash }, undefined);
    entries = typeof resolved === 'string' ? [] : [resolved.entry];
  } else {
    entries = state.servers
      .filter((item) => family === undefined || item.family === family)
      .map((item) => registryEntry(item, item.tools, item.familyDescription));
  }
  if (typeof search === 'string' && search.length > 0) {
    const needle = search.toLowerCase();
    entries = entries.filter((entry) => `${entry.family} ${entry.description ?? ''} ${entry.tools.map((t) => t.name).join(' ')}`.toLowerCase().includes(needle));
  }
  if (typeof limit === 'number') entries = entries.slice(0, limit);
  reply({ entries });
}

function registryDescribeRoute({ message, state, reply, fail }: Context): void {
  const options = message.options;
  if (options !== undefined && !isRecord(options)) { fail('invalid request'); return; }
  const resolved = resolveSelector(state, message.selector, isRecord(options) ? options.server : undefined);
  if (typeof resolved === 'string') { fail(resolved); return; }
  reply({ entry: resolved.entry });
}

function registryHasRoute({ message, state, reply, fail }: Context): void {
  const options = message.options;
  if (options !== undefined && !isRecord(options)) { fail('invalid request'); return; }
  const resolved = resolveSelector(state, message.selector, isRecord(options) ? options.server : undefined);
  if (resolved === 'invalid request') { fail(resolved); return; }
  reply({ has: typeof resolved !== 'string' });
}

/**
 * Create the mock NAP-CVM service.
 *
 * @param options - Policy ceiling and denied servers.
 * @returns A `ServiceHandler` for `runtime.registerService('cvm', …)` with mock controls.
 * @example
 * ```ts
 * const cvm = createMockCvmService();
 * cvm.handleMessage('win-1', { type: 'cvm.discover', id: 'd1' }, console.log);
 * ```
 */
export function createMockCvmService(options: MockCvmOptions = {}): MockCvmService {
  const maxTimeoutMs = options.maxTimeoutMs ?? 300_000;
  const denied = new Set(options.deniedServers ?? []);

  const requestRoute = ({ message, windowId, state, reply, fail, push }: Context): void => {
    if (!isCvmServerRef(message.server)) { fail('invalid request'); return; }
    const form = classifyMcpMessage(message.message);
    if (!form) { fail('invalid message'); return; }
    const optionError = validateCvmOptions(message.options, maxTimeoutMs);
    if (optionError) { fail(optionError); return; }
    const server = message.server;
    if (denied.has(server.pubkey)) { fail('policy denied'); return; }
    const fixture = state.servers.find((item) => item.server.pubkey === server.pubkey);
    if (!fixture) { fail('server not found'); return; }
    const session = openSession(state, windowId, server.pubkey);
    const mcp = message.message as McpMessage;
    if (form === 'notification') { reply(); return; }
    if (form === 'response') {
      if (!session.outstandingServerRequests.delete(String(mcp.id))) { fail('invalid message'); return; }
      reply();
      return;
    }
    const key = `${typeof mcp.id}:${String(mcp.id)}`;
    if (session.usedRequestIds.has(key)) { fail('invalid message'); return; }
    session.usedRequestIds.add(key);
    const meta = isRecord(mcp.params) && isRecord(mcp.params._meta) ? mcp.params._meta : undefined;
    if (meta?.progressToken !== undefined) push(progressEvent(server, meta.progressToken));
    reply({ message: dispatchMcp(fixture, session, mcp) });
  };

  const closeRoute = ({ message, windowId, state, reply, fail }: Context): void => {
    if (!isCvmServerRef(message.server)) { fail('invalid request'); return; }
    state.sessions.delete(sessionKey(windowId, message.server.pubkey));
    reply();
  };

  const registryCallRoute = ({ message, windowId, state, reply, fail }: Context): void => {
    const callOptions = message.options;
    const optionError = validateCvmOptions(callOptions, maxTimeoutMs);
    if (optionError) { fail(optionError); return; }
    if (typeof message.tool !== 'string' || message.tool.length === 0) { fail('invalid request'); return; }
    if (message.args !== undefined && !isRecord(message.args)) { fail('invalid request'); return; }
    const resolved = resolveSelector(state, message.selector, isRecord(callOptions) ? callOptions.server : undefined);
    if (typeof resolved === 'string') { fail(resolved); return; }
    if (!resolved.entry.tools.some((item) => item.name === message.tool)) { fail('schema mismatch'); return; }
    if (denied.has(resolved.fixture.server.pubkey)) { fail('policy denied'); return; }
    openSession(state, windowId, resolved.fixture.server.pubkey);
    const result = runMockCvmTool(resolved.fixture, message.tool, (message.args ?? {}) as Fields);
    if (!result) { fail('schema mismatch'); return; }
    reply({ result });
  };

  const base = defineMockService<MockCvmState>({
    domain: 'cvm',
    version: '1.0.0',
    description: 'Mock NAP-CVM: two seeded MCP-over-Nostr servers serving the Linux image catalog',
    kind: 'service',
    initialState: () => ({ servers: [...MOCK_CVM_SERVERS], sessions: new Map(), serverRequests: 0 }),
    routes: {
      'cvm.discover': discoverRoute,
      'cvm.request': requestRoute,
      'cvm.close': closeRoute,
      'cvm.registry.list': registryListRoute,
      'cvm.registry.has': registryHasRoute,
      'cvm.registry.describe': registryDescribeRoute,
      'cvm.registry.call': registryCallRoute,
    },
    onWindowDestroyed: (windowId, state) => closeWindowSessions(state, windowId),
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null || capability === 'cvm:call') closeWindowSessions(state, windowId);
    },
  }, options);

  const event = (pubkey: string, message: McpMessage): NappletMessage =>
    ({ type: 'cvm.event', server: { pubkey }, message }) as NappletMessage;

  const service: MockCvmService = Object.assign(base, {
    emitNotification(windowId: string, pubkey: string, method: string, params?: Fields): boolean {
      if (!base.mock.state().sessions.has(sessionKey(windowId, pubkey))) return false;
      return pushToWindow(service, windowId, event(pubkey, { jsonrpc: '2.0', method, ...(params ? { params } : {}) }));
    },
    emitServerRequest(windowId: string, pubkey: string, method: string, params?: Fields): string | undefined {
      const state = base.mock.state();
      const session = state.sessions.get(sessionKey(windowId, pubkey));
      if (!session) return undefined;
      state.serverRequests += 1;
      const id = `srv-${state.serverRequests}`;
      session.outstandingServerRequests.add(id);
      pushToWindow(service, windowId, event(pubkey, { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }));
      return id;
    },
  });
  return service;
}

/**
 * Registry row for the `cvm` domain.
 *
 * @example
 * ```ts
 * CVM_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'cvm';
 * ```
 */
export const CVM_MOCK_ENTRY: MockDomainEntry = {
  domain: 'cvm',
  kind: 'service',
  spec: CVM_SPEC_REF,
  create: (options) => createMockCvmService(options),
};
