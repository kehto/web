/**
 * domains/cvm-fixtures.ts — Seeded ContextVM servers, their MCP tools and
 * resources, and MCP message-form checks for the mock NAP-CVM service.
 *
 * Spec: naps/NAP-CVM.md @ napplet/naps PR #31 head 28cf1bdb5c64 (draft).
 * Both servers serve the Linux distribution catalog; hashes are placeholders.
 */
import type { CvmServer, CvmServerRef, McpResource, McpTool, McpToolResult } from '@napplet/nap/cvm/types';
import { mockHex, mockPubkey } from '../core/rng.js';
import { LINUX_DISTROS, findLinuxDistro, searchLinuxDistros, type LinuxDistroImage } from '../fixtures/linux-distros.js';
import { MOCK_RELAYS } from '../fixtures/nostr.js';

/**
 * Announcement kinds the mock discovery inspects (ContextVM server, tools, resources lists).
 *
 * @example
 * ```ts
 * MOCK_CVM_ANNOUNCEMENT_KINDS.includes(11316);
 * ```
 */
export const MOCK_CVM_ANNOUNCEMENT_KINDS: readonly number[] = Object.freeze([11316, 11317, 11318]);

/**
 * An MCP tool with its verified CEP-15 schema hash.
 *
 * @example
 * ```ts
 * const echo = MOCK_CVM_SERVERS[0].tools[0];
 * echo.schemaHash.length === 64;
 * ```
 */
export interface MockCvmTool extends McpTool {
  /** Placeholder CEP-15 hash of the tool schema (64 lowercase hex). */
  schemaHash: string;
}

/**
 * One seeded ContextVM server with its registry family, tools and resources.
 *
 * @example
 * ```ts
 * const distro = findMockCvmServer(MOCK_CVM_SERVERS[1].server.pubkey);
 * distro?.family === 'distro';
 * ```
 */
export interface MockCvmServerFixture {
  /** Discoverable announcement. */
  server: CvmServer;
  /** Shell-local registry family label. */
  family: string;
  /** Family description. */
  familyDescription: string;
  /** Tools served by `tools/list` and `tools/call`. */
  tools: MockCvmTool[];
  /** Resources served by `resources/list` and `resources/read`. */
  resources: McpResource[];
}

function tool(server: string, name: string, description: string, properties: Record<string, unknown>, required: string[]): MockCvmTool {
  return { name, description, inputSchema: { type: 'object', properties, required }, schemaHash: mockHex(`cep15:${server}:${name}`) };
}

function resourceUri(image: LinuxDistroImage): string {
  return `mock://distros/${image.id}`;
}

function resourceText(image: LinuxDistroImage): string {
  return JSON.stringify({ id: image.id, distro: image.distro, version: image.version, fileName: image.fileName, sizeBytes: image.sizeBytes, sha256: image.sha256, mirrors: image.mirrors });
}

const ECHO_PUBKEY = mockPubkey('cvm:echo-vm');
const DISTRO_PUBKEY = mockPubkey('cvm:distro-vm');

/**
 * Two seeded servers: `EchoVM` (one `echo` tool) and `DistroVM` (catalog
 * tools plus one resource per image).
 *
 * @example
 * ```ts
 * MOCK_CVM_SERVERS.map((s) => s.server.name); // ['EchoVM', 'DistroVM']
 * ```
 */
export const MOCK_CVM_SERVERS: readonly MockCvmServerFixture[] = Object.freeze([
  {
    server: {
      pubkey: ECHO_PUBKEY,
      relays: [MOCK_RELAYS.primary],
      name: 'EchoVM',
      description: 'Echoes tool arguments back as text',
      capabilities: ['tools'],
      paymentRequired: false,
    },
    family: 'echo',
    familyDescription: 'Round-trip text through a ContextVM server',
    tools: [tool('echo-vm', 'echo', 'Return the supplied text unchanged', { text: { type: 'string' } }, ['text'])],
    resources: [],
  },
  {
    server: {
      pubkey: DISTRO_PUBKEY,
      relays: [MOCK_RELAYS.secondary, MOCK_RELAYS.discovery],
      name: 'DistroVM',
      description: 'Linux distribution catalog exposed through MCP over Nostr',
      capabilities: ['tools', 'resources'],
      paymentRequired: false,
    },
    family: 'distro',
    familyDescription: 'Look up Linux distribution images and their checksums',
    tools: [
      tool('distro-vm', 'distro.lookup', 'Search the image catalog by distro, version or file name', { query: { type: 'string' } }, ['query']),
      tool('distro-vm', 'distro.checksum', 'Return the SHA-256 of one catalog image', { id: { type: 'string' } }, ['id']),
    ],
    resources: LINUX_DISTROS.map((image) => ({
      uri: resourceUri(image),
      name: image.id,
      title: `${image.distro} ${image.version}`,
      description: image.fileName,
      mimeType: 'application/json',
      size: resourceText(image).length,
    })),
  },
]);

/**
 * Find a seeded server by pubkey.
 *
 * @param pubkey - 64-hex server pubkey.
 * @returns The fixture or `undefined`.
 * @example
 * ```ts
 * findMockCvmServer(MOCK_CVM_SERVERS[0].server.pubkey)?.family === 'echo';
 * ```
 */
export function findMockCvmServer(pubkey: string): MockCvmServerFixture | undefined {
  return MOCK_CVM_SERVERS.find((item) => item.server.pubkey === pubkey);
}

function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: 'text', text }], isError };
}

/**
 * Execute a seeded tool. Unknown tools return `undefined`; argument errors
 * return an `isError` result, as MCP prescribes for tool failures.
 *
 * @param fixture - Server fixture.
 * @param name - Tool name.
 * @param args - Tool arguments.
 * @returns The tool result, or `undefined` when the server has no such tool.
 * @example
 * ```ts
 * runMockCvmTool(MOCK_CVM_SERVERS[0], 'echo', { text: 'hi' })?.content[0].text === 'hi';
 * ```
 */
export function runMockCvmTool(fixture: MockCvmServerFixture, name: string, args: Record<string, unknown>): McpToolResult | undefined {
  if (!fixture.tools.some((item) => item.name === name)) return undefined;
  if (name === 'echo') {
    return typeof args.text === 'string' ? textResult(args.text) : textResult('echo requires a text argument', true);
  }
  if (name === 'distro.lookup') {
    if (typeof args.query !== 'string') return textResult('distro.lookup requires a query argument', true);
    const matches = searchLinuxDistros(args.query).map((image) => ({ id: image.id, distro: image.distro, version: image.version, fileName: image.fileName, sizeBytes: image.sizeBytes, sha256: image.sha256 }));
    return textResult(JSON.stringify(matches));
  }
  const image = typeof args.id === 'string' ? findLinuxDistro(args.id) : undefined;
  return image ? textResult(image.sha256) : textResult('unknown image id', true);
}

/**
 * Read a seeded resource: the complete ordered `contents` list.
 *
 * @param fixture - Server fixture.
 * @param uri - Resource URI.
 * @returns Contents, or `undefined` when the resource does not exist.
 * @example
 * ```ts
 * readMockCvmResource(MOCK_CVM_SERVERS[1], 'mock://distros/debian-12-netinst')?.length === 1;
 * ```
 */
export function readMockCvmResource(fixture: MockCvmServerFixture, uri: string): Array<{ uri: string; mimeType: string; text: string }> | undefined {
  if (!fixture.resources.some((item) => item.uri === uri)) return undefined;
  const image = LINUX_DISTROS.find((item) => resourceUri(item) === uri);
  return image ? [{ uri, mimeType: 'application/json', text: resourceText(image) }] : undefined;
}

/**
 * The three MCP message forms NAP-CVM distinguishes.
 *
 * @example
 * ```ts
 * const form: McpForm = 'notification';
 * ```
 */
export type McpForm = 'request' | 'notification' | 'response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validMcpId(value: unknown): boolean {
  return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value));
}

/**
 * Classify an MCP message by form, or `null` when malformed (batches,
 * `id: null`, both `result` and `error`, a response with `method`, …).
 *
 * @param value - The `message` field of `cvm.request`.
 * @returns The form or `null`.
 * @example
 * ```ts
 * classifyMcpMessage({ jsonrpc: '2.0', method: 'ping', id: 1 }) === 'request';
 * ```
 */
export function classifyMcpMessage(value: unknown): McpForm | null {
  if (!isRecord(value) || value.jsonrpc !== '2.0') return null;
  if (value.id !== undefined && !validMcpId(value.id)) return null;
  if (value.params !== undefined && !isRecord(value.params)) return null;
  const hasMethod = typeof value.method === 'string' && value.method.length > 0;
  const hasResult = value.result !== undefined;
  const hasError = value.error !== undefined;
  if (hasMethod) {
    if (hasResult || hasError) return null;
    return value.id !== undefined ? 'request' : 'notification';
  }
  if (value.method !== undefined || value.id === undefined || value.params !== undefined) return null;
  if (hasResult === hasError) return null;
  if (hasResult && !isRecord(value.result)) return null;
  if (hasError && !isRecord(value.error)) return null;
  return 'response';
}

/**
 * Whether a value is a well-formed `CvmServerRef` (64 lowercase hex pubkey,
 * optional relay list).
 *
 * @param value - Candidate.
 * @returns Type guard result.
 * @example
 * ```ts
 * isCvmServerRef({ pubkey: 'a'.repeat(64) }) === true;
 * ```
 */
export function isCvmServerRef(value: unknown): value is CvmServerRef {
  if (!isRecord(value) || typeof value.pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(value.pubkey)) return false;
  return value.relays === undefined || (Array.isArray(value.relays) && value.relays.every((item) => typeof item === 'string'));
}

/**
 * Validate `CvmRequestOptions` / `CvmRegistryCallOptions` and return the
 * NAP-CVM error text, or `null` when acceptable.
 *
 * @param value - The `options` field.
 * @param maxTimeoutMs - Shell policy ceiling for `timeoutMs`.
 * @returns `invalid request`, `invalid timeout`, `timeout out of policy`, or `null`.
 * @example
 * ```ts
 * validateCvmOptions({ timeoutMs: 0 }, 300_000) === 'invalid timeout';
 * ```
 */
export function validateCvmOptions(value: unknown, maxTimeoutMs: number): string | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return 'invalid request';
  if (value.initialize !== undefined && typeof value.initialize !== 'boolean') return 'invalid request';
  if (value.payment !== undefined && !['deny', 'prompt', 'allow'].includes(value.payment as string)) return 'invalid request';
  if (value.cache !== undefined && !['default', 'reload', 'no-store'].includes(value.cache as string)) return 'invalid request';
  if (value.server !== undefined && !isCvmServerRef(value.server)) return 'invalid request';
  if (value.timeoutMs !== undefined) {
    const timeout = value.timeoutMs;
    if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout < 1 || timeout > 300_000) return 'invalid timeout';
    if (timeout > maxTimeoutMs) return 'timeout out of policy';
  }
  return null;
}
